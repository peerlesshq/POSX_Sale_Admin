/**
 * `adjustment_records` repo — data access only.
 *
 * Adjustments are the only supported mechanism for correcting
 * financial outcomes after claimed history exists (01 §15, 07 §35).
 * This repo never overwrites an existing adjustment; it only inserts
 * rows and decrements `remaining_amount`.
 */
import type {
  AdjustmentDirection,
  AdjustmentStatus,
  AdjustmentType,
  AmountString,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface AdjustmentRecordRow {
  id: Uuid;
  wallet_address: WalletAddress;
  settlement_job_id: Uuid | null;
  adjustment_type: AdjustmentType;
  direction: AdjustmentDirection;
  amount: AmountString;
  remaining_amount: AmountString;
  settle_date: string | null;
  source_table: string | null;
  source_snapshot_id: Uuid | null;
  reason: string;
  status: AdjustmentStatus;
  created_by_admin_id: Uuid | null;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentRecordInsertInput {
  id?: Uuid;
  wallet_address: WalletAddress;
  settlement_job_id?: Uuid | null;
  adjustment_type: AdjustmentType;
  direction: AdjustmentDirection;
  amount: AmountString;
  remaining_amount?: AmountString;
  settle_date?: string | null;
  source_table?: string | null;
  source_snapshot_id?: Uuid | null;
  reason: string;
  status?: AdjustmentStatus;
  created_by_admin_id?: Uuid | null;
}

export async function insertAdjustmentRecord(
  db: DbClient,
  input: AdjustmentRecordInsertInput,
): Promise<AdjustmentRecordRow> {
  return db.queryRequired<AdjustmentRecordRow>(
    `insert into adjustment_records (
        id, wallet_address, settlement_job_id, adjustment_type, direction,
        amount, remaining_amount, settle_date, source_table, source_snapshot_id,
        reason, status, created_by_admin_id
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5, $6, coalesce($7, $6), $8, $9, $10,
        $11, coalesce($12, 'active'), $13
      )
      returning *`,
    [
      input.id ?? null,
      input.wallet_address,
      input.settlement_job_id ?? null,
      input.adjustment_type,
      input.direction,
      input.amount,
      input.remaining_amount ?? null,
      input.settle_date ?? null,
      input.source_table ?? null,
      input.source_snapshot_id ?? null,
      input.reason,
      input.status ?? null,
      input.created_by_admin_id ?? null,
    ],
  );
}

export async function decrementAdjustmentRemaining(
  db: DbClient,
  id: Uuid,
  consumed: AmountString,
): Promise<AdjustmentRecordRow> {
  // Decrement `remaining_amount` by `consumed`. Flip status to
  // `fully_offset` when it hits zero. Using the DB numeric type so
  // we don't round-trip through JS floats.
  return db.queryRequired<AdjustmentRecordRow>(
    `update adjustment_records
        set remaining_amount = remaining_amount - $2::numeric,
            status = case
              when remaining_amount - $2::numeric <= 0 then 'fully_offset'
              else status
            end
      where id = $1
        and status = 'active'
        and remaining_amount >= $2::numeric
      returning *`,
    [id, consumed],
  );
}

export async function listActiveAdjustmentsForWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<AdjustmentRecordRow[]> {
  return db.query<AdjustmentRecordRow>(
    `select * from adjustment_records
       where wallet_address = $1
         and status = 'active'
       order by created_at asc`,
    [wallet],
  );
}
