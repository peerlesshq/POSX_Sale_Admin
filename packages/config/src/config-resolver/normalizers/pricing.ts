/**
 * Pricing config normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.1
 */
import { z } from 'zod';

import type { Pricing } from '@posx/domain-rules';

import { AmountZ } from './common';

export const PricingValueSchema = z.object({
  token_price: AmountZ.refine((v) => parseFloat(v) > 0, 'token_price must be > 0'),
  currency: z.literal('USDT'),
});

export function normalizePricing(raw: unknown): Pricing {
  const parsed = PricingValueSchema.parse(raw);
  return {
    token_price: parsed.token_price,
    currency: parsed.currency,
  };
}
