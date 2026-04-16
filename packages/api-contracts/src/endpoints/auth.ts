/**
 * Auth endpoint contracts.
 *
 * Endpoints:
 *   POST /api/v1/auth/nonce
 *   POST /api/v1/auth/verify
 *   POST /api/v1/auth/logout
 *
 * Source of truth: 04_api_spec.md §5.
 */
import { z } from 'zod';

import { WalletAddressSchema, IsoTimestampSchema } from '../common';
import { successEnvelope } from '../envelope';

// ---- POST /auth/nonce ----

export const AuthNonceRequestSchema = z.object({
  wallet_address: WalletAddressSchema,
});
export type AuthNonceRequest = z.infer<typeof AuthNonceRequestSchema>;

export const AuthNonceDataSchema = z.object({
  wallet_address: WalletAddressSchema,
  nonce: z.string().min(1),
  message_to_sign: z.string().min(1),
  expires_at: IsoTimestampSchema,
});
export const AuthNonceResponseSchema = successEnvelope(AuthNonceDataSchema);

// ---- POST /auth/verify ----

export const AuthVerifyRequestSchema = z.object({
  wallet_address: WalletAddressSchema,
  nonce: z.string().min(1),
  signature: z.string().min(1),
});
export type AuthVerifyRequest = z.infer<typeof AuthVerifyRequestSchema>;

export const AuthVerifyDataSchema = z.object({
  wallet_address: WalletAddressSchema,
  session_token: z.string().min(1),
  expires_at: IsoTimestampSchema,
  user_status: z.string().min(1),
});
export const AuthVerifyResponseSchema = successEnvelope(AuthVerifyDataSchema);

// ---- POST /auth/logout ----

export const AuthLogoutDataSchema = z.object({
  logged_out: z.literal(true),
});
export const AuthLogoutResponseSchema = successEnvelope(AuthLogoutDataSchema);
