/**
 * Qualification rules normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.3
 */
import { z } from 'zod';

import type { QualificationPolicy } from '@posx/domain-rules';

import { AmountZ } from './common';

export const RewardMinimumsSchema = z.object({
  reward_min_deposit_threshold: AmountZ,
  reward_min_holding_threshold: AmountZ,
});

export function normalizeQualificationPolicy(raw: unknown): QualificationPolicy {
  const parsed = RewardMinimumsSchema.parse(raw);
  return {
    reward_min_deposit_threshold: parsed.reward_min_deposit_threshold,
    reward_min_holding_threshold: parsed.reward_min_holding_threshold,
  };
}
