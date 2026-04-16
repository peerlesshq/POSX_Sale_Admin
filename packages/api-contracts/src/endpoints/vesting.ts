/**
 * Vesting endpoint contract.
 *
 * Source of truth: 04_api_spec.md §9.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  UuidSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from '../pagination';

export const VestingLotRowSchema = z.object({
  vesting_lot_id: UuidSchema,
  purchase_id: UuidSchema,
  total_locked: AmountStringSchema,
  start_time: IsoTimestampSchema,
  lock_days: z.number().int().nonnegative(),
  release_days: z.number().int().positive(),
  released_amount: AmountStringSchema,
  withdrawable_amount: AmountStringSchema,
  withdrawn_amount: AmountStringSchema,
  status: z.string(),
});

export const VestingSummarySchema = z.object({
  total_locked: AmountStringSchema,
  total_released: AmountStringSchema,
  total_withdrawable: AmountStringSchema,
  total_withdrawn: AmountStringSchema,
});

export const GetVestingQuerySchema = PaginationQuerySchema;
export const GetVestingDataSchema = z.object({
  summary: VestingSummarySchema,
  lots: z.array(VestingLotRowSchema),
  pagination: PaginationMetaSchema,
});
export const GetVestingResponseSchema = successEnvelope(GetVestingDataSchema);
