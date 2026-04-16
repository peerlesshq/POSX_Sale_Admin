/**
 * SettlementOrchestrator — the Phase 4 daily UTC settlement pipeline.
 *
 * Source of truth: 01 §12, 02 §16, 07 §20, §33.
 *
 * Responsibilities:
 *   1. Resolve the effective config version SET for the settlement day
 *   2. Enumerate eligible wallets
 *   3. For each wallet:
 *      a. Resolve tier + team rate + qualification
 *      b. For each direct subordinate line, compute effective
 *         performance and look up the line root's team rate
 *      c. Evaluate equal-level replacement per line (constraint 3:
 *         it is REPLACEMENT, not an additive bonus — when it fires,
 *         the line's differential becomes 0)
 *      d. Compute per-user raw team-reward total
 *      e. Apply burn via `BurnService`
 *      f. Persist `team_rewards_daily` + line details
 *      g. For lines where equal-level fired, persist
 *         `equal_level_rewards_daily`
 *   4. Transition the job to `completed` / `partial` / `failed`
 *
 * This file is long because it is the single coherent place where
 * the calculation steps happen. Splitting it into sub-services is
 * a Phase 6 refactor — right now readability in one file matters
 * more than file count.
 */
import {
  ConfigGroup,
  type ConfigResolver,
  normalizeBurnPolicy,
  normalizeEqualLevelPolicy,
  normalizeQualificationPolicy,
  normalizeTierDefinitions,
} from '@posx/config';
import { normalizeEffectiveDepth, normalizeTeamLadders } from '@posx/config';
import {
  BurnRewardType,
  RewardSnapshotStatus,
  SettlementJobMode,
  SettlementJobStatus,
  SettlementJobType,
  type Uuid,
  type UtcDate,
  type WalletAddress,
} from '@posx/shared-types';
import {
  computeLineDifferential,
  evaluateEqualLevel,
  resolveTeamRate,
  resolveTier,
  type BurnPolicy,
  type EffectiveDepthConfig,
  type EqualLevelPolicy,
  type QualificationPolicy,
  type TeamLadderDefinitions,
  type TierDefinitions,
} from '@posx/domain-rules';
import { addAmount, isPositive, type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  insertEqualLevelReward,
} from '../repos/equal-level-rewards';
import {
  findNonFailedSettlementJob,
  insertSettlementJob,
  releaseSettlementLock,
  tryAcquireSettlementLock,
  type SettlementJobRow,
} from '../repos/settlement-jobs';
import {
  insertTeamRewardDaily,
  insertTeamRewardLineDetail,
} from '../repos/team-rewards';
import { transitionSettlementJob } from '../transitions/settlement-job';

import type { BurnService } from './burn-service';
import type { HoldingService } from '@posx/shared-types';
import type { TeamAggregateService } from './team-aggregate-service';

// Internal bundle of all normalized config inputs needed for one
// settlement day. Resolved ONCE per run.
interface SettlementConfigBundle {
  readonly qualification: QualificationPolicy;
  readonly tiers: TierDefinitions;
  readonly teamLadders: TeamLadderDefinitions;
  readonly effectiveDepth: EffectiveDepthConfig;
  readonly equalLevelPolicy: EqualLevelPolicy;
  readonly burnPolicy: BurnPolicy;
}

export interface RunSettlementInput {
  readonly settlementDate: UtcDate;
  readonly mode: SettlementJobMode;
  readonly triggeredByAdminId?: Uuid | null;
  readonly reason?: string | null;
}

export interface RunSettlementResult {
  readonly job: SettlementJobRow;
  readonly processedUserCount: number;
  readonly createdSnapshotCount: number;
  readonly errorCount: number;
}

export class SettlementOrchestrator {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly config: ConfigResolver,
    private readonly teamAggregates: TeamAggregateService,
    private readonly holdings: HoldingService,
    private readonly burnService: BurnService,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async run(input: RunSettlementInput): Promise<RunSettlementResult> {
    // BE-52 idempotency guard — reject re-runs for `(settlement_date,
    // mode)` that have already been recorded (any status other than
    // `failed`). This is enforced BEFORE the advisory lock so a
    // caller who has not acquired the lock still sees the same
    // semantics as a caller who has.
    const existing = await findNonFailedSettlementJob(
      this.db,
      input.settlementDate,
      input.mode,
    );
    if (existing) {
      throw new AppError(
        'CONFLICT',
        `settlement job already recorded for ${input.settlementDate} (${input.mode}): status=${existing.status}`,
      );
    }

    // BE-51 concurrency guard — Postgres advisory lock keyed on
    // `(settlement_date, mode)`. This is the second half of the
    // double-payout defense: if two orchestrators race through the
    // idempotency check before either has inserted a job row, the
    // lock still guarantees only one of them performs writes.
    const lockAcquired = await tryAcquireSettlementLock(
      this.db,
      input.settlementDate,
      input.mode,
    );
    if (!lockAcquired) {
      throw new AppError(
        'CONFLICT',
        `another process is currently running settlement for ${input.settlementDate} (${input.mode})`,
      );
    }

    try {
      return await this.runLocked(input);
    } finally {
      // Release in a finally so the lock never leaks — even if the
      // try-body throws partway through. Swallow unlock errors;
      // letting them escape would mask the real underlying failure.
      try {
        await releaseSettlementLock(
          this.db,
          input.settlementDate,
          input.mode,
        );
      } catch {
        /* intentional: never mask a run error with an unlock error */
      }
    }
  }

  private async runLocked(
    input: RunSettlementInput,
  ): Promise<RunSettlementResult> {
    const bundle = await this.loadConfigBundle(input.settlementDate);

    const jobMode = input.mode;
    const jobType =
      jobMode === SettlementJobMode.Official
        ? SettlementJobType.DailySettlement
        : jobMode === SettlementJobMode.Backfill
          ? SettlementJobType.Backfill
          : SettlementJobType.Recompute;

    const snapshot = this.encodeConfigSnapshot(bundle);
    const startedAt = this.clock.nowIso();

    const job = await insertSettlementJob(this.db, {
      job_type: jobType,
      settlement_date: input.settlementDate,
      mode: jobMode,
      status: SettlementJobStatus.Running,
      config_version_snapshot: snapshot,
      started_at: startedAt,
      triggered_by_admin_id: input.triggeredByAdminId ?? null,
      reason: input.reason ?? null,
    });

    const eligibleWallets = await this.enumerateEligibleWallets();

    let processedUserCount = 0;
    let createdSnapshotCount = 0;
    let errorCount = 0;
    const errorSamples: Array<{ wallet: WalletAddress; message: string }> = [];

    for (const wallet of eligibleWallets) {
      try {
        const created = await this.settleOneUser({
          job,
          wallet,
          settlementDate: input.settlementDate,
          bundle,
        });
        if (created > 0) createdSnapshotCount += created;
        processedUserCount += 1;
      } catch (err) {
        errorCount += 1;
        const msg = err instanceof Error ? err.message : String(err);
        if (errorSamples.length < 10) {
          errorSamples.push({ wallet, message: msg });
        }
      }
    }

    const finalStatus: SettlementJobStatus =
      errorCount === 0
        ? SettlementJobStatus.Completed
        : processedUserCount > 0
          ? SettlementJobStatus.Partial
          : SettlementJobStatus.Failed;

    const finishedAt = this.clock.nowIso();
    const updated = await transitionSettlementJob(this.db, {
      jobId: job.id,
      toStatus: finalStatus,
      finishedAt,
      processedUserCount,
      createdSnapshotCount,
      createdAdjustmentCount: 0,
      errorCount,
      errorSample:
        errorSamples.length === 0 ? null : { samples: errorSamples },
    });

    return {
      job: updated,
      processedUserCount,
      createdSnapshotCount,
      errorCount,
    };
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private async loadConfigBundle(
    settlementDate: UtcDate,
  ): Promise<SettlementConfigBundle> {
    const evaluationTime = `${settlementDate}T23:59:59.999Z`;
    const ctx = { evaluationTime, settlementDate };

    const [
      qualRow,
      tierRow,
      ladderRow,
      depthRow,
      equalLevelRow,
      burnRow,
    ] = await this.config.resolveMany([
      { group: ConfigGroup.QualificationRules, key: 'reward_minimums', context: ctx },
      { group: ConfigGroup.TierRules, key: 'tier_definitions', context: ctx },
      { group: ConfigGroup.TeamRewardRules, key: 'team_ladders', context: ctx },
      { group: ConfigGroup.TeamRewardRules, key: 'effective_depth', context: ctx },
      { group: ConfigGroup.EqualLevelRules, key: 'equal_level_policy', context: ctx },
      { group: ConfigGroup.BurnRules, key: 'burn_policy', context: ctx },
    ]);

    const mustHave = (r: { version: unknown } | undefined, label: string) => {
      if (!r || !r.version) {
        throw new AppError('INTERNAL_ERROR', `settlement: missing config ${label}`);
      }
      return r.version as { config_value: Record<string, unknown> };
    };
    const qualValue = mustHave(qualRow, 'qualification_rules.reward_minimums').config_value;
    const tierValue = mustHave(tierRow, 'tier_rules.tier_definitions').config_value;
    const ladderValue = mustHave(ladderRow, 'team_reward_rules.team_ladders').config_value;
    const depthValue = mustHave(depthRow, 'team_reward_rules.effective_depth').config_value;
    const equalLevelValue = mustHave(equalLevelRow, 'equal_level_rules.equal_level_policy').config_value;
    const burnValue = mustHave(burnRow, 'burn_rules.burn_policy').config_value;

    const tierDefinitions = normalizeTierDefinitions(tierValue);
    const teamLadders = normalizeTeamLadders({
      raw: ladderValue,
      tier_definitions: tierDefinitions,
    });

    return {
      qualification: normalizeQualificationPolicy(qualValue),
      tiers: tierDefinitions,
      teamLadders,
      effectiveDepth: normalizeEffectiveDepth(depthValue),
      equalLevelPolicy: normalizeEqualLevelPolicy(equalLevelValue),
      burnPolicy: normalizeBurnPolicy(burnValue),
    };
  }

  private encodeConfigSnapshot(
    bundle: SettlementConfigBundle,
  ): Record<string, unknown> {
    return {
      qualification: bundle.qualification,
      tiers: bundle.tiers,
      team_ladders: bundle.teamLadders,
      effective_depth: bundle.effectiveDepth,
      equal_level_policy: bundle.equalLevelPolicy,
      burn_policy: bundle.burnPolicy,
    };
  }

  /**
   * Wallets with at least one direct subordinate (non-leaf nodes).
   * Leaf users never earn team rewards, so they are excluded from
   * the per-user loop for cost reasons. Users with zero confirmed
   * deposit or restricted status are filtered inside `settleOneUser`
   * based on their qualification result.
   */
  private async enumerateEligibleWallets(): Promise<WalletAddress[]> {
    const rows = await this.db.query<{ wallet_address: WalletAddress }>(
      `select distinct ancestor_wallet_address as wallet_address
         from referral_closure
        where depth = 1
        order by wallet_address`,
    );
    return rows.map((r) => r.wallet_address);
  }

  private async settleOneUser(args: {
    job: SettlementJobRow;
    wallet: WalletAddress;
    settlementDate: UtcDate;
    bundle: SettlementConfigBundle;
  }): Promise<number> {
    const { job, wallet, settlementDate, bundle } = args;

    // Load user deposit total + current holding snapshot.
    const depositRow = await this.db.queryOne<{ total: string | null }>(
      `select coalesce(sum(usdt_amount), 0)::text as total
         from purchases
        where wallet_address = $1 and is_reversed = false`,
      [wallet],
    );
    const cumulativeDeposit = depositRow?.total ?? '0';

    const holdingSnapshot = await this.holdings.getHoldingAtTime({
      walletAddress: wallet,
      settlementDate,
      evaluationTime: `${settlementDate}T23:59:59.999Z`,
    });

    // Tier + qualification.
    const { tier, tier_definition } = resolveTier({
      cumulative_deposit: cumulativeDeposit,
      holding_value_usdt: holdingSnapshot.holdingValueUsdt,
      tier_definitions: bundle.tiers,
    });
    if (!tier || !tier_definition) return 0;

    // Team rate for the user.
    const teamTotalPerformance = await this.teamAggregates.teamTotalPerformance(wallet);
    const { team_rate: userTeamRate } = resolveTeamRate({
      tier,
      team_total_performance: teamTotalPerformance,
      team_ladders: bundle.teamLadders,
      team_eligible: tier_definition.team_eligible,
    });

    // Lines from the user's perspective.
    const lines = await this.teamAggregates.linesForUser(wallet, bundle.effectiveDepth);

    let rawTotal = '0';
    let createdSnapshots = 0;

    interface PreparedLine {
      readonly lineRoot: WalletAddress;
      readonly lineEffectivePerformance: string;
      readonly subordinateTeamRate: string;
      readonly differentialRate: string;
      readonly differentialRaw: string;
      readonly equalLevelApplies: boolean;
      readonly equalLevelRaw: string;
      readonly subordinateTeamTotalPerformance: string;
    }

    const preparedLines: PreparedLine[] = [];

    for (const line of lines) {
      // Subordinate's own tier + team rate on the same day. We
      // re-resolve holding and deposit for the line root to stay
      // internally consistent.
      const subordinateDepositRow = await this.db.queryOne<{ total: string | null }>(
        `select coalesce(sum(usdt_amount), 0)::text as total
           from purchases
          where wallet_address = $1 and is_reversed = false`,
        [line.lineRoot],
      );
      const subordinateDeposit = subordinateDepositRow?.total ?? '0';
      const subordinateHolding = await this.holdings.getHoldingAtTime({
        walletAddress: line.lineRoot,
        settlementDate,
        evaluationTime: `${settlementDate}T23:59:59.999Z`,
      });
      const { tier: subTier, tier_definition: subTierDef } = resolveTier({
        cumulative_deposit: subordinateDeposit,
        holding_value_usdt: subordinateHolding.holdingValueUsdt,
        tier_definitions: bundle.tiers,
      });
      const { team_rate: subordinateTeamRate } = resolveTeamRate({
        tier: subTier,
        team_total_performance: line.subordinateTeamTotalPerformance,
        team_ladders: bundle.teamLadders,
        team_eligible: subTierDef?.team_eligible ?? false,
      });

      const differential = computeLineDifferential({
        user_team_rate: userTeamRate,
        max_team_rate: bundle.teamLadders.max_team_rate,
        line: {
          line_root_wallet_address: line.lineRoot,
          line_effective_performance: line.effectivePerformance,
          subordinate_team_rate: subordinateTeamRate,
        },
      });

      const equalLevel = evaluateEqualLevel({
        user_team_rate: userTeamRate,
        subordinate_team_rate: subordinateTeamRate,
        subordinate_team_total_performance: line.subordinateTeamTotalPerformance,
        user_team_reward_qualified: tier_definition.team_eligible,
        line_active: true,
        line_effective_performance: line.effectivePerformance,
        policy: bundle.equalLevelPolicy,
      });

      // Constraint 3: when equal-level fires, the line's
      // differential contribution becomes zero — replacement, NOT
      // an additive bonus. We do NOT add `differential.raw` to
      // `rawTotal` when `equalLevel.applies`.
      const differentialRawForThisLine = equalLevel.applies
        ? '0'
        : differential.raw_reward_amount;

      rawTotal = addAmount(rawTotal, differentialRawForThisLine);

      preparedLines.push({
        lineRoot: line.lineRoot,
        lineEffectivePerformance: line.effectivePerformance,
        subordinateTeamRate,
        differentialRate: differential.differential_rate,
        differentialRaw: differentialRawForThisLine,
        equalLevelApplies: equalLevel.applies,
        equalLevelRaw: equalLevel.raw_reward_amount,
        subordinateTeamTotalPerformance: line.subordinateTeamTotalPerformance,
      });
    }

    // Phase 4.5 burn historical fix:
    // Start the running used-capacity from the wallet's historical
    // team + equal-level actuals (01 §8.4). This is the ONLY place
    // where the running total is seeded; everything below threads
    // forward from it.
    const usedRunningStart = await this.burnService.fetchUsedBurnCapacity(wallet);

    // Burn the aggregated team reward raw total using the
    // compute-only path so we can write the snapshot row first and
    // then attach the burn_records row in a single downstream call.
    const teamBurn = this.burnService.compute({
      rewardType: BurnRewardType.Team,
      rawAmount: rawTotal,
      holdingValueUsdt: holdingSnapshot.holdingValueUsdt,
      usedBurnCapacityBefore: usedRunningStart,
      policy: bundle.burnPolicy,
    });

    // BE-49: all writes for this user happen inside a single
    // transaction. If any insert below fails (burn record, line
    // detail, equal-level snapshot), the whole user rolls back —
    // no half-written snapshot state is ever visible to the claim
    // path or the next settlement run. Reads and compute already
    // happened above; this block is pure writes.
    return this.db.transaction(async (tx) => {
      const teamRow = await insertTeamRewardDaily(tx, {
        settlement_job_id: job.id,
        wallet_address: wallet,
        settle_date: settlementDate,
        qualification_tier: tier,
        user_team_rate: userTeamRate,
        team_total_performance: teamTotalPerformance,
        effective_performance: preparedLines.reduce(
          (acc, l) => addAmount(acc, l.lineEffectivePerformance),
          '0',
        ),
        raw_total: rawTotal,
        burned_amount: teamBurn.burned_amount,
        actual_total: teamBurn.actual_amount,
        status: RewardSnapshotStatus.Claimable,
      });
      if (isPositive(teamBurn.burned_amount)) {
        await this.burnService.persistBurnRecord(
          {
            wallet,
            rewardType: BurnRewardType.Team,
            rawAmount: rawTotal,
            holdingValueUsdt: holdingSnapshot.holdingValueUsdt,
            usedBurnCapacityBefore: usedRunningStart,
            result: teamBurn,
            persistRecord: {
              settleDate: settlementDate,
              sourceSnapshotId: teamRow.id,
              sourceTable: 'team_rewards_daily',
              reason: 'burn_cap_exceeded',
            },
          },
          tx,
        );
      }
      // Advance the running total so subsequent equal-level burns
      // see the newly-persisted team actual.
      let usedRunning = addAmount(usedRunningStart, teamBurn.actual_amount);
      createdSnapshots += 1;

      // Per-line detail rows + equal-level snapshots.
      for (const line of preparedLines) {
        await insertTeamRewardLineDetail(tx, {
          team_reward_daily_id: teamRow.id,
          line_root_wallet_address: line.lineRoot,
          line_effective_performance: line.lineEffectivePerformance,
          subordinate_team_rate: line.subordinateTeamRate,
          differential_rate: line.differentialRate,
          raw_reward_amount: line.differentialRaw,
          equal_level_replaced: line.equalLevelApplies,
        });

        if (line.equalLevelApplies) {
          const equalBurn = this.burnService.compute({
            rewardType: BurnRewardType.EqualLevel,
            rawAmount: line.equalLevelRaw,
            holdingValueUsdt: holdingSnapshot.holdingValueUsdt,
            usedBurnCapacityBefore: usedRunning,
            policy: bundle.burnPolicy,
          });
          const equalRow = await insertEqualLevelReward(tx, {
            settlement_job_id: job.id,
            wallet_address: wallet,
            line_root_wallet_address: line.lineRoot,
            settle_date: settlementDate,
            equal_level_rate: bundle.equalLevelPolicy.equal_level_rate,
            subordinate_team_total_performance:
              line.subordinateTeamTotalPerformance,
            line_effective_performance: line.lineEffectivePerformance,
            raw_amount: line.equalLevelRaw,
            burned_amount: equalBurn.burned_amount,
            actual_amount: equalBurn.actual_amount,
            status: RewardSnapshotStatus.Claimable,
          });
          if (isPositive(equalBurn.burned_amount)) {
            await this.burnService.persistBurnRecord(
              {
                wallet,
                rewardType: BurnRewardType.EqualLevel,
                rawAmount: line.equalLevelRaw,
                holdingValueUsdt: holdingSnapshot.holdingValueUsdt,
                usedBurnCapacityBefore: usedRunning,
                result: equalBurn,
                persistRecord: {
                  settleDate: settlementDate,
                  sourceSnapshotId: equalRow.id,
                  sourceTable: 'equal_level_rewards_daily',
                  reason: 'burn_cap_exceeded',
                },
              },
              tx,
            );
          }
          usedRunning = addAmount(usedRunning, equalBurn.actual_amount);
          createdSnapshots += 1;
        }
      }

      return createdSnapshots;
    });
  }
}
