/**
 * Equal-level rules normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.6
 */
import { z } from 'zod';

import type { EqualLevelPolicy } from '@posx/domain-rules';

import { AmountZ, RateZ } from './common';

export const EqualLevelPolicySchema = z.object({
  equal_level_rate: RateZ.refine((v) => {
    const r = parseFloat(v);
    return r >= 0 && r <= 1;
  }, 'equal_level_rate must be within [0, 1]'),
  subordinate_team_performance_threshold: AmountZ,
  replacement_enabled: z.boolean(),
});

export function normalizeEqualLevelPolicy(raw: unknown): EqualLevelPolicy {
  const parsed = EqualLevelPolicySchema.parse(raw);
  return {
    equal_level_rate: parsed.equal_level_rate,
    subordinate_team_performance_threshold:
      parsed.subordinate_team_performance_threshold,
    replacement_enabled: parsed.replacement_enabled,
  };
}
