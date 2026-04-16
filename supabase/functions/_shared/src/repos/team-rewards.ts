/**
 * Team reward daily snapshot + line detail repo — data access only.
 *
 * Computation of `raw_total`, `burned_amount`, `actual_total`, and
 * per-line details happens in the settlement orchestrator (Phase 4),
 * using domain-rules functions. This repo just stores the numbers
 * the orchestrator has already computed.
 */
import type {
  AmountString,
  RateString,
  RewardSnapshotStatus,
  TierCode,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- team_rewards_daily ----------

export interface TeamRewardDailyRow {
  id: Uuid;
  settlement_job_id: Uuid;
  wallet_address: WalletAddress;
  settle_date: string;
  qualification_tier: TierCode;
  user_team_rate: RateString;
  team_total_performance: AmountString;
  effective_performance: AmountString;
  raw_total: AmountString;
  burned_amount: AmountString;
  actual_total: AmountString;
  status: RewardSnapshotStatus;
  claim_tx_hash: TxHash | null;
  claim_order_id: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRewardDailyInsertInput {
  id?: Uuid;
  settlement_job_id: Uuid;
  wallet_address: WalletAddress;
  settle_date: string;
  qualification_tier: TierCode;
  user_team_rate: RateString;
  team_total_performance: AmountString;
  effective_performance: AmountString;
  raw_total: AmountString;
  burned_amount: AmountString;
  actual_total: AmountString;
  status?: RewardSnapshotStatus;
}

export async function insertTeamRewardDaily(
  db: DbClient,
  input: TeamRewardDailyInsertInput,
): Promise<TeamRewardDailyRow> {
  return db.queryRequired<TeamRewardDailyRow>(
    `insert into team_rewards_daily (
        id, settlement_job_id, wallet_address, settle_date,
        qualification_tier, user_team_rate,
        team_total_performance, effective_performance,
        raw_total, burned_amount, actual_total, status
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        coalesce($12, 'claimable')
      )
      returning *`,
    [
      input.id ?? null,
      input.settlement_job_id,
      input.wallet_address,
      input.settle_date,
      input.qualification_tier,
      input.user_team_rate,
      input.team_total_performance,
      input.effective_performance,
      input.raw_total,
      input.burned_amount,
      input.actual_total,
      input.status ?? null,
    ],
  );
}

export async function listClaimableTeamRewardsByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<TeamRewardDailyRow[]> {
  return db.query<TeamRewardDailyRow>(
    `select * from team_rewards_daily
       where wallet_address = $1
         and status = 'claimable'
         and claim_order_id is null
       order by settle_date asc`,
    [wallet],
  );
}

export async function lockTeamRewardToClaimOrder(
  db: DbClient,
  id: Uuid,
  claimOrderId: Uuid,
): Promise<void> {
  await db.query(
    `update team_rewards_daily
        set claim_order_id = $2
      where id = $1
        and claim_order_id is null
        and status = 'claimable'`,
    [id, claimOrderId],
  );
}

export async function releaseTeamRewardLock(
  db: DbClient,
  claimOrderId: Uuid,
): Promise<void> {
  await db.query(
    `update team_rewards_daily
        set claim_order_id = null
      where claim_order_id = $1
        and status = 'claimable'`,
    [claimOrderId],
  );
}

export async function markTeamRewardClaimed(
  db: DbClient,
  id: Uuid,
  txHash: TxHash,
): Promise<void> {
  await db.query(
    `update team_rewards_daily
        set status = 'claimed',
            claim_tx_hash = $2
      where id = $1`,
    [id, txHash],
  );
}

// ---------- team_reward_line_details ----------

export interface TeamRewardLineDetailRow {
  id: Uuid;
  team_reward_daily_id: Uuid;
  line_root_wallet_address: WalletAddress;
  line_effective_performance: AmountString;
  subordinate_team_rate: RateString;
  differential_rate: RateString;
  raw_reward_amount: AmountString;
  equal_level_replaced: boolean;
  created_at: string;
}

export interface TeamRewardLineDetailInsertInput {
  team_reward_daily_id: Uuid;
  line_root_wallet_address: WalletAddress;
  line_effective_performance: AmountString;
  subordinate_team_rate: RateString;
  differential_rate: RateString;
  raw_reward_amount: AmountString;
  equal_level_replaced?: boolean;
}

export async function insertTeamRewardLineDetail(
  db: DbClient,
  input: TeamRewardLineDetailInsertInput,
): Promise<TeamRewardLineDetailRow> {
  return db.queryRequired<TeamRewardLineDetailRow>(
    `insert into team_reward_line_details (
        team_reward_daily_id, line_root_wallet_address,
        line_effective_performance, subordinate_team_rate,
        differential_rate, raw_reward_amount, equal_level_replaced
      ) values ($1, $2, $3, $4, $5, $6, coalesce($7, false))
      returning *`,
    [
      input.team_reward_daily_id,
      input.line_root_wallet_address,
      input.line_effective_performance,
      input.subordinate_team_rate,
      input.differential_rate,
      input.raw_reward_amount,
      input.equal_level_replaced ?? null,
    ],
  );
}

export async function listTeamRewardLineDetails(
  db: DbClient,
  teamRewardDailyId: Uuid,
): Promise<TeamRewardLineDetailRow[]> {
  return db.query<TeamRewardLineDetailRow>(
    `select * from team_reward_line_details
       where team_reward_daily_id = $1
       order by line_root_wallet_address`,
    [teamRewardDailyId],
  );
}
