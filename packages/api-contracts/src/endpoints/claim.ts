/**
 * Claim endpoint contracts.
 *
 * Endpoints:
 *   POST /api/v1/claims
 *   POST /api/v1/claims/{claim_order_id}/sign
 *   GET  /api/v1/claims/{claim_order_id}
 *
 * Source of truth: 04_api_spec.md §11.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  TxHashSchema,
  UuidSchema,
  WalletAddressSchema,
} from '../common';
import { successEnvelope } from '../envelope';

// ---- POST /claims ----

export const CreateClaimOrderRequestSchema = z
  .object({
    client_request_id: z.string().min(1).max(128),
    claim_scope: z.enum(['claim_all', 'claim_by_type']),
    reward_types: z
      .array(z.enum(['team', 'equal_level', 'adjustment_credit']))
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.claim_scope === 'claim_by_type' && (!v.reward_types || v.reward_types.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reward_types is required when claim_scope = claim_by_type',
        path: ['reward_types'],
      });
    }
  });
export type CreateClaimOrderRequest = z.infer<typeof CreateClaimOrderRequestSchema>;

export const ClaimOrderItemSchema = z.object({
  reward_type: z.enum(['team', 'equal_level', 'adjustment_credit']),
  source_snapshot_id: UuidSchema,
  amount: AmountStringSchema,
});

export const CreateClaimOrderDataSchema = z.object({
  claim_order_id: UuidSchema,
  status: z.string(),
  requested_total_amount: AmountStringSchema,
  items: z.array(ClaimOrderItemSchema),
  message_to_sign: z.string(),
});
export const CreateClaimOrderResponseSchema = successEnvelope(CreateClaimOrderDataSchema);

// ---- POST /claims/{id}/sign ----

export const SignClaimOrderRequestSchema = z.object({
  signature: z.string().min(1),
});
export type SignClaimOrderRequest = z.infer<typeof SignClaimOrderRequestSchema>;

export const SignClaimOrderDataSchema = z.object({
  claim_order_id: UuidSchema,
  status: z.string(),
  requested_total_amount: AmountStringSchema,
  queued_at: IsoTimestampSchema.nullable(),
});
export const SignClaimOrderResponseSchema = successEnvelope(SignClaimOrderDataSchema);

// ---- GET /claims/{id} ----

export const GetClaimOrderDataSchema = z.object({
  claim_order_id: UuidSchema,
  wallet_address: WalletAddressSchema,
  status: z.string(),
  requested_total_amount: AmountStringSchema,
  broadcast_tx_hash: TxHashSchema.nullable(),
  created_at: IsoTimestampSchema,
  signed_at: IsoTimestampSchema.nullable(),
  queued_at: IsoTimestampSchema.nullable(),
  broadcasted_at: IsoTimestampSchema.nullable(),
  confirmed_at: IsoTimestampSchema.nullable(),
  failure_reason: z.string().nullable(),
});
export const GetClaimOrderResponseSchema = successEnvelope(GetClaimOrderDataSchema);
