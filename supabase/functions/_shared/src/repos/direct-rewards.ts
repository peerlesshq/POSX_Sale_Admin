/**
 * `direct_rewards` repo — data access only.
 *
 * Direct rewards are chain-backed facts (01 §5). This repo never
 * mutates an existing row — it only inserts new ones and reads them
 * back. Reversal of a linked purchase does NOT delete direct reward
 * rows (01 §5.5).
 */
import type {
  AmountString,
  RateString,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface DirectRewardRow {
  id: Uuid;
  from_wallet_address: WalletAddress;
  to_wallet_address: WalletAddress;
  purchase_id: Uuid | null;
  chain_id: number;
  tx_hash: TxHash;
  block_number: number;
  reward_rate: RateString | null;
  purchase_amount: AmountString;
  reward_amount: AmountString;
  rewarded_at: string;
  created_at: string;
}

export interface DirectRewardInsertInput {
  id?: Uuid;
  from_wallet_address: WalletAddress;
  to_wallet_address: WalletAddress;
  purchase_id?: Uuid | null;
  chain_id: number;
  tx_hash: TxHash;
  block_number: number;
  reward_rate?: RateString | null;
  purchase_amount: AmountString;
  reward_amount: AmountString;
  rewarded_at: string;
}

export async function insertDirectReward(
  db: DbClient,
  input: DirectRewardInsertInput,
): Promise<DirectRewardRow> {
  return db.queryRequired<DirectRewardRow>(
    `insert into direct_rewards (
        id, from_wallet_address, to_wallet_address, purchase_id,
        chain_id, tx_hash, block_number, reward_rate,
        purchase_amount, reward_amount, rewarded_at
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      returning *`,
    [
      input.id ?? null,
      input.from_wallet_address,
      input.to_wallet_address,
      input.purchase_id ?? null,
      input.chain_id,
      input.tx_hash,
      input.block_number,
      input.reward_rate ?? null,
      input.purchase_amount,
      input.reward_amount,
      input.rewarded_at,
    ],
  );
}

export async function listDirectRewardsByRecipient(
  db: DbClient,
  wallet: WalletAddress,
): Promise<DirectRewardRow[]> {
  return db.query<DirectRewardRow>(
    `select * from direct_rewards
       where to_wallet_address = $1
       order by rewarded_at desc`,
    [wallet],
  );
}

export async function sumDirectRewardsByRecipient(
  db: DbClient,
  wallet: WalletAddress,
): Promise<AmountString> {
  const row = await db.queryOne<{ total: AmountString | null }>(
    `select coalesce(sum(reward_amount), 0)::text as total
       from direct_rewards
      where to_wallet_address = $1`,
    [wallet],
  );
  return row?.total ?? '0';
}
