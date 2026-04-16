/**
 * `purchase_reversals` repo — data access only.
 *
 * Creating a reversal row must be paired with `purchases.is_reversed
 * = true` on the original purchase — the reversal SERVICE coordinates
 * both writes in one transaction. This repo only handles the
 * `purchase_reversals` row.
 */
import type {
  PurchaseReversalType,
  Uuid,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface PurchaseReversalRow {
  id: Uuid;
  purchase_id: Uuid;
  reversal_reason: string;
  reversal_type: PurchaseReversalType;
  reversed_by_admin_id: Uuid | null;
  approved_by_admin_id: Uuid | null;
  created_at: string;
  effective_at: string;
  notes: string | null;
}

export interface PurchaseReversalInsertInput {
  purchase_id: Uuid;
  reversal_reason: string;
  reversal_type: PurchaseReversalType;
  reversed_by_admin_id?: Uuid | null;
  approved_by_admin_id?: Uuid | null;
  effective_at: string;
  notes?: string | null;
}

export async function insertPurchaseReversal(
  db: DbClient,
  input: PurchaseReversalInsertInput,
): Promise<PurchaseReversalRow> {
  return db.queryRequired<PurchaseReversalRow>(
    `insert into purchase_reversals (
        purchase_id, reversal_reason, reversal_type,
        reversed_by_admin_id, approved_by_admin_id,
        effective_at, notes
      ) values ($1, $2, $3, $4, $5, $6, $7)
      returning *`,
    [
      input.purchase_id,
      input.reversal_reason,
      input.reversal_type,
      input.reversed_by_admin_id ?? null,
      input.approved_by_admin_id ?? null,
      input.effective_at,
      input.notes ?? null,
    ],
  );
}

export async function markPurchaseAsReversed(
  db: DbClient,
  purchaseId: Uuid,
): Promise<void> {
  await db.query(
    `update purchases set is_reversed = true where id = $1`,
    [purchaseId],
  );
}

export async function findReversalByPurchaseId(
  db: DbClient,
  purchaseId: Uuid,
): Promise<PurchaseReversalRow | null> {
  return db.queryOne<PurchaseReversalRow>(
    `select * from purchase_reversals where purchase_id = $1`,
    [purchaseId],
  );
}
