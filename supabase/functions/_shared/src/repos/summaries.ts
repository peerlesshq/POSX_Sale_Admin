/**
 * Derived summary table repos — data access only.
 *
 * EVERY function in this module is an upsert that only the
 * rebuilders in `../rebuilders/` call. Seed scripts and services
 * must NOT write here directly.
 */
import type {
  AmountString,
  RateString,
  TierCode,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- user_vesting_summary ----------

export interface UserVestingSummaryRow {
  wallet_address: WalletAddress;
  total_locked: AmountString;
  total_released: AmountString;
  total_withdrawable: AmountString;
  total_withdrawn: AmountString;
  updated_at: string;
}

export async function upsertUserVestingSummary(
  db: DbClient,
  input: {
    wallet_address: WalletAddress;
    total_locked: AmountString;
    total_released: AmountString;
    total_withdrawable: AmountString;
    total_withdrawn: AmountString;
  },
): Promise<UserVestingSummaryRow> {
  return db.queryRequired<UserVestingSummaryRow>(
    `insert into user_vesting_summary (
        wallet_address, total_locked, total_released,
        total_withdrawable, total_withdrawn
      ) values ($1, $2, $3, $4, $5)
      on conflict (wallet_address) do update
        set total_locked       = excluded.total_locked,
            total_released     = excluded.total_released,
            total_withdrawable = excluded.total_withdrawable,
            total_withdrawn    = excluded.total_withdrawn
      returning *`,
    [
      input.wallet_address,
      input.total_locked,
      input.total_released,
      input.total_withdrawable,
      input.total_withdrawn,
    ],
  );
}

export async function findUserVestingSummary(
  db: DbClient,
  wallet: WalletAddress,
): Promise<UserVestingSummaryRow | null> {
  return db.queryOne<UserVestingSummaryRow>(
    `select * from user_vesting_summary where wallet_address = $1`,
    [wallet],
  );
}

// ---------- team_performance_snapshot ----------

export interface TeamPerformanceSnapshotRow {
  id: Uuid;
  wallet_address: WalletAddress;
  snapshot_date: string;
  team_total_performance: AmountString;
  effective_performance: AmountString;
  team_rate: RateString;
  tier: TierCode | string;
  updated_at: string;
}

export async function upsertTeamPerformanceSnapshot(
  db: DbClient,
  input: {
    wallet_address: WalletAddress;
    snapshot_date: string;
    team_total_performance: AmountString;
    effective_performance: AmountString;
    team_rate: RateString;
    tier: string;
  },
): Promise<TeamPerformanceSnapshotRow> {
  return db.queryRequired<TeamPerformanceSnapshotRow>(
    `insert into team_performance_snapshot (
        wallet_address, snapshot_date, team_total_performance,
        effective_performance, team_rate, tier
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (wallet_address, snapshot_date) do update
        set team_total_performance = excluded.team_total_performance,
            effective_performance  = excluded.effective_performance,
            team_rate              = excluded.team_rate,
            tier                   = excluded.tier
      returning *`,
    [
      input.wallet_address,
      input.snapshot_date,
      input.team_total_performance,
      input.effective_performance,
      input.team_rate,
      input.tier,
    ],
  );
}

// ---------- team_level_aggregate_daily ----------

export async function upsertTeamLevelAggregate(
  db: DbClient,
  input: {
    wallet_address: WalletAddress;
    snapshot_date: string;
    level: number;
    member_count: number;
    active_count: number;
    new_performance: AmountString;
    cumulative_performance: AmountString;
  },
): Promise<void> {
  await db.query(
    `insert into team_level_aggregate_daily (
        wallet_address, snapshot_date, level,
        member_count, active_count, new_performance, cumulative_performance
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (wallet_address, snapshot_date, level) do update
        set member_count           = excluded.member_count,
            active_count           = excluded.active_count,
            new_performance        = excluded.new_performance,
            cumulative_performance = excluded.cumulative_performance`,
    [
      input.wallet_address,
      input.snapshot_date,
      input.level,
      input.member_count,
      input.active_count,
      input.new_performance,
      input.cumulative_performance,
    ],
  );
}

// ---------- dashboard_daily_summary ----------

export async function upsertDashboardDailySummary(
  db: DbClient,
  input: {
    summary_date: string;
    new_users_count: number;
    new_buyers_count: number;
    purchase_count: number;
    deposit_total: AmountString;
    direct_reward_total: AmountString;
    team_reward_total: AmountString;
    equal_level_reward_total: AmountString;
    burn_total: AmountString;
    claim_total: AmountString;
  },
): Promise<void> {
  await db.query(
    `insert into dashboard_daily_summary (
        summary_date, new_users_count, new_buyers_count, purchase_count,
        deposit_total, direct_reward_total, team_reward_total,
        equal_level_reward_total, burn_total, claim_total
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (summary_date) do update
        set new_users_count          = excluded.new_users_count,
            new_buyers_count         = excluded.new_buyers_count,
            purchase_count           = excluded.purchase_count,
            deposit_total            = excluded.deposit_total,
            direct_reward_total      = excluded.direct_reward_total,
            team_reward_total        = excluded.team_reward_total,
            equal_level_reward_total = excluded.equal_level_reward_total,
            burn_total               = excluded.burn_total,
            claim_total              = excluded.claim_total`,
    [
      input.summary_date,
      input.new_users_count,
      input.new_buyers_count,
      input.purchase_count,
      input.deposit_total,
      input.direct_reward_total,
      input.team_reward_total,
      input.equal_level_reward_total,
      input.burn_total,
      input.claim_total,
    ],
  );
}
