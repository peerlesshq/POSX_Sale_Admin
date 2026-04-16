/**
 * Claim handler functions.
 */
import {
  ClaimOrderScope,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import type {
  CreateClaimOrderRequest,
  SignClaimOrderRequest,
} from '@posx/api-contracts/endpoints';

import { AppError } from '../errors';
import { success, type HandlerContext, type HandlerSuccess } from './types';

export async function handleCreateClaimOrder(
  ctx: HandlerContext,
  wallet: WalletAddress,
  input: CreateClaimOrderRequest,
): Promise<
  HandlerSuccess<{
    claim_order_id: string;
    status: string;
    requested_total_amount: string;
    items: ReadonlyArray<{
      reward_type: string;
      source_snapshot_id: string;
      amount: string;
    }>;
    message_to_sign: string;
  }>
> {
  const scope =
    input.claim_scope === 'claim_all'
      ? ClaimOrderScope.ClaimAll
      : ClaimOrderScope.ClaimByType;

  const result = await ctx.services.claimPrep.prepare({
    wallet,
    clientRequestId: input.client_request_id,
    scope,
  });
  return success(ctx, {
    claim_order_id: result.order.id,
    status: result.order.status,
    requested_total_amount: result.order.requested_total_amount,
    items: result.items.map((it) => ({
      reward_type: it.reward_type,
      source_snapshot_id: it.source_snapshot_id,
      amount: it.amount,
    })),
    message_to_sign: result.messageToSign,
  });
}

export async function handleSignClaimOrder(
  ctx: HandlerContext,
  wallet: WalletAddress,
  claimOrderId: Uuid,
  input: SignClaimOrderRequest,
  messageThatWasSigned: string,
): Promise<
  HandlerSuccess<{
    claim_order_id: string;
    status: string;
    requested_total_amount: string;
    queued_at: string | null;
  }>
> {
  // Load the order via the signing service's DB client. Because
  // the signing service exposes a `sign()` that accepts the row
  // directly, we need to fetch it first here.
  const row = await ctx.db.queryOne<{
    id: string;
    wallet_address: string;
    status: string;
    requested_total_amount: string;
    queued_at: string | null;
  }>(`select * from claim_orders where id = $1`, [claimOrderId]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'claim order not found');
  }
  if (row.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
    throw new AppError('FORBIDDEN', 'claim order belongs to another wallet');
  }

  const signed = await ctx.services.claimSigning.sign({
    order: row as unknown as Parameters<
      typeof ctx.services.claimSigning.sign
    >[0]['order'],
    signature: input.signature,
    messageThatWasSigned,
    wallet,
  });
  return success(ctx, {
    claim_order_id: signed.order.id,
    status: signed.order.status,
    requested_total_amount: signed.order.requested_total_amount,
    queued_at: signed.order.queued_at,
  });
}

export async function handleGetClaimOrder(
  ctx: HandlerContext,
  wallet: WalletAddress,
  claimOrderId: Uuid,
): Promise<
  HandlerSuccess<{
    claim_order_id: string;
    wallet_address: string;
    status: string;
    requested_total_amount: string;
    broadcast_tx_hash: string | null;
    created_at: string;
    signed_at: string | null;
    queued_at: string | null;
    broadcasted_at: string | null;
    confirmed_at: string | null;
    failure_reason: string | null;
  }>
> {
  const row = await ctx.db.queryOne<{
    id: string;
    wallet_address: string;
    status: string;
    requested_total_amount: string;
    broadcast_tx_hash: string | null;
    created_at: string;
    signed_at: string | null;
    queued_at: string | null;
    broadcasted_at: string | null;
    confirmed_at: string | null;
    failure_reason: string | null;
  }>(`select * from claim_orders where id = $1`, [claimOrderId]);
  if (!row) {
    throw new AppError('NOT_FOUND', 'claim order not found');
  }
  if (row.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
    throw new AppError('FORBIDDEN', 'claim order belongs to another wallet');
  }
  return success(ctx, {
    claim_order_id: row.id,
    wallet_address: row.wallet_address,
    status: row.status,
    requested_total_amount: row.requested_total_amount,
    broadcast_tx_hash: row.broadcast_tx_hash,
    created_at: row.created_at,
    signed_at: row.signed_at,
    queued_at: row.queued_at,
    broadcasted_at: row.broadcasted_at,
    confirmed_at: row.confirmed_at,
    failure_reason: row.failure_reason,
  });
}
