/**
 * `user_reward_summary` repo — data access only.
 *
 * THIS TABLE IS A DERIVED SUMMARY. Seed scripts must not write into
 * it directly as business truth. The supported path is: insert all
 * source-of-truth rows, then invoke the rebuilder in
 * `../rebuilders/user-reward-summary.ts`.
 *
 * This repo exposes only `upsert` (used by the rebuilder) and simple
 * reads.
 */
import type { AmountString, WalletAddress } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface UserRewardSummaryRow {
  wallet_address: WalletAddress;
  direct_total: AmountString;
  team_total: AmountString;
  equal_level_total: AmountString;
  adjustment_credit_total: AmountString;
  adjustment_debit_remaining: AmountString;
  claimable_total: AmountString;
  burned_total: AmountString;
  updated_at: string;
}

export interface UserRewardSummaryUpsertInput {
  wallet_address: WalletAddress;
  direct_total: AmountString;
  team_total: AmountString;
  equal_level_total: AmountString;
  adjustment_credit_total: AmountString;
  adjustment_debit_remaining: AmountString;
  claimable_total: AmountString;
  burned_total: AmountString;
}

export async function upsertUserRewardSummary(
  db: DbClient,
  input: UserRewardSummaryUpsertInput,
): Promise<UserRewardSummaryRow> {
  return db.queryRequired<UserRewardSummaryRow>(
    `insert into user_reward_summary (
        wallet_address, direct_total, team_total, equal_level_total,
        adjustment_credit_total, adjustment_debit_remaining,
        claimable_total, burned_total
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (wallet_address) do update
        set direct_total              = excluded.direct_total,
            team_total                 = excluded.team_total,
            equal_level_total          = excluded.equal_level_total,
            adjustment_credit_total    = excluded.adjustment_credit_total,
            adjustment_debit_remaining = excluded.adjustment_debit_remaining,
            claimable_total            = excluded.claimable_total,
            burned_total               = excluded.burned_total
      returning *`,
    [
      input.wallet_address,
      input.direct_total,
      input.team_total,
      input.equal_level_total,
      input.adjustment_credit_total,
      input.adjustment_debit_remaining,
      input.claimable_total,
      input.burned_total,
    ],
  );
}

export async function findUserRewardSummary(
  db: DbClient,
  wallet: WalletAddress,
): Promise<UserRewardSummaryRow | null> {
  return db.queryOne<UserRewardSummaryRow>(
    `select * from user_reward_summary where wallet_address = $1`,
    [wallet],
  );
}
