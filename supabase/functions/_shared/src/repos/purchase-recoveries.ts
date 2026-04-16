/**
 * `purchase_recoveries` repo — data access only.
 */
import type {
  PurchaseRecoveryStatus,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface PurchaseRecoveryRow {
  id: Uuid;
  purchase_order_id: Uuid | null;
  wallet_address: WalletAddress;
  tx_hash: TxHash;
  status: PurchaseRecoveryStatus;
  resolved_purchase_id: Uuid | null;
  failure_reason: string | null;
  requested_at: string;
  resolved_at: string | null;
}

export interface PurchaseRecoveryInsertInput {
  wallet_address: WalletAddress;
  tx_hash: TxHash;
  purchase_order_id?: Uuid | null;
  status?: PurchaseRecoveryStatus;
}

export async function insertPurchaseRecovery(
  db: DbClient,
  input: PurchaseRecoveryInsertInput,
): Promise<PurchaseRecoveryRow> {
  return db.queryRequired<PurchaseRecoveryRow>(
    `insert into purchase_recoveries (
        wallet_address, tx_hash, purchase_order_id, status
      ) values ($1, $2, $3, coalesce($4, 'requested'))
      returning *`,
    [
      input.wallet_address,
      input.tx_hash,
      input.purchase_order_id ?? null,
      input.status ?? null,
    ],
  );
}

export async function resolvePurchaseRecovery(
  db: DbClient,
  id: Uuid,
  resolvedPurchaseId: Uuid,
  resolvedAt: string,
): Promise<PurchaseRecoveryRow> {
  return db.queryRequired<PurchaseRecoveryRow>(
    `update purchase_recoveries
        set status = 'resolved',
            resolved_purchase_id = $2,
            resolved_at = $3
      where id = $1
      returning *`,
    [id, resolvedPurchaseId, resolvedAt],
  );
}

export async function failPurchaseRecovery(
  db: DbClient,
  id: Uuid,
  reason: string,
  resolvedAt: string,
): Promise<PurchaseRecoveryRow> {
  return db.queryRequired<PurchaseRecoveryRow>(
    `update purchase_recoveries
        set status = 'failed',
            failure_reason = $2,
            resolved_at = $3
      where id = $1
      returning *`,
    [id, reason, resolvedAt],
  );
}

export async function markPurchaseRecoveryDuplicate(
  db: DbClient,
  id: Uuid,
  resolvedAt: string,
): Promise<PurchaseRecoveryRow> {
  return db.queryRequired<PurchaseRecoveryRow>(
    `update purchase_recoveries
        set status = 'duplicate',
            resolved_at = $2
      where id = $1
      returning *`,
    [id, resolvedAt],
  );
}

export async function findPurchaseRecoveryByTxHash(
  db: DbClient,
  txHash: TxHash,
): Promise<PurchaseRecoveryRow | null> {
  return db.queryOne<PurchaseRecoveryRow>(
    `select * from purchase_recoveries where tx_hash = $1
       order by requested_at desc limit 1`,
    [txHash],
  );
}
