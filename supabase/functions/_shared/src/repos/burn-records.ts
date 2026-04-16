/**
 * `burn_records` repo — data access only.
 *
 * Burn ledger rows are immutable. This repo only inserts and reads.
 */
import type {
  AmountString,
  BurnRewardType,
  BurnSourceTable,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface BurnRecordRow {
  id: Uuid;
  wallet_address: WalletAddress;
  reward_type: BurnRewardType;
  source_snapshot_id: Uuid;
  source_table: BurnSourceTable;
  settle_date: string;
  holding_value_at_snapshot: AmountString;
  used_burn_capacity_before: AmountString;
  burn_cap: AmountString;
  raw_amount: AmountString;
  burned_amount: AmountString;
  actual_amount: AmountString;
  reason: string;
  created_at: string;
}

export interface BurnRecordInsertInput {
  id?: Uuid;
  wallet_address: WalletAddress;
  reward_type: BurnRewardType;
  source_snapshot_id: Uuid;
  source_table: BurnSourceTable;
  settle_date: string;
  holding_value_at_snapshot: AmountString;
  used_burn_capacity_before: AmountString;
  burn_cap: AmountString;
  raw_amount: AmountString;
  burned_amount: AmountString;
  actual_amount: AmountString;
  reason: string;
}

export async function insertBurnRecord(
  db: DbClient,
  input: BurnRecordInsertInput,
): Promise<BurnRecordRow> {
  return db.queryRequired<BurnRecordRow>(
    `insert into burn_records (
        id, wallet_address, reward_type, source_snapshot_id, source_table,
        settle_date, holding_value_at_snapshot, used_burn_capacity_before,
        burn_cap, raw_amount, burned_amount, actual_amount, reason
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      returning *`,
    [
      input.id ?? null,
      input.wallet_address,
      input.reward_type,
      input.source_snapshot_id,
      input.source_table,
      input.settle_date,
      input.holding_value_at_snapshot,
      input.used_burn_capacity_before,
      input.burn_cap,
      input.raw_amount,
      input.burned_amount,
      input.actual_amount,
      input.reason,
    ],
  );
}

export async function listBurnRecordsByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<BurnRecordRow[]> {
  return db.query<BurnRecordRow>(
    `select * from burn_records
       where wallet_address = $1
       order by settle_date desc, created_at desc`,
    [wallet],
  );
}

export async function sumBurnedByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<AmountString> {
  const row = await db.queryOne<{ total: AmountString | null }>(
    `select coalesce(sum(burned_amount), 0)::text as total
       from burn_records
      where wallet_address = $1`,
    [wallet],
  );
  return row?.total ?? '0';
}
