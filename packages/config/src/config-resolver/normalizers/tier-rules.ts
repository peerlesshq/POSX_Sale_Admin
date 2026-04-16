/**
 * Tier rules normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.4
 *
 * Validates ordering + interval non-overlap and produces a
 * `TierDefinitions` object consumed by `@posx/domain-rules/tier`.
 */
import { z } from 'zod';

import { compareAmount } from '@posx/shared-utils';
import type { TierDefinition, TierDefinitions } from '@posx/domain-rules';

import { AmountZ, NullableAmountZ, RateZ, TierCodeZ } from './common';

const TierEntrySchema = z.object({
  tier_code: TierCodeZ,
  display_name: z.string().min(1),
  holding_min: AmountZ,
  holding_max: NullableAmountZ,
  deposit_min: AmountZ,
  direct_rate: RateZ,
  team_eligible: z.boolean(),
});

export const TierDefinitionsSchema = z
  .object({
    tiers: z.array(TierEntrySchema).min(1),
  })
  .superRefine((value, ctx) => {
    const tiers = value.tiers;

    // 1. tier_code uniqueness
    const codes = new Set<string>();
    for (const t of tiers) {
      if (codes.has(t.tier_code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate tier_code: ${t.tier_code}`,
          path: ['tiers'],
        });
      }
      codes.add(t.tier_code);
    }

    // 2. rate range
    for (const t of tiers) {
      const r = parseFloat(t.direct_rate);
      if (!(r >= 0 && r <= 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `direct_rate out of [0,1] for tier ${t.tier_code}`,
          path: ['tiers'],
        });
      }
    }

    // 3. holding_min / holding_max validity + strict ascending order +
    //    at most one open-ended upper tier
    let openEndedCount = 0;
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (!t) continue;
      if (t.holding_max === null) {
        openEndedCount += 1;
      } else if (compareAmount(t.holding_min, t.holding_max) > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `holding_min > holding_max for tier ${t.tier_code}`,
          path: ['tiers'],
        });
      }

      if (i > 0) {
        const prev = tiers[i - 1];
        if (!prev) continue;
        if (compareAmount(prev.holding_min, t.holding_min) >= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'tiers must be strictly ascending by holding_min',
            path: ['tiers'],
          });
        }
        if (prev.holding_max === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'only the highest tier may be open-ended (holding_max = null)',
            path: ['tiers'],
          });
        } else if (compareAmount(prev.holding_max, t.holding_min) >= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `tier intervals overlap between ${prev.tier_code} and ${t.tier_code}`,
            path: ['tiers'],
          });
        }
      }
    }

    if (openEndedCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at most one open-ended tier allowed',
        path: ['tiers'],
      });
    }
  });

export function normalizeTierDefinitions(raw: unknown): TierDefinitions {
  const parsed = TierDefinitionsSchema.parse(raw);
  const tiers: TierDefinition[] = parsed.tiers.map((t) => ({
    tier_code: t.tier_code,
    display_name: t.display_name,
    holding_min: t.holding_min,
    holding_max: t.holding_max,
    deposit_min: t.deposit_min,
    direct_rate: t.direct_rate,
    team_eligible: t.team_eligible,
  }));
  return { tiers };
}
