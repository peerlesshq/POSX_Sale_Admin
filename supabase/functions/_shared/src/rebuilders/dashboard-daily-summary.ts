/**
 * `dashboard_daily_summary` rebuilder (constraint 5).
 *
 * Populates one row per UTC calendar date using the exact formulas
 * defined in 11_reporting_and_metrics_definition.md §21.1:
 *   - new_users_count            = count(users where created_at in day)
 *   - new_buyers_count           = count(distinct wallets whose first
 *                                  confirmed purchase lands in day)
 *   - purchase_count             = count(purchases where purchase_at in
 *                                  day and is_reversed = false)
 *   - deposit_total              = sum(usdt_amount) same filter
 *   - direct_reward_total        = sum(direct_rewards.reward_amount)
 *                                  where rewarded_at in day
 *   - team_reward_total          = sum(team_rewards_daily.actual_total)
 *                                  where settle_date = day
 *   - equal_level_reward_total   = sum(equal_level_rewards_daily
 *                                  .actual_amount) where settle_date = day
 *   - burn_total                 = sum(burn_records.burned_amount)
 *                                  where settle_date = day
 *   - claim_total                = sum(claim_records.amount)
 *                                  where status='confirmed' and
 *                                  recorded_at in day
 */
import type { UtcDate } from '@posx/shared-types';
import { utcDayEnd, utcDayStart } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { upsertDashboardDailySummary } from '../repos/summaries';

export async function rebuildDashboardDailySummaryFor(
  db: DbClient,
  date: UtcDate,
): Promise<void> {
  const dayStart = utcDayStart(date);
  const dayEnd = utcDayEnd(date);

  const row = await db.queryOne<{
    new_users_count: number;
    new_buyers_count: number;
    purchase_count: number;
    deposit_total: string;
    direct_reward_total: string;
    team_reward_total: string;
    equal_level_reward_total: string;
    burn_total: string;
    claim_total: string;
  }>(
    `
    select
      (select count(*)::int from users
         where created_at between $1 and $2)                           as new_users_count,
      (select count(*)::int from (
          select wallet_address, min(purchase_at) as first_pa
            from purchases where is_reversed = false
           group by wallet_address
         ) f where f.first_pa between $1 and $2)                       as new_buyers_count,
      (select count(*)::int from purchases
         where is_reversed = false
           and purchase_at between $1 and $2)                          as purchase_count,
      (select coalesce(sum(usdt_amount), 0)::text from purchases
         where is_reversed = false
           and purchase_at between $1 and $2)                          as deposit_total,
      (select coalesce(sum(reward_amount), 0)::text from direct_rewards
         where rewarded_at between $1 and $2)                          as direct_reward_total,
      (select coalesce(sum(actual_total), 0)::text from team_rewards_daily
         where settle_date = $3)                                       as team_reward_total,
      (select coalesce(sum(actual_amount), 0)::text from equal_level_rewards_daily
         where settle_date = $3)                                       as equal_level_reward_total,
      (select coalesce(sum(burned_amount), 0)::text from burn_records
         where settle_date = $3)                                       as burn_total,
      (select coalesce(sum(amount), 0)::text from claim_records
         where status = 'confirmed' and recorded_at between $1 and $2) as claim_total
    `,
    [dayStart, dayEnd, date],
  );

  await upsertDashboardDailySummary(db, {
    summary_date: date,
    new_users_count: Number(row?.new_users_count ?? 0),
    new_buyers_count: Number(row?.new_buyers_count ?? 0),
    purchase_count: Number(row?.purchase_count ?? 0),
    deposit_total: row?.deposit_total ?? '0',
    direct_reward_total: row?.direct_reward_total ?? '0',
    team_reward_total: row?.team_reward_total ?? '0',
    equal_level_reward_total: row?.equal_level_reward_total ?? '0',
    burn_total: row?.burn_total ?? '0',
    claim_total: row?.claim_total ?? '0',
  });
}
