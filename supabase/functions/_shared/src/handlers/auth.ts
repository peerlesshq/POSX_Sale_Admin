/**
 * Auth handler functions.
 *
 * Pure handlers (no HTTP transport). A Phase 5 Supabase Edge
 * Function shim wraps each of these with parse → call → serialize.
 */
import type {
  AuthNonceRequest,
  AuthVerifyRequest,
} from '@posx/api-contracts/endpoints';

import { success, type HandlerContext, type HandlerSuccess } from './types';

export async function handleAuthNonce(
  ctx: HandlerContext,
  input: AuthNonceRequest,
): Promise<
  HandlerSuccess<{
    wallet_address: string;
    nonce: string;
    message_to_sign: string;
    expires_at: string;
  }>
> {
  const issued = await ctx.services.nonces.issueNonce(input.wallet_address);
  return success(ctx, {
    wallet_address: issued.walletAddress,
    nonce: issued.nonce,
    message_to_sign: issued.messageToSign,
    expires_at: issued.expiresAt,
  });
}

export async function handleAuthVerify(
  ctx: HandlerContext,
  input: AuthVerifyRequest,
): Promise<
  HandlerSuccess<{
    wallet_address: string;
    session_token: string;
    expires_at: string;
    user_status: string;
  }>
> {
  const result = await ctx.services.walletVerify.verify({
    walletAddress: input.wallet_address,
    nonce: input.nonce,
    signature: input.signature,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
  });
  return success(ctx, {
    wallet_address: result.user.wallet_address,
    session_token: result.sessionToken,
    expires_at: result.sessionExpiresAt,
    user_status: result.user.status,
  });
}

export async function handleAuthLogout(
  ctx: HandlerContext,
  rawToken: string,
): Promise<HandlerSuccess<{ logged_out: true }>> {
  await ctx.services.userSessions.revoke(rawToken);
  return success(ctx, { logged_out: true });
}
