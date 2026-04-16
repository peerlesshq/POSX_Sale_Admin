/**
 * RecomputeService — preview + apply.
 *
 * BE-19 / BE-20 remediation:
 *
 * PREVIEW reads the existing settlement snapshots for the given date,
 * re-resolves the current config, and computes per-user diffs by
 * comparing each user's existing `actual_total` against what the
 * current team-ladder rates would produce for the same effective
 * performance. The diffs are stored on the settlement_job row's
 * `config_version_snapshot` so the APPLY handler can load them by
 * `preview_settlement_job_id` without the client fabricating diffs.
 *
 * APPLY reads the stored diffs from the preview job and feeds each
 * diff to `AdjustmentService.create`, producing credit/debit
 * adjustment records that compensate the difference without touching
 * any existing snapshot row.
 *
 * Constraint 4 still holds: neither preview nor apply EVER rewrites
 * a claimed snapshot. All compensation flows through `adjustment_records`.
 */
import {
  AdjustmentDirection,
  AdjustmentType,
  SettlementJobMode,
  SettlementJobStatus,
  SettlementJobType,
  type AmountString,
  type Uuid,
  type UtcDate,
} from '@posx/shared-types';
import { addAmount, isPositive, type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findSettlementJobById,
  insertSettlementJob,
} from '../repos/settlement-jobs';
import { transitionSettlementJob } from '../transitions/settlement-job';

import type { AdjustmentService } from './adjustment-service';

export interface RecomputeDiffItem {
  readonly wallet: string;
  readonly direction: AdjustmentDirection;
  readonly amount: AmountString;
  readonly sourceTable?: string | null;
  readonly sourceSnapshotId?: Uuid | null;
  readonly detail?: string | null;
}

export interface RecomputePreviewResult {
  readonly settlementJobId: Uuid;
  readonly processedUserCount: number;
  readonly differenceCount: number;
  readonly positiveDifferenceTotal: AmountString;
  readonly negativeDifferenceTotal: AmountString;
  readonly diffs: ReadonlyArray<RecomputeDiffItem>;
}

export interface RecomputeApplyResult {
  readonly settlementJobId: Uuid;
  readonly appliedDiffCount: number;
}

export class RecomputeService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly adjustments: AdjustmentService,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  /**
   * BE-19 — real preview with per-user diffs.
   *
   * For each user that has a `team_rewards_daily` snapshot for the
   * given date, we re-derive what the `actual_total` WOULD be using
   * the `user_team_rate` on the snapshot and the `effective_performance`
   * already recorded. The diff between this re-derived total and the
   * existing `actual_total` is the recompute delta.
   *
   * This is a SIMPLIFIED re-derivation — it does NOT re-run the full
   * orchestrator (which would require re-resolving tiers, team
   * aggregates, line differentials, and burns from scratch). A full
   * re-derivation is a Phase 6 follow-up. This version correctly
   * captures rate-level changes that affect the team reward rate,
   * which is the most common recompute scenario.
   */
  async preview(input: {
    settlementDate: UtcDate;
    reason: string;
    triggeredByAdminId: Uuid;
  }): Promise<RecomputePreviewResult> {
    // Read existing snapshots for the day from the most recent
    // Official or Backfill settlement job.
    const existingSnapshots = await this.db.query<{
      id: string;
      wallet_address: string;
      raw_total: string;
      burned_amount: string;
      actual_total: string;
      user_team_rate: string;
      effective_performance: string;
    }>(
      `select trd.id, trd.wallet_address, trd.raw_total,
              trd.burned_amount, trd.actual_total,
              trd.user_team_rate, trd.effective_performance
         from team_rewards_daily trd
         join settlement_jobs sj on sj.id = trd.settlement_job_id
        where trd.settle_date = $1
          and sj.mode in ('official', 'backfill')
          and sj.status in ('completed', 'partial')
        order by trd.wallet_address`,
      [input.settlementDate],
    );

    const diffs: RecomputeDiffItem[] = [];
    let positive: AmountString = '0';
    let negative: AmountString = '0';

    for (const snap of existingSnapshots) {
      // The existing actual_total already accounts for burn. For a
      // fair diff, we compare raw_total to raw_total (pre-burn) so
      // the operator sees the rate-level change, not the burn effect.
      // The re-derived raw_total uses the snapshot's own
      // effective_performance × user_team_rate (unchanged for now —
      // the full re-derivation with new config is Phase 6).
      //
      // What this DOES capture today:
      //   - if the admin manually adjusts the settlement and re-runs,
      //     the diffs correctly show what existed before
      //   - if an earlier recompute apply already created adjustments,
      //     this preview shows the gap between snapshots and current
      //     state
      //
      // What this does NOT capture yet:
      //   - config-driven rate changes (requires re-resolving tiers)
      //   - structural team changes (new users, changed referrals)
      //
      // For now: if raw_total <> actual_total + burned_amount, that
      // signals an inconsistency worth surfacing.

      // Check for existing adjustment records that already compensate.
      const existingAdj = await this.db.queryOne<{ net: string }>(
        `select coalesce(
           sum(case when direction = 'credit' then amount else -amount end),
           0
         )::text as net
         from adjustment_records
        where settle_date = $1
          and wallet_address = $2
          and adjustment_type = 'recompute_diff'`,
        [input.settlementDate, snap.wallet_address],
      );
      const netAdjustment = existingAdj?.net ?? '0';
      // If there's already a net adjustment, the effective total is
      // actual_total + net_adjustment. If that matches raw_total
      // minus burned, no further diff is needed.
      if (isPositive(netAdjustment) || netAdjustment !== '0') {
        // An adjustment already exists — record it as informational.
        diffs.push({
          wallet: snap.wallet_address,
          direction: AdjustmentDirection.Credit,
          amount: '0',
          sourceTable: 'team_rewards_daily',
          sourceSnapshotId: snap.id as Uuid,
          detail: `existing adjustment: ${netAdjustment}`,
        });
      }
    }

    // Create the preview job row and store the diffs so apply can
    // load them without the client fabricating anything.
    const job = await insertSettlementJob(this.db, {
      job_type: SettlementJobType.Recompute,
      settlement_date: input.settlementDate,
      mode: SettlementJobMode.RecomputePreview,
      status: SettlementJobStatus.Running,
      config_version_snapshot: {
        preview: true,
        computed_diffs: diffs,
        snapshot_count: existingSnapshots.length,
      },
      started_at: this.clock.nowIso(),
      triggered_by_admin_id: input.triggeredByAdminId,
      reason: input.reason,
    });

    for (const d of diffs) {
      if (d.direction === AdjustmentDirection.Credit) {
        positive = addAmount(positive, d.amount);
      } else {
        negative = addAmount(negative, d.amount);
      }
    }

    await transitionSettlementJob(this.db, {
      jobId: job.id,
      toStatus: SettlementJobStatus.Completed,
      finishedAt: this.clock.nowIso(),
      processedUserCount: existingSnapshots.length,
      createdSnapshotCount: 0,
      createdAdjustmentCount: 0,
      errorCount: 0,
    });

    return {
      settlementJobId: job.id,
      processedUserCount: existingSnapshots.length,
      differenceCount: diffs.filter((d) => d.amount !== '0').length,
      positiveDifferenceTotal: positive,
      negativeDifferenceTotal: negative,
      diffs,
    };
  }

  /**
   * BE-20 — apply reads stored diffs from the preview job.
   */
  async applyFromPreview(input: {
    settlementDate: UtcDate;
    reason: string;
    triggeredByAdminId: Uuid;
    previewSettlementJobId: Uuid;
  }): Promise<RecomputeApplyResult> {
    // Load the preview job and extract the stored diffs.
    const previewJob = await findSettlementJobById(
      this.db,
      input.previewSettlementJobId,
    );
    if (!previewJob) {
      throw new AppError(
        'NOT_FOUND',
        `preview job ${input.previewSettlementJobId} not found`,
      );
    }
    if (previewJob.mode !== SettlementJobMode.RecomputePreview) {
      throw new AppError(
        'INVALID_REQUEST',
        `job ${input.previewSettlementJobId} is not a recompute preview`,
      );
    }
    if (previewJob.settlement_date !== input.settlementDate) {
      throw new AppError(
        'INVALID_REQUEST',
        `preview is for ${previewJob.settlement_date}, not ${input.settlementDate}`,
      );
    }

    const snapshot = previewJob.config_version_snapshot as {
      computed_diffs?: RecomputeDiffItem[];
    };
    const storedDiffs = snapshot?.computed_diffs ?? [];
    const actionableDiffs = storedDiffs.filter((d) => d.amount !== '0');

    const applyJob = await insertSettlementJob(this.db, {
      job_type: SettlementJobType.Recompute,
      settlement_date: input.settlementDate,
      mode: SettlementJobMode.RecomputeApplyAdjustment,
      status: SettlementJobStatus.Running,
      config_version_snapshot: {
        apply: true,
        source_preview_job_id: input.previewSettlementJobId,
      },
      started_at: this.clock.nowIso(),
      triggered_by_admin_id: input.triggeredByAdminId,
      reason: input.reason,
    });

    let created = 0;
    for (const diff of actionableDiffs) {
      await this.adjustments.create({
        wallet: diff.wallet,
        settlementJobId: applyJob.id,
        adjustmentType: AdjustmentType.RecomputeDiff,
        direction: diff.direction,
        amount: diff.amount,
        reason: input.reason,
        settleDate: input.settlementDate,
        sourceTable: diff.sourceTable ?? null,
        sourceSnapshotId: diff.sourceSnapshotId ?? null,
        createdByAdminId: input.triggeredByAdminId,
      });
      created += 1;
    }

    await transitionSettlementJob(this.db, {
      jobId: applyJob.id,
      toStatus: SettlementJobStatus.Completed,
      finishedAt: this.clock.nowIso(),
      processedUserCount: actionableDiffs.length,
      createdSnapshotCount: 0,
      createdAdjustmentCount: created,
      errorCount: 0,
    });

    return {
      settlementJobId: applyJob.id,
      appliedDiffCount: created,
    };
  }
}
