/**
 * `team_performance_snapshot` rebuilder (constraint 5).
 *
 * One row per (wallet, snapshot_date) with the user's team total
 * performance + effective performance + team rate + tier. Rebuilt
 * from `referral_closure` joined to `purchases` plus the resolved
 * team ladder + tier definitions for the given settlement day.
 *
 * The caller passes the effective-depth range and `team_rate`
 * resolver already — see the settlement orchestrator — so this
 * rebuilder stays DB-oriented and doesn't need its own config
 * access. It is typically invoked immediately after the settlement
 * orchestrator finishes a day.
 */
import type {
  AmountString,
  RateString,
  TierCode,
  UtcDate,
  WalletAddress,
} from '@posx/shared-types';
import type { EffectiveDepthConfig } from '@posx/domain-rules';

import type { DbClient } from '../db';
import { upsertTeamPerformanceSnapshot } from '../repos/summaries';

export interface TeamPerfRebuildInput {
  readonly wallet: WalletAddress;
  readonly snapshotDate: UtcDate;
  readonly teamRate: RateString;
  readonly tier: TierCode;
  readonly depth: EffectiveDepthConfig;
}

export async function rebuildTeamPerformanceSnapshotFor(
  db: DbClient,
  input: TeamPerfRebuildInput,
): Promise<void> {
  const totals = await db.queryOne<{
    team_total: AmountString;
    effective_total: AmountString;
  }>(
    `
    with depth_map as (
      select descendant_wallet_address as w, depth
        from referral_closure
       where ancestor_wallet_address = $1
    )
    select
      coalesce(sum(p.usdt_amount), 0)::text as team_total,
      coalesce(sum(p.usdt_amount) filter (
        where d.depth between $2 and $3
      ), 0)::text as effective_total
    from depth_map d
    join purchases p
      on p.wallet_address = d.w
     and p.is_reversed = false
    `,
    [input.wallet, input.depth.effective_level_start, input.depth.effective_level_end],
  );

  await upsertTeamPerformanceSnapshot(db, {
    wallet_address: input.wallet,
    snapshot_date: input.snapshotDate,
    team_total_performance: totals?.team_total ?? '0',
    effective_performance: totals?.effective_total ?? '0',
    team_rate: input.teamRate,
    tier: input.tier,
  });
}
