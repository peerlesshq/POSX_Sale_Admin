/**
 * BurnService — thin wrapper around `computeBurn` from
 * `@posx/domain-rules` that ALSO owns the historical used-capacity
 * fetch required by 01 §8.4.
 *
 * Constraint 1 reaffirmed: all decisions about WHETHER burn applies
 * live in `@posx/domain-rules/burn.ts`. This service only owns
 * orchestration, the DB lookup for historical used capacity, and
 * the per-snapshot `burn_records` insertion when burn actually
 * fires.
 *
 * Phase 4.5 fix: `fetchUsedBurnCapacity` reads
 *    sum(team_rewards_daily.actual_total where status in
 *        ('claimable','claimed'))
 *  + sum(equal_level_rewards_daily.actual_amount where status in
 *        ('claimable','claimed'))
 * for the given wallet, matching 01 §8.4 EXACTLY:
 *   - team + equal-level are the ONLY off-chain reward types that
 *     count toward burn usage
 *   - direct rewards are excluded (01 §5.3)
 *   - `offset` and `voided` rows are excluded (01 §8.4 excludes
 *     "reversed rewards")
 *   - recompute PREVIEW jobs never write these tables, so they are
 *     naturally excluded
 *   - burned amounts are excluded because we sum `actual_*`, not
 *     `raw_*`
 *
 * The settlement orchestrator then threads a running total for the
 * in-progress run so the team-reward burn and the subsequent
 * equal-level burns see a consistent `usedBefore`.
 */
import {
  type AmountString,
  type BurnRewardType,
  type BurnSourceTable,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import { type BurnPolicy, computeBurn, type BurnResult } from '@posx/domain-rules';
import { addAmount, isPositive } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { insertBurnRecord } from '../repos/burn-records';

export interface BurnApplyInput {
  readonly wallet: WalletAddress;
  readonly rewardType: BurnRewardType;
  readonly rawAmount: AmountString;
  readonly holdingValueUsdt: AmountString;
  readonly usedBurnCapacityBefore: AmountString;
  readonly policy: BurnPolicy;
  /**
   * For persisting a burn record when actual burn > 0. Callers
   * pass these when they already know the downstream snapshot id.
   */
  readonly persistRecord?: {
    readonly settleDate: string;
    readonly sourceSnapshotId: Uuid;
    readonly sourceTable: BurnSourceTable;
    readonly reason: string;
  };
}

export interface BurnApplyResult extends BurnResult {
  /** New running total = usedBefore + actual_amount. */
  readonly newUsedCapacity: AmountString;
}

export class BurnService {
  constructor(private readonly db: DbClient) {}

  /**
   * Read the historical used burn capacity for `wallet` per 01 §8.4.
   *
   * Returns the sum of actual team + equal-level reward amounts for
   * this wallet that are currently in `claimable` or `claimed`
   * status. Used by `SettlementOrchestrator` as the starting
   * `usedBurnCapacityBefore` for a new run.
   */
  async fetchUsedBurnCapacity(wallet: WalletAddress): Promise<AmountString> {
    const row = await this.db.queryOne<{ total: AmountString | null }>(
      `select (
          coalesce(
            (select sum(actual_total)
               from team_rewards_daily
              where wallet_address = $1
                and status in ('claimable','claimed')),
            0
          )
        + coalesce(
            (select sum(actual_amount)
               from equal_level_rewards_daily
              where wallet_address = $1
                and status in ('claimable','claimed')),
            0
          )
        )::text as total`,
      [wallet],
    );
    return row?.total ?? '0';
  }

  /**
   * Pure compute (no DB write). Used by the settlement orchestrator
   * to get the burn numbers for a snapshot row BEFORE it knows the
   * snapshot's id. The orchestrator then calls `persistBurnRecord`
   * once the id exists, avoiding the Phase 4 "two-call pattern"
   * documented in that phase's self-review.
   */
  compute(input: {
    rewardType: BurnRewardType;
    rawAmount: AmountString;
    holdingValueUsdt: AmountString;
    usedBurnCapacityBefore: AmountString;
    policy: BurnPolicy;
  }): BurnResult {
    return computeBurn({
      reward_type: input.rewardType,
      raw_amount: input.rawAmount,
      holding_value_usdt: input.holdingValueUsdt,
      used_burn_capacity_before: input.usedBurnCapacityBefore,
      policy: input.policy,
    });
  }

  /**
   * Persist a burn record for a just-created snapshot when the
   * compute step produced burned > 0. Separated from `compute()` so
   * the orchestrator does not have to call the service twice to
   * obtain the same result.
   *
   * BE-49: accepts an optional transaction-scoped DbClient. When the
   * caller is already inside a transaction (e.g. the settlement
   * orchestrator wrapping its per-user writes), they pass `tx` so
   * that this insert joins the same atomic unit instead of writing
   * under the service's top-level connection.
   */
  async persistBurnRecord(
    input: {
      wallet: WalletAddress;
      rewardType: BurnRewardType;
      rawAmount: AmountString;
      holdingValueUsdt: AmountString;
      usedBurnCapacityBefore: AmountString;
      result: BurnResult;
      persistRecord: {
        settleDate: string;
        sourceSnapshotId: Uuid;
        sourceTable: BurnSourceTable;
        reason: string;
      };
    },
    tx?: DbClient,
  ): Promise<void> {
    if (!isPositive(input.result.burned_amount)) return;
    await insertBurnRecord(tx ?? this.db, {
      wallet_address: input.wallet,
      reward_type: input.rewardType,
      source_snapshot_id: input.persistRecord.sourceSnapshotId,
      source_table: input.persistRecord.sourceTable,
      settle_date: input.persistRecord.settleDate,
      holding_value_at_snapshot: input.holdingValueUsdt,
      used_burn_capacity_before: input.usedBurnCapacityBefore,
      burn_cap: input.result.burn_cap,
      raw_amount: input.rawAmount,
      burned_amount: input.result.burned_amount,
      actual_amount: input.result.actual_amount,
      reason: input.persistRecord.reason,
    });
  }

  /**
   * Back-compat convenience method used by any caller that already
   * knows the downstream snapshot coordinates. Prefer `compute` +
   * `persistBurnRecord` for new code.
   */
  async apply(input: BurnApplyInput): Promise<BurnApplyResult> {
    const result = this.compute({
      rewardType: input.rewardType,
      rawAmount: input.rawAmount,
      holdingValueUsdt: input.holdingValueUsdt,
      usedBurnCapacityBefore: input.usedBurnCapacityBefore,
      policy: input.policy,
    });

    const newUsed = addAmount(input.usedBurnCapacityBefore, result.actual_amount);

    if (input.persistRecord && isPositive(result.burned_amount)) {
      await this.persistBurnRecord({
        wallet: input.wallet,
        rewardType: input.rewardType,
        rawAmount: input.rawAmount,
        holdingValueUsdt: input.holdingValueUsdt,
        usedBurnCapacityBefore: input.usedBurnCapacityBefore,
        result,
        persistRecord: input.persistRecord,
      });
    }

    return { ...result, newUsedCapacity: newUsed };
  }
}
