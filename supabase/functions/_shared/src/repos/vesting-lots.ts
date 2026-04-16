/**
 * `vesting_lots` repo — data access only.
 *
 * The lot model (01 §9) mandates one lot per confirmed purchase and
 * forbids weighted-average merging. Enforcement of that business rule
 * lives in the PurchaseFactService (Phase 4), not here.
 */
import type {
  AmountString,
  Uuid,
  VestingLotStatus,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface VestingLotRow {
  id: Uuid;
  wallet_address: WalletAddress;
  purchase_id: Uuid;
  total_locked: AmountString;
  start_time: string;
  lock_days: number;
  release_days: number;
  released_amount: AmountString;
  withdrawable_amount: AmountString;
  withdrawn_amount: AmountString;
  status: VestingLotStatus;
  created_at: string;
  updated_at: string;
}

export interface VestingLotInsertInput {
  id?: Uuid;
  wallet_address: WalletAddress;
  purchase_id: Uuid;
  total_locked: AmountString;
  start_time: string;
  lock_days: number;
  release_days: number;
  released_amount?: AmountString;
  withdrawable_amount?: AmountString;
  withdrawn_amount?: AmountString;
  status?: VestingLotStatus;
}

export async function insertVestingLot(
  db: DbClient,
  input: VestingLotInsertInput,
): Promise<VestingLotRow> {
  return db.queryRequired<VestingLotRow>(
    `insert into vesting_lots (
        id, wallet_address, purchase_id, total_locked, start_time,
        lock_days, release_days, released_amount, withdrawable_amount,
        withdrawn_amount, status
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5, $6, $7,
        coalesce($8, '0'), coalesce($9, '0'), coalesce($10, '0'),
        coalesce($11, 'active')
      )
      returning *`,
    [
      input.id ?? null,
      input.wallet_address,
      input.purchase_id,
      input.total_locked,
      input.start_time,
      input.lock_days,
      input.release_days,
      input.released_amount ?? null,
      input.withdrawable_amount ?? null,
      input.withdrawn_amount ?? null,
      input.status ?? null,
    ],
  );
}

export async function listVestingLotsByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<VestingLotRow[]> {
  return db.query<VestingLotRow>(
    `select * from vesting_lots
       where wallet_address = $1
       order by start_time asc`,
    [wallet],
  );
}

export async function sumCurrentLockedByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<AmountString> {
  const row = await db.queryOne<{ total: AmountString | null }>(
    `select coalesce(sum(total_locked - withdrawn_amount), 0)::text as total
       from vesting_lots
      where wallet_address = $1 and status <> 'voided'`,
    [wallet],
  );
  return row?.total ?? '0';
}
