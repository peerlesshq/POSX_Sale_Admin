/**
 * Summary rebuild job — runs every rebuilder in sequence against
 * the supplied date. Called after settlement completes, and
 * manually on demand by admin tooling.
 */
import type { UtcDate, WalletAddress } from '@posx/shared-types';
import type { EffectiveDepthConfig } from '@posx/domain-rules';

import type { DbClient } from '../db';
import { rebuildDashboardDailySummaryFor } from '../rebuilders/dashboard-daily-summary';
import { rebuildTeamLevelAggregateFor } from '../rebuilders/team-level-aggregate-daily';
import { rebuildUserRewardSummaryAll } from '../rebuilders/user-reward-summary';
import { rebuildUserVestingSummaryAll } from '../rebuilders/user-vesting-summary';

import { JobRunner } from './runner';

export interface SummaryRebuildJobInput {
  readonly db: DbClient;
  readonly settlementDate: UtcDate;
  /**
   * Optional: wallets to rebuild team-level aggregates for.
   * Typically the set of wallets that had snapshots generated on
   * this settlement day. If omitted, the team-level aggregate step
   * is skipped (reward / vesting / dashboard rebuilds still run).
   */
  readonly wallets?: ReadonlyArray<WalletAddress>;
  readonly depth?: EffectiveDepthConfig;
}

export async function runSummaryRebuildJob(
  input: SummaryRebuildJobInput,
): Promise<void> {
  const runner = new JobRunner(input.db);
  await runner.run({
    jobName: 'summary_rebuild',
    jobKey: input.settlementDate,
    fn: async () => {
      await rebuildUserVestingSummaryAll(input.db);
      await rebuildUserRewardSummaryAll(input.db);
      if (input.wallets && input.depth) {
        for (const wallet of input.wallets) {
          await rebuildTeamLevelAggregateFor(
            input.db,
            wallet,
            input.settlementDate,
          );
        }
      }
      await rebuildDashboardDailySummaryFor(input.db, input.settlementDate);
      return { ok: true };
    },
    extractCounts: () => ({
      rows_processed: input.wallets?.length ?? 0,
      detail: { settlement_date: input.settlementDate },
    }),
  });
}
