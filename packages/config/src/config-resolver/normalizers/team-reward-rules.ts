/**
 * Team reward rules normalizers.
 *
 * Source of truth: 09_config_center_spec.md §9.5
 *   - `effective_depth`
 *   - `team_ladders`
 */
import { z } from 'zod';

import { compareAmount } from '@posx/shared-utils';
import {
  TIER_CODE_VALUES,
  type TierCode,
} from '@posx/shared-types';
import type {
  EffectiveDepthConfig,
  TeamLadderBracket,
  TeamLadderDefinitions,
  TierDefinitions,
} from '@posx/domain-rules';

import { AmountZ, NullableAmountZ, RateZ, TierCodeZ } from './common';

// ---- effective_depth ----

export const EffectiveDepthSchema = z
  .object({
    effective_level_start: z.number().int().positive(),
    effective_level_end: z.number().int().positive(),
  })
  .refine((v) => v.effective_level_start <= v.effective_level_end, {
    message: 'effective_level_start must be <= effective_level_end',
    path: ['effective_level_start'],
  });

export function normalizeEffectiveDepth(raw: unknown): EffectiveDepthConfig {
  const parsed = EffectiveDepthSchema.parse(raw);
  return {
    effective_level_start: parsed.effective_level_start,
    effective_level_end: parsed.effective_level_end,
  };
}

// ---- team_ladders ----

const TeamLadderBracketSchema = z.object({
  performance_min: AmountZ,
  performance_max: NullableAmountZ,
  team_rate: RateZ,
});

const LadderArraySchema = z
  .array(TeamLadderBracketSchema)
  .min(1)
  .superRefine((brackets, ctx) => {
    let seenOpenEnded = false;
    for (let i = 0; i < brackets.length; i++) {
      const b = brackets[i];
      if (!b) continue;
      if (b.performance_max === null) {
        if (seenOpenEnded) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'only one open-ended bracket allowed per ladder',
          });
        }
        seenOpenEnded = true;
      } else if (compareAmount(b.performance_min, b.performance_max) > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ladder bracket has performance_min > performance_max`,
        });
      }

      const rate = parseFloat(b.team_rate);
      if (!(rate >= 0 && rate <= 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `team_rate ${b.team_rate} out of [0,1]`,
        });
      }

      if (i > 0) {
        const prev = brackets[i - 1];
        if (!prev) continue;
        if (compareAmount(prev.performance_min, b.performance_min) >= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'brackets must be strictly ascending by performance_min',
          });
        }
        if (prev.performance_max === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'only the highest bracket may be open-ended',
          });
        } else if (compareAmount(prev.performance_max, b.performance_min) >= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'ladder brackets must not overlap',
          });
        }
      }
    }
  });

// tier → ladder map. zod.record preserves unknown keys, so we
// post-validate that keys are valid tier codes.
export const TeamLaddersSchema = z
  .object({
    ladders: z.record(z.string(), LadderArraySchema),
    max_team_rate: RateZ,
  })
  .superRefine((v, ctx) => {
    const validCodes = new Set<string>(TIER_CODE_VALUES);
    for (const key of Object.keys(v.ladders)) {
      if (!validCodes.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown tier key in ladders: ${key}`,
          path: ['ladders', key],
        });
      }
    }

    // max_team_rate must be at least as high as every ladder's top rate.
    for (const [tierKey, ladder] of Object.entries(v.ladders)) {
      for (const bracket of ladder) {
        if (compareAmount(bracket.team_rate, v.max_team_rate) > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `ladder bracket for tier ${tierKey} exceeds max_team_rate`,
            path: ['ladders', tierKey],
          });
        }
      }
    }
  });

export interface NormalizeTeamLaddersInput {
  readonly raw: unknown;
  /**
   * Must be supplied so we can enforce cross-config validation (09
   * §10.3): every `tier_code` key in the ladder map must exist in
   * the current tier definitions.
   */
  readonly tier_definitions: TierDefinitions;
}

export function normalizeTeamLadders(
  input: NormalizeTeamLaddersInput,
): TeamLadderDefinitions {
  const parsed = TeamLaddersSchema.parse(input.raw);

  const validCodes = new Set<string>(
    input.tier_definitions.tiers.map((t) => t.tier_code),
  );
  for (const key of Object.keys(parsed.ladders)) {
    if (!validCodes.has(key)) {
      throw new Error(
        `team_ladders references tier ${key} which is not defined in tier_definitions`,
      );
    }
  }

  const ladders: Partial<Record<TierCode, ReadonlyArray<TeamLadderBracket>>> = {};
  for (const [tierKey, brackets] of Object.entries(parsed.ladders)) {
    // Cast safe because we validated keys above.
    (ladders as Record<string, ReadonlyArray<TeamLadderBracket>>)[tierKey] =
      brackets.map((b) => ({
        performance_min: b.performance_min,
        performance_max: b.performance_max,
        team_rate: b.team_rate,
      }));
  }

  return {
    ladders,
    max_team_rate: parsed.max_team_rate,
  };
}

// Helper: tier-code zod is re-exported so seed/tests can reuse it.
export { TierCodeZ };
