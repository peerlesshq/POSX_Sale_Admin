/**
 * Purchase orders + purchase facts repo — data access only.
 *
 * No idempotency logic, no state-transition checks, no recovery
 * dispatch. Those belong in Phase 4 service code.
 */
import type {
  AmountString,
  PurchaseOrderStatus,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- purchase_orders ----------

export interface PurchaseOrderRow {
  id: Uuid;
  wallet_address: WalletAddress;
  client_order_id: string;
  status: PurchaseOrderStatus;
  usdt_amount: AmountString;
  expected_posx_amount: AmountString | null;
  token_price_snapshot: AmountString | null;
  approval_tx_hash: string | null;
  purchase_tx_hash: TxHash | null;
  chain_id: number | null;
  contract_address: string | null;
  failure_reason: string | null;
  risk_flag: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

export interface PurchaseOrderInsertInput {
  id?: Uuid;
  wallet_address: WalletAddress;
  client_order_id: string;
  status?: PurchaseOrderStatus;
  usdt_amount: AmountString;
  expected_posx_amount?: AmountString | null;
  token_price_snapshot?: AmountString | null;
  chain_id?: number | null;
  contract_address?: string | null;
}

export async function insertPurchaseOrder(
  db: DbClient,
  input: PurchaseOrderInsertInput,
): Promise<PurchaseOrderRow> {
  return db.queryRequired<PurchaseOrderRow>(
    `insert into purchase_orders (
        id, wallet_address, client_order_id, status, usdt_amount,
        expected_posx_amount, token_price_snapshot, chain_id, contract_address
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, coalesce($4, 'created'), $5, $6, $7, $8, $9
      )
      returning *`,
    [
      input.id ?? null,
      input.wallet_address,
      input.client_order_id,
      input.status ?? null,
      input.usdt_amount,
      input.expected_posx_amount ?? null,
      input.token_price_snapshot ?? null,
      input.chain_id ?? null,
      input.contract_address ?? null,
    ],
  );
}

export async function updatePurchaseOrderStatus(
  db: DbClient,
  id: Uuid,
  status: PurchaseOrderStatus,
  confirmedAt: string | null,
): Promise<PurchaseOrderRow> {
  return db.queryRequired<PurchaseOrderRow>(
    `update purchase_orders
        set status = $2,
            confirmed_at = coalesce($3, confirmed_at)
      where id = $1
      returning *`,
    [id, status, confirmedAt],
  );
}

export async function findPurchaseOrderById(
  db: DbClient,
  id: Uuid,
): Promise<PurchaseOrderRow | null> {
  return db.queryOne<PurchaseOrderRow>(
    `select * from purchase_orders where id = $1`,
    [id],
  );
}

// ---------- purchases (facts) ----------

export interface PurchaseRow {
  id: Uuid;
  purchase_order_id: Uuid | null;
  wallet_address: WalletAddress;
  chain_id: number;
  contract_address: string;
  tx_hash: TxHash;
  block_number: number;
  log_index: number | null;
  usdt_amount: AmountString;
  posx_amount: AmountString;
  token_price_at_purchase: AmountString;
  purchase_at: string;
  created_at: string;
  is_reversed: boolean;
}

export interface PurchaseInsertInput {
  id?: Uuid;
  purchase_order_id?: Uuid | null;
  wallet_address: WalletAddress;
  chain_id: number;
  contract_address: string;
  tx_hash: TxHash;
  block_number: number;
  log_index?: number | null;
  usdt_amount: AmountString;
  posx_amount: AmountString;
  token_price_at_purchase: AmountString;
  purchase_at: string;
}

export async function insertPurchase(
  db: DbClient,
  input: PurchaseInsertInput,
): Promise<PurchaseRow> {
  return db.queryRequired<PurchaseRow>(
    `insert into purchases (
        id, purchase_order_id, wallet_address, chain_id, contract_address,
        tx_hash, block_number, log_index, usdt_amount, posx_amount,
        token_price_at_purchase, purchase_at
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      returning *`,
    [
      input.id ?? null,
      input.purchase_order_id ?? null,
      input.wallet_address,
      input.chain_id,
      input.contract_address,
      input.tx_hash,
      input.block_number,
      input.log_index ?? null,
      input.usdt_amount,
      input.posx_amount,
      input.token_price_at_purchase,
      input.purchase_at,
    ],
  );
}

export async function listPurchasesByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<PurchaseRow[]> {
  return db.query<PurchaseRow>(
    `select * from purchases
       where wallet_address = $1
       order by purchase_at desc`,
    [wallet],
  );
}

export async function sumConfirmedDeposit(
  db: DbClient,
  wallet: WalletAddress,
): Promise<AmountString> {
  const row = await db.queryOne<{ total: AmountString | null }>(
    `select coalesce(sum(usdt_amount), 0)::text as total
       from purchases
      where wallet_address = $1 and is_reversed = false`,
    [wallet],
  );
  return row?.total ?? '0';
}
