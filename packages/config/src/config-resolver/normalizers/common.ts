/**
 * Shared zod primitives for config value normalizers.
 *
 * Each normalizer file imports from this module for amount / rate /
 * tier-code / bracket schemas so validation errors are phrased
 * consistently.
 */
import { z } from 'zod';

import { TIER_CODE_VALUES, type TierCode } from '@posx/shared-types';

/** Amount as a decimal-number string. Matches `AmountStringSchema` in api-contracts. */
export const AmountZ = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Expected decimal amount string');

/** Rate as a decimal-number string, usually in [0, 1]. */
export const RateZ = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Expected decimal rate string');

/** Nullable upper bound (`null` = open-ended). */
export const NullableAmountZ = z
  .union([AmountZ, z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

export const TierCodeZ = z.enum(
  TIER_CODE_VALUES as unknown as readonly [TierCode, ...TierCode[]],
);
