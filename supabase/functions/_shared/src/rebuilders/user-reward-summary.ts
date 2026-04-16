/**
 * `user_reward_summary` rebuilder.
 *
 * Constraint from Phase 2: derived summary tables must NOT be
 * hand-seeded. This module is the only supported path for populating
 * `user_reward_summary` rows. Seed scripts call it after they finish
 * inserting source-of-truth facts.
 *
 * Formula (11 §21.2):
 *   - direct_total              = Σ direct_rewards.reward_amount (to this wallet)
 *   - team_total                = Σ team_rewards_daily.actual_total (this wallet)
 *   - equal_level_total         = Σ equal_level_rewards_daily.actual_amount (this wallet)
 *   - burned_total              = Σ burn_records.burned_amount (this wallet)
 *   - adjustment_credit_total   = Σ adjustment_records.amount
 *                                   where direction='credit' and status in ('active','fully_offset')
 *   - adjustment_debit_remaining= Σ adjustment_records.remaining_amount
 *                                   where direction='debit' and status='active'
 *   - claimable_total           = Σ team_rewards_daily.actual_total where status='claimable'
 *                               + Σ equal_level_rewards_daily.actual_amount where status='claimable'
 *                               + adjustment_credit_remaining_active (credits still usable)
 *                               - adjustment_debit_remaining
 *
 * `claimable_total` is clamped at zero (the debit offset cannot push
 * a user below zero claimable — any overflow stays as outstanding
 * debit remaining).
 */
import type { AmountString, WalletAddress } from '@posx/shared-types';
import { addAmount, maxAmount, subAmount, ZERO_AMOUNT } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { upsertUserRewardSummary } from '../repos/user-reward-summary';

interface AggregateRow {
  wallet_address: WalletAddress;
  direct_total: AmountString;
  team_total: AmountString;
  equal_level_total: AmountString;
  burned_total: AmountString;
  adjustment_credit_total: AmountString;
  adjustment_debit_remaining: AmountString;
  team_claimable_total: AmountString;
  equal_level_claimable_total: AmountString;
  adjustment_credit_remaining_active: AmountString;
}

/**
 * Rebuild `user_reward_summary` for one wallet. Returns the resulting
 * row so callers can log or assert against it.
 */
export async function rebuildUserRewardSummaryFor(
  db: DbClient,
  wallet: WalletAddress,
): Promise<void> {
  const row = await db.queryOne<AggregateRow>(
    `
    with
      direct as (
        select coalesce(sum(reward_amount), 0)::text as total
          from direct_rewards
         where to_wallet_address = $1
      ),
      team_all as (
        select coalesce(sum(actual_total), 0)::text as total
          from team_rewards_daily
         where wallet_address = $1
           and status <> 'voided'
      ),
      team_claimable as (
        select coalesce(sum(actual_total), 0)::text as total
          from team_rewards_daily
         where wallet_address = $1
           and status = 'claimable'
      ),
      equal_all as (
        select coalesce(sum(actual_amount), 0)::text as total
          from equal_level_rewards_daily
         where wallet_address = $1
           and status <> 'voided'
      ),
      equal_claimable as (
        select coalesce(sum(actual_amount), 0)::text as total
          from equal_level_rewards_daily
         where wallet_address = $1
           and status = 'claimable'
      ),
      burns as (
        select coalesce(sum(burned_amount), 0)::text as total
          from burn_records
         where wallet_address = $1
      ),
      adj_credit_total as (
        select coalesce(sum(amount), 0)::text as total
          from adjustment_records
         where wallet_address = $1
           and direction = 'credit'
           and status in ('active','fully_offset')
      ),
      adj_credit_active as (
        select coalesce(sum(remaining_amount), 0)::text as total
          from adjustment_records
         where wallet_address = $1
           and direction = 'credit'
           and status = 'active'
      ),
      adj_debit_active as (
        select coalesce(sum(remaining_amount), 0)::text as total
          from adjustment_records
         where wallet_address = $1
           and direction = 'debit'
           and status = 'active'
      )
    select
      $1::text                               as wallet_address,
      (select total from direct)             as direct_total,
      (select total from team_all)           as team_total,
      (select total from equal_all)          as equal_level_total,
      (select total from burns)              as burned_total,
      (select total from adj_credit_total)   as adjustment_credit_total,
      (select total from adj_debit_active)   as adjustment_debit_remaining,
      (select total from team_claimable)     as team_claimable_total,
      (select total from equal_claimable)    as equal_level_claimable_total,
      (select total from adj_credit_active)  as adjustment_credit_remaining_active
    `,
    [wallet],
  );

  if (!row) {
    // Wallet has no activity at all — write a zeroed row so the
    // summary stays queryable without `coalesce`s in callers.
    await upsertUserRewardSummary(db, {
      wallet_address: wallet,
      direct_total: ZERO_AMOUNT,
      team_total: ZERO_AMOUNT,
      equal_level_total: ZERO_AMOUNT,
      adjustment_credit_total: ZERO_AMOUNT,
      adjustment_debit_remaining: ZERO_AMOUNT,
      claimable_total: ZERO_AMOUNT,
      burned_total: ZERO_AMOUNT,
    });
    return;
  }

  const claimablePositive = addAmount(
    addAmount(row.team_claimable_total, row.equal_level_claimable_total),
    row.adjustment_credit_remaining_active,
  );
  const claimableAfterDebit = subAmount(claimablePositive, row.adjustment_debit_remaining);
  const claimableClamped = maxAmount(claimableAfterDebit, ZERO_AMOUNT);

  await upsertUserRewardSummary(db, {
    wallet_address: wallet,
    direct_total: row.direct_total,
    team_total: row.team_total,
    equal_level_total: row.equal_level_total,
    adjustment_credit_total: row.adjustment_credit_total,
    adjustment_debit_remaining: row.adjustment_debit_remaining,
    claimable_total: claimableClamped,
    burned_total: row.burned_total,
  });
}

/**
 * Rebuild `user_reward_summary` for every wallet that currently has
 * any reward-related row. Used by the seed script after source rows
 * are inserted.
 */
export async function rebuildUserRewardSummaryAll(db: DbClient): Promise<void> {
  const wallets = await db.query<{ wallet_address: WalletAddress }>(
    `
    select distinct wallet_address from (
      select to_wallet_address as wallet_address from direct_rewards
      union
      select wallet_address from team_rewards_daily
      union
      select wallet_address from equal_level_rewards_daily
      union
      select wallet_address from burn_records
      union
      select wallet_address from adjustment_records
    ) as involved
    `,
  );

  for (const { wallet_address } of wallets) {
    await rebuildUserRewardSummaryFor(db, wallet_address);
  }
}
