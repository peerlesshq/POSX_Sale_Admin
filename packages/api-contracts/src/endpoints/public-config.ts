/**
 * Public config endpoint contract.
 *
 * Source of truth: 04_api_spec.md §6.
 */
import { z } from 'zod';

import { AmountStringSchema } from '../common';
import { successEnvelope } from '../envelope';

export const PublicConfigDataSchema = z.object({
  token_price: AmountStringSchema,
  min_purchase_amount: AmountStringSchema,
  quick_amount_options: z.array(AmountStringSchema),
  reward_min_deposit_threshold: AmountStringSchema,
  reward_min_holding_threshold: AmountStringSchema,
  min_claim_amount: AmountStringSchema,
  languages: z.array(z.enum(['zh-CN', 'zh-TW', 'en', 'ko'])),
  theme_options: z.array(z.enum(['light', 'dark'])),
  announcements: z.record(z.string(), z.string()).nullable(),
});
export const GetPublicConfigResponseSchema = successEnvelope(PublicConfigDataSchema);
export type PublicConfigData = z.infer<typeof PublicConfigDataSchema>;
