/**
 * `team_level_aggregate_daily` rebuilder (constraint 5).
 *
 * For each wallet, produces one row per descendant depth level
 * (1 through `maxDepth`) containing member count, active count,
 * new-day performance, and cumulative-to-date performance. Used by
 * the admin team page + the user team "aggregates_by_level"
 * section (04 §12.2).
 */
import type {
  AmountString,
  UtcDate,
  WalletAddress,
} from '@posx/shared-types';
import { utcDayEnd, utcDayStart } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { upsertTeamLevelAggregate } from '../repos/summaries';

export async function rebuildTeamLevelAggregateFor(
  db: DbClient,
  wallet: WalletAddress,
  snapshotDate: UtcDate,
  maxDepth = 7,
): Promise<void> {
  // Gather per-depth counts + performance. `new_performance` is
  // restricted to purchases that land within `snapshotDate` itself;
  // `cumulative_performance` is all non-reversed purchases up to
  // end-of-day.
  const dayStart = utcDayStart(snapshotDate);
  const dayEnd = utcDayEnd(snapshotDate);

  const rows = await db.query<{
    level: number;
    member_count: number;
    active_count: number;
    new_performance: AmountString;
    cumulative_performance: AmountString;
  }>(
    `
    with members as (
      select rc.depth as level,
             rc.descendant_wallet_address as w,
             u.status
        from referral_closure rc
        join users u on u.wallet_address = rc.descendant_wallet_address
       where rc.ancestor_wallet_address = $1
         and rc.depth <= $2
    )
    select
      m.level,
      count(distinct m.w)::int                                   as member_count,
      count(distinct case when m.status = 'active' then m.w end)::int as active_count,
      coalesce(
        sum(
          case when p.purchase_at between $3 and $4 and p.is_reversed = false
               then p.usdt_amount end
        ), 0
      )::text as new_performance,
      coalesce(
        sum(
          case when p.purchase_at <= $4 and p.is_reversed = false
               then p.usdt_amount end
        ), 0
      )::text as cumulative_performance
    from members m
    left join purchases p on p.wallet_address = m.w
    group by m.level
    order by m.level
    `,
    [wallet, maxDepth, dayStart, dayEnd],
  );

  for (const row of rows) {
    await upsertTeamLevelAggregate(db, {
      wallet_address: wallet,
      snapshot_date: snapshotDate,
      level: row.level,
      member_count: Number(row.member_count),
      active_count: Number(row.active_count),
      new_performance: row.new_performance,
      cumulative_performance: row.cumulative_performance,
    });
  }
}
