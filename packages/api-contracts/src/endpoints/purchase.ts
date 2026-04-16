/**
 * Purchase endpoint contracts.
 *
 * Endpoints covered:
 *   POST /api/v1/purchases/orders
 *   POST /api/v1/purchases/orders/{id}/tx
 *   GET  /api/v1/purchases/orders/{id}
 *   POST /api/v1/purchases/recover
 *
 * Source of truth: 04_api_spec.md §8.
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

// ---- POST /purchases/orders ----

export const CreatePurchaseOrderRequestSchema = z.object({
  client_order_id: z.string().min(1).max(64),
  usdt_amount: AmountStringSchema,
  expected_token_price: AmountStringSchema.optional(),
  referral_code: z.string().max(64).optional(),
});
export type CreatePurchaseOrderRequest = z.infer<typeof CreatePurchaseOrderRequestSchema>;

export const PurchaseOrderDataSchema = z.object({
  purchase_order_id: UuidSchema,
  wallet_address: WalletAddressSchema,
  status: z.string(),
  usdt_amount: AmountStringSchema,
  expected_token_price: AmountStringSchema.nullable(),
  expected_posx_amount: AmountStringSchema.nullable(),
  min_confirmations: z.number().int().positive(),
  created_at: IsoTimestampSchema,
});
export const CreatePurchaseOrderResponseSchema = successEnvelope(PurchaseOrderDataSchema);

// ---- POST /purchases/orders/{id}/tx ----

export const AttachPurchaseTxRequestSchema = z.object({
  purchase_tx_hash: TxHashSchema,
  approval_tx_hash: TxHashSchema.optional(),
});
export type AttachPurchaseTxRequest = z.infer<typeof AttachPurchaseTxRequestSchema>;

export const AttachPurchaseTxDataSchema = z.object({
  purchase_order_id: UuidSchema,
  status: z.string(),
  purchase_tx_hash: TxHashSchema,
  approval_tx_hash: TxHashSchema.nullable(),
});
export const AttachPurchaseTxResponseSchema = successEnvelope(AttachPurchaseTxDataSchema);

// ---- GET /purchases/orders/{id} ----

export const GetPurchaseOrderDataSchema = z.object({
  purchase_order_id: UuidSchema,
  status: z.string(),
  wallet_address: WalletAddressSchema,
  usdt_amount: AmountStringSchema,
  purchase_tx_hash: TxHashSchema.nullable(),
  confirmed_purchase_id: UuidSchema.nullable(),
  created_at: IsoTimestampSchema,
  confirmed_at: IsoTimestampSchema.nullable(),
});
export const GetPurchaseOrderResponseSchema = successEnvelope(GetPurchaseOrderDataSchema);

// ---- POST /purchases/recover ----

export const RecoverPurchaseRequestSchema = z.object({
  tx_hash: TxHashSchema,
});
export type RecoverPurchaseRequest = z.infer<typeof RecoverPurchaseRequestSchema>;

export const RecoverPurchaseDataSchema = z.object({
  recovery_id: UuidSchema,
  status: z.string(),
  tx_hash: TxHashSchema,
});
export const RecoverPurchaseResponseSchema = successEnvelope(RecoverPurchaseDataSchema);
