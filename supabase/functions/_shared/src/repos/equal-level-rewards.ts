/**
 * `equal_level_rewards_daily` repo — data access only.
 */
import type {
  AmountString,
  RateString,
  RewardSnapshotStatus,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface EqualLevelRewardRow {
  id: Uuid;
  settlement_job_id: Uuid;
  wallet_address: WalletAddress;
  line_root_wallet_address: WalletAddress;
  settle_date: string;
  equal_level_rate: RateString;
  subordinate_team_total_performance: AmountString;
  line_effective_performance: AmountString;
  raw_amount: AmountString;
  burned_amount: AmountString;
  actual_amount: AmountString;
  status: RewardSnapshotStatus;
  claim_order_id: Uuid | null;
  claim_tx_hash: TxHash | null;
  created_at: string;
  updated_at: string;
}

export interface EqualLevelRewardInsertInput {
  id?: Uuid;
  settlement_job_id: Uuid;
  wallet_address: WalletAddress;
  line_root_wallet_address: WalletAddress;
  settle_date: string;
  equal_level_rate: RateString;
  subordinate_team_total_performance: AmountString;
  line_effective_performance: AmountString;
  raw_amount: AmountString;
  burned_amount: AmountString;
  actual_amount: AmountString;
  status?: RewardSnapshotStatus;
}

export async function insertEqualLevelReward(
  db: DbClient,
  input: EqualLevelRewardInsertInput,
): Promise<EqualLevelRewardRow> {
  return db.queryRequired<EqualLevelRewardRow>(
    `insert into equal_level_rewards_daily (
        id, settlement_job_id, wallet_address, line_root_wallet_address,
        settle_date, equal_level_rate,
        subordinate_team_total_performance, line_effective_performance,
        raw_amount, burned_amount, actual_amount, status
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
      input.line_root_wallet_address,
      input.settle_date,
      input.equal_level_rate,
      input.subordinate_team_total_performance,
      input.line_effective_performance,
      input.raw_amount,
      input.burned_amount,
      input.actual_amount,
      input.status ?? null,
    ],
  );
}

export async function listClaimableEqualLevelRewardsByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<EqualLevelRewardRow[]> {
  return db.query<EqualLevelRewardRow>(
    `select * from equal_level_rewards_daily
       where wallet_address = $1
         and status = 'claimable'
         and claim_order_id is null
       order by settle_date asc`,
    [wallet],
  );
}

export async function lockEqualLevelRewardToClaimOrder(
  db: DbClient,
  id: Uuid,
  claimOrderId: Uuid,
): Promise<void> {
  await db.query(
    `update equal_level_rewards_daily
        set claim_order_id = $2
      where id = $1
        and claim_order_id is null
        and status = 'claimable'`,
    [id, claimOrderId],
  );
}

export async function markEqualLevelRewardClaimed(
  db: DbClient,
  id: Uuid,
  txHash: TxHash,
): Promise<void> {
  await db.query(
    `update equal_level_rewards_daily
        set status = 'claimed',
            claim_tx_hash = $2
      where id = $1`,
    [id, txHash],
  );
}
