/**
 * Purchase handler functions.
 *
 * Uses the session's authenticated wallet as the single source of
 * truth — route params and body fields never override it. The
 * `requireUserSession` guard call lives in the edge function shim
 * (Phase 5) and hands `wallet` down to these functions as part of
 * the explicit input, so tests can exercise them without HTTP.
 */
import type {
  AttachPurchaseTxRequest,
  CreatePurchaseOrderRequest,
  RecoverPurchaseRequest,
} from '@posx/api-contracts/endpoints';
import type {
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

import { success, type HandlerContext, type HandlerSuccess } from './types';

const MIN_CONFIRMATIONS = 12;

export async function handleCreatePurchaseOrder(
  ctx: HandlerContext,
  wallet: WalletAddress,
  input: CreatePurchaseOrderRequest,
): Promise<
  HandlerSuccess<{
    purchase_order_id: string;
    wallet_address: string;
    status: string;
    usdt_amount: string;
    expected_token_price: string | null;
    expected_posx_amount: string | null;
    min_confirmations: number;
    created_at: string;
  }>
> {
  const order = await ctx.services.purchaseOrder.create({
    wallet,
    clientOrderId: input.client_order_id,
    usdtAmount: input.usdt_amount,
    expectedTokenPrice: input.expected_token_price,
  });
  return success(ctx, {
    purchase_order_id: order.id,
    wallet_address: order.wallet_address,
    status: order.status,
    usdt_amount: order.usdt_amount,
    expected_token_price: order.token_price_snapshot,
    expected_posx_amount: order.expected_posx_amount,
    min_confirmations: MIN_CONFIRMATIONS,
    created_at: order.created_at,
  });
}

export async function handleAttachPurchaseTx(
  ctx: HandlerContext,
  wallet: WalletAddress,
  orderId: Uuid,
  input: AttachPurchaseTxRequest,
): Promise<
  HandlerSuccess<{
    purchase_order_id: string;
    status: string;
    purchase_tx_hash: string;
    approval_tx_hash: string | null;
  }>
> {
  const order = await ctx.services.purchaseOrder.attachTx({
    orderId,
    wallet,
    purchaseTxHash: input.purchase_tx_hash as TxHash,
    approvalTxHash: input.approval_tx_hash as TxHash | undefined,
  });
  return success(ctx, {
    purchase_order_id: order.id,
    status: order.status,
    purchase_tx_hash: order.purchase_tx_hash ?? input.purchase_tx_hash,
    approval_tx_hash: order.approval_tx_hash,
  });
}

export async function handleGetPurchaseOrder(
  ctx: HandlerContext,
  wallet: WalletAddress,
  orderId: Uuid,
): Promise<
  HandlerSuccess<{
    purchase_order_id: string;
    status: string;
    wallet_address: string;
    usdt_amount: string;
    purchase_tx_hash: string | null;
    confirmed_purchase_id: string | null;
    created_at: string;
    confirmed_at: string | null;
  }>
> {
  const order = await ctx.services.purchaseOrder.get(orderId, wallet);
  return success(ctx, {
    purchase_order_id: order.id,
    status: order.status,
    wallet_address: order.wallet_address,
    usdt_amount: order.usdt_amount,
    purchase_tx_hash: order.purchase_tx_hash,
    // Phase 5 will wire this via a join on purchases.purchase_order_id.
    confirmed_purchase_id: null,
    created_at: order.created_at,
    confirmed_at: order.confirmed_at,
  });
}

export async function handleRecoverPurchase(
  ctx: HandlerContext,
  wallet: WalletAddress,
  input: RecoverPurchaseRequest,
): Promise<
  HandlerSuccess<{
    recovery_id: string;
    status: string;
    tx_hash: string;
  }>
> {
  const recovery = await ctx.services.purchaseRecovery.request({
    wallet,
    txHash: input.tx_hash as TxHash,
  });
  return success(ctx, {
    recovery_id: recovery.id,
    status: recovery.status,
    tx_hash: recovery.tx_hash,
  });
}
