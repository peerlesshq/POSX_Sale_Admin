/**
 * Purchase LIST endpoint contract (supplements purchase.ts).
 *
 * Source of truth: 04_api_spec.md §8.5 (`GET /api/v1/purchases`).
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  TxHashSchema,
  UuidSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  DateRangeQuerySchema,
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

export const PurchaseListItemSchema = z.object({
  purchase_id: UuidSchema,
  usdt_amount: AmountStringSchema,
  posx_amount: AmountStringSchema,
  token_price_at_purchase: AmountStringSchema,
  tx_hash: TxHashSchema,
  purchase_at: IsoTimestampSchema,
  is_reversed: z.boolean(),
});
export const ListPurchasesQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema);
export const ListPurchasesResponseSchema = successEnvelope(
  paginatedPayload(PurchaseListItemSchema),
);
