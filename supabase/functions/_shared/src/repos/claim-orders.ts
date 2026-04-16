/**
 * Claim order + claim order item + claim record repos — data access
 * only.
 *
 * Snapshot locking semantics (setting/clearing `claim_order_id`) live
 * in the team-rewards / equal-level-rewards repos because the lock
 * state is carried on those tables, not here.
 */
import type {
  AmountString,
  ClaimItemRewardType,
  ClaimItemSourceTable,
  ClaimOrderScope,
  ClaimOrderStatus,
  ClaimRecordStatus,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- claim_orders ----------

export interface ClaimOrderRow {
  id: Uuid;
  wallet_address: WalletAddress;
  client_request_id: string;
  status: ClaimOrderStatus;
  claim_scope: ClaimOrderScope;
  requested_total_amount: AmountString;
  signed_message: string | null;
  signed_at: string | null;
  queued_at: string | null;
  broadcast_tx_hash: TxHash | null;
  broadcasted_at: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimOrderInsertInput {
  id?: Uuid;
  wallet_address: WalletAddress;
  client_request_id: string;
  status?: ClaimOrderStatus;
  claim_scope?: ClaimOrderScope;
  requested_total_amount: AmountString;
}

export async function insertClaimOrder(
  db: DbClient,
  input: ClaimOrderInsertInput,
): Promise<ClaimOrderRow> {
  return db.queryRequired<ClaimOrderRow>(
    `insert into claim_orders (
        id, wallet_address, client_request_id, status, claim_scope,
        requested_total_amount
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, coalesce($4, 'pending_signature'),
        coalesce($5, 'claim_all'), $6
      )
      returning *`,
    [
      input.id ?? null,
      input.wallet_address,
      input.client_request_id,
      input.status ?? null,
      input.claim_scope ?? null,
      input.requested_total_amount,
    ],
  );
}

/**
 * Persist the canonical `messageToSign` on the row at preparation
 * time. BE-35/36/89 — the preparation service used to return the
 * message without persisting it, and the router then re-derived it
 * from this column (which was always NULL), effectively handing the
 * verifier an empty string. Writing it here, inside the preparation
 * transaction, is the minimum correct fix.
 */
export async function persistClaimOrderSignedMessage(
  db: DbClient,
  id: Uuid,
  message: string,
): Promise<ClaimOrderRow> {
  return db.queryRequired<ClaimOrderRow>(
    `update claim_orders
        set signed_message = $2
      where id = $1
      returning *`,
    [id, message],
  );
}

export async function updateClaimOrderStatus(
  db: DbClient,
  id: Uuid,
  status: ClaimOrderStatus,
  timestamps: {
    signed_at?: string | null;
    queued_at?: string | null;
    broadcasted_at?: string | null;
    broadcast_tx_hash?: TxHash | null;
    confirmed_at?: string | null;
    failed_at?: string | null;
    failure_reason?: string | null;
    signed_message?: string | null;
  } = {},
): Promise<ClaimOrderRow> {
  return db.queryRequired<ClaimOrderRow>(
    `update claim_orders
        set status = $2,
            signed_message = coalesce($3, signed_message),
            signed_at = coalesce($4, signed_at),
            queued_at = coalesce($5, queued_at),
            broadcast_tx_hash = coalesce($6, broadcast_tx_hash),
            broadcasted_at = coalesce($7, broadcasted_at),
            confirmed_at = coalesce($8, confirmed_at),
            failed_at = coalesce($9, failed_at),
            failure_reason = coalesce($10, failure_reason)
      where id = $1
      returning *`,
    [
      id,
      status,
      timestamps.signed_message ?? null,
      timestamps.signed_at ?? null,
      timestamps.queued_at ?? null,
      timestamps.broadcast_tx_hash ?? null,
      timestamps.broadcasted_at ?? null,
      timestamps.confirmed_at ?? null,
      timestamps.failed_at ?? null,
      timestamps.failure_reason ?? null,
    ],
  );
}

// ---------- claim_order_items ----------

export interface ClaimOrderItemRow {
  id: Uuid;
  claim_order_id: Uuid;
  reward_type: ClaimItemRewardType;
  source_table: ClaimItemSourceTable;
  source_snapshot_id: Uuid;
  amount: AmountString;
  created_at: string;
}

export interface ClaimOrderItemInsertInput {
  claim_order_id: Uuid;
  reward_type: ClaimItemRewardType;
  source_table: ClaimItemSourceTable;
  source_snapshot_id: Uuid;
  amount: AmountString;
}

export async function insertClaimOrderItem(
  db: DbClient,
  input: ClaimOrderItemInsertInput,
): Promise<ClaimOrderItemRow> {
  return db.queryRequired<ClaimOrderItemRow>(
    `insert into claim_order_items (
        claim_order_id, reward_type, source_table,
        source_snapshot_id, amount
      ) values ($1, $2, $3, $4, $5)
      returning *`,
    [
      input.claim_order_id,
      input.reward_type,
      input.source_table,
      input.source_snapshot_id,
      input.amount,
    ],
  );
}

// ---------- claim_records ----------

export interface ClaimRecordRow {
  id: Uuid;
  claim_order_id: Uuid;
  wallet_address: WalletAddress;
  amount: AmountString;
  tx_hash: TxHash | null;
  status: ClaimRecordStatus;
  recorded_at: string;
  created_at: string;
}

export interface ClaimRecordInsertInput {
  claim_order_id: Uuid;
  wallet_address: WalletAddress;
  amount: AmountString;
  tx_hash?: TxHash | null;
  status: ClaimRecordStatus;
  recorded_at: string;
}

export async function insertClaimRecord(
  db: DbClient,
  input: ClaimRecordInsertInput,
): Promise<ClaimRecordRow> {
  return db.queryRequired<ClaimRecordRow>(
    `insert into claim_records (
        claim_order_id, wallet_address, amount, tx_hash, status, recorded_at
      ) values ($1, $2, $3, $4, $5, $6)
      returning *`,
    [
      input.claim_order_id,
      input.wallet_address,
      input.amount,
      input.tx_hash ?? null,
      input.status,
      input.recorded_at,
    ],
  );
}
