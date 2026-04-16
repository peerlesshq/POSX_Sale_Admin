/**
 * Tier resolution.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §4.4 (default tier table)
 *   - 09_config_center_spec.md §9.4 (`tier_rules.tier_definitions`)
 *
 * Rules:
 *   - A user enters a tier when:
 *       deposit ≥ tier.deposit_min
 *       AND holding_value ∈ [tier.holding_min, tier.holding_max]
 *   - If multiple tiers match, the highest (last-matching) one wins.
 *     The normalizer guarantees non-overlapping intervals ordered
 *     ascending by `holding_min`, so selecting the last match is
 *     deterministic.
 *   - If no tier matches, the user has no tier (`null`) — this is
 *     NOT the same as being in a hidden "none" tier; it means the
 *     user is ineligible for the Basic/Advanced/Elite rewards.
 */
import type { AmountString, TierCode } from '@posx/shared-types';
import { amountGte, amountLte } from '@posx/shared-utils';

import type { TierDefinition, TierDefinitions } from './inputs';

export interface TierResolutionInput {
  readonly cumulative_deposit: AmountString;
  readonly holding_value_usdt: AmountString;
  readonly tier_definitions: TierDefinitions;
}

export interface TierResolutionResult {
  readonly tier: TierCode | null;
  readonly tier_definition: TierDefinition | null;
}

/**
 * Pick the applicable tier definition for a user, or `null` if none
 * applies.
 */
export function resolveTier(input: TierResolutionInput): TierResolutionResult {
  const { cumulative_deposit, holding_value_usdt, tier_definitions } = input;

  let match: TierDefinition | null = null;
  for (const tier of tier_definitions.tiers) {
    if (!amountGte(cumulative_deposit, tier.deposit_min)) continue;
    if (!amountGte(holding_value_usdt, tier.holding_min)) continue;
    if (tier.holding_max !== null && !amountLte(holding_value_usdt, tier.holding_max)) continue;
    match = tier;
  }

  if (!match) return { tier: null, tier_definition: null };
  return { tier: match.tier_code, tier_definition: match };
}
