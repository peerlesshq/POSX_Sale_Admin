/**
 * `chain_events` + `chain_sync_state` repos — data access only.
 */
import type {
  ChainEventStatus,
  TxHash,
  Uuid,
} from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- chain_events ----------

export interface ChainEventRow {
  id: Uuid;
  chain_id: number;
  contract_address: string;
  event_name: string;
  tx_hash: TxHash;
  log_index: number;
  block_number: number;
  block_hash: string | null;
  status: ChainEventStatus;
  confirmations: number;
  payload: Record<string, unknown>;
  observed_at: string;
  confirmed_at: string | null;
  processed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChainEventUpsertInput {
  chain_id: number;
  contract_address: string;
  event_name: string;
  tx_hash: TxHash;
  log_index: number;
  block_number: number;
  block_hash?: string | null;
  payload: Record<string, unknown>;
  confirmations?: number;
}

export async function upsertChainEvent(
  db: DbClient,
  input: ChainEventUpsertInput,
): Promise<ChainEventRow> {
  return db.queryRequired<ChainEventRow>(
    `insert into chain_events (
        chain_id, contract_address, event_name, tx_hash, log_index,
        block_number, block_hash, payload, confirmations, status
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, coalesce($9, 0), 'observed'
      )
      on conflict (chain_id, tx_hash, log_index) do update
        set block_number   = excluded.block_number,
            block_hash     = coalesce(excluded.block_hash, chain_events.block_hash),
            confirmations  = greatest(chain_events.confirmations, excluded.confirmations)
      returning *`,
    [
      input.chain_id,
      input.contract_address,
      input.event_name,
      input.tx_hash,
      input.log_index,
      input.block_number,
      input.block_hash ?? null,
      JSON.stringify(input.payload),
      input.confirmations ?? null,
    ],
  );
}

export async function bumpChainEventConfirmations(
  db: DbClient,
  id: Uuid,
  confirmations: number,
): Promise<void> {
  await db.query(
    `update chain_events
        set confirmations = greatest(confirmations, $2)
      where id = $1`,
    [id, confirmations],
  );
}

export async function markChainEventConfirmed(
  db: DbClient,
  id: Uuid,
  confirmedAt: string,
): Promise<ChainEventRow> {
  return db.queryRequired<ChainEventRow>(
    `update chain_events
        set status = 'confirmed',
            confirmed_at = $2
      where id = $1
      returning *`,
    [id, confirmedAt],
  );
}

export async function markChainEventProcessed(
  db: DbClient,
  id: Uuid,
  processedAt: string,
): Promise<ChainEventRow> {
  return db.queryRequired<ChainEventRow>(
    `update chain_events
        set status = 'processed',
            processed_at = $2
      where id = $1
      returning *`,
    [id, processedAt],
  );
}

export async function markChainEventFailedProcessing(
  db: DbClient,
  id: Uuid,
  failedAt: string,
  reason: string,
): Promise<ChainEventRow> {
  return db.queryRequired<ChainEventRow>(
    `update chain_events
        set status = 'failed_processing',
            failed_at = $2,
            failure_reason = $3
      where id = $1
      returning *`,
    [id, failedAt, reason],
  );
}

export async function markChainEventReverted(
  db: DbClient,
  id: Uuid,
  reason: string,
): Promise<ChainEventRow> {
  return db.queryRequired<ChainEventRow>(
    `update chain_events
        set status = 'reverted',
            failure_reason = $2
      where id = $1
      returning *`,
    [id, reason],
  );
}

export async function findChainEventByKey(
  db: DbClient,
  chainId: number,
  txHash: TxHash,
  logIndex: number,
): Promise<ChainEventRow | null> {
  return db.queryOne<ChainEventRow>(
    `select * from chain_events
       where chain_id = $1 and tx_hash = $2 and log_index = $3`,
    [chainId, txHash, logIndex],
  );
}

export async function listConfirmedUnprocessedEvents(
  db: DbClient,
  limit = 100,
): Promise<ChainEventRow[]> {
  return db.query<ChainEventRow>(
    `select * from chain_events
       where status = 'confirmed'
       order by block_number asc, log_index asc
       limit $1`,
    [limit],
  );
}

// ---------- chain_sync_state ----------

export interface ChainSyncStateRow {
  id: Uuid;
  chain_id: number;
  contract_address: string;
  sync_key: string;
  last_scanned_block: number;
  last_confirmed_block: number;
  last_scanned_at: string | null;
  updated_at: string;
}

export async function upsertChainSyncState(
  db: DbClient,
  input: {
    chain_id: number;
    contract_address: string;
    sync_key: string;
    last_scanned_block: number;
    last_confirmed_block: number;
    last_scanned_at: string;
  },
): Promise<ChainSyncStateRow> {
  return db.queryRequired<ChainSyncStateRow>(
    `insert into chain_sync_state (
        chain_id, contract_address, sync_key,
        last_scanned_block, last_confirmed_block, last_scanned_at
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (chain_id, contract_address, sync_key) do update
        set last_scanned_block = greatest(chain_sync_state.last_scanned_block, excluded.last_scanned_block),
            last_confirmed_block = greatest(chain_sync_state.last_confirmed_block, excluded.last_confirmed_block),
            last_scanned_at = excluded.last_scanned_at
      returning *`,
    [
      input.chain_id,
      input.contract_address,
      input.sync_key,
      input.last_scanned_block,
      input.last_confirmed_block,
      input.last_scanned_at,
    ],
  );
}

export async function listChainSyncStates(
  db: DbClient,
): Promise<ChainSyncStateRow[]> {
  return db.query<ChainSyncStateRow>(
    `select * from chain_sync_state
       order by chain_id, contract_address, sync_key`,
  );
}
