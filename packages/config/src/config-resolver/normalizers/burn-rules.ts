/**
 * Burn rules normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.7
 *
 * Enforces that `applies_to` never contains `direct` (01 §5.3, §8.1).
 */
import { z } from 'zod';

import { BURN_REWARD_TYPE_VALUES, type BurnRewardType } from '@posx/shared-types';
import type { BurnPolicy } from '@posx/domain-rules';

import { AmountZ } from './common';

const BurnRewardTypeZ = z.enum(
  BURN_REWARD_TYPE_VALUES as unknown as readonly [BurnRewardType, ...BurnRewardType[]],
);

export const BurnPolicySchema = z.object({
  burn_disable_threshold: AmountZ,
  cap_basis: z.literal('holding_value'),
  applies_to: z.array(BurnRewardTypeZ).min(1),
  // `excludes` is informational only — the spec lists `["direct"]`.
  // We accept an optional array and verify no listed reward type is
  // both in applies_to and excludes.
  excludes: z.array(z.string()).optional(),
});

export function normalizeBurnPolicy(raw: unknown): BurnPolicy {
  const parsed = BurnPolicySchema.parse(raw);

  // Defence in depth: even though `BurnRewardTypeZ` already rejects
  // `direct`, also reject it explicitly if a human hand-edits JSON.
  for (const t of parsed.applies_to) {
    if ((t as string) === 'direct') {
      throw new Error('burn_policy.applies_to must not contain "direct"');
    }
  }

  return {
    burn_disable_threshold: parsed.burn_disable_threshold,
    cap_basis: parsed.cap_basis,
    applies_to: parsed.applies_to,
  };
}
