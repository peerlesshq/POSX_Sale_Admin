/**
 * Purchase rules normalizers.
 *
 * Source of truth: 09_config_center_spec.md §9.2
 *   - `minimum_purchase_amount`
 *   - `quick_amount_options`
 */
import { z } from 'zod';

import { compareAmount } from '@posx/shared-utils';
import type { PurchasePolicy } from '@posx/domain-rules';

import { AmountZ } from './common';

export const MinimumPurchaseAmountSchema = z.object({
  minimum_purchase_amount: AmountZ,
  currency: z.literal('USDT'),
});

export const QuickAmountOptionsSchema = z.object({
  options: z
    .array(AmountZ)
    .min(1, 'quick_amount_options must contain at least one value')
    .refine((arr) => {
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const curr = arr[i];
        if (prev === undefined || curr === undefined) return false;
        if (compareAmount(prev, curr) >= 0) return false;
      }
      return true;
    }, 'quick_amount_options must be strictly ascending with unique values'),
});

export interface NormalizedMinimumPurchaseAmount {
  readonly minimum_purchase_amount: string;
}

export interface NormalizedQuickAmountOptions {
  readonly options: ReadonlyArray<string>;
}

export function normalizeMinimumPurchaseAmount(
  raw: unknown,
): NormalizedMinimumPurchaseAmount {
  const parsed = MinimumPurchaseAmountSchema.parse(raw);
  return { minimum_purchase_amount: parsed.minimum_purchase_amount };
}

export function normalizeQuickAmountOptions(
  raw: unknown,
): NormalizedQuickAmountOptions {
  const parsed = QuickAmountOptionsSchema.parse(raw);
  return { options: parsed.options };
}

/**
 * Assemble a full `PurchasePolicy` from the two separate config rows.
 * The Config Center stores them under different keys, so callers that
 * want the combined view must resolve both rows and then pass them
 * into this assembler.
 */
export function assemblePurchasePolicy(
  min: NormalizedMinimumPurchaseAmount,
  quick: NormalizedQuickAmountOptions,
): PurchasePolicy {
  return {
    minimum_purchase_amount: min.minimum_purchase_amount,
    quick_amount_options: quick.options,
  };
}
