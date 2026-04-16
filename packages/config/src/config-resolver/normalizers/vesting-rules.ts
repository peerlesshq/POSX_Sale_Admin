/**
 * Vesting rules normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.8
 */
import { z } from 'zod';

import { VestingMode, type VestingPolicy } from '@posx/domain-rules';

export const VestingPolicySchema = z.object({
  lock_days: z.number().int().nonnegative(),
  release_days: z.number().int().positive(),
  mode: z.literal(VestingMode.LotBased),
});

export function normalizeVestingPolicy(raw: unknown): VestingPolicy {
  const parsed = VestingPolicySchema.parse(raw);
  return {
    lock_days: parsed.lock_days,
    release_days: parsed.release_days,
    mode: parsed.mode,
  };
}
