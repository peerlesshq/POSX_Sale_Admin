/**
 * Team rate resolution.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §6.2 (team level rate tables)
 *   - 09_config_center_spec.md §9.5 (`team_reward_rules.team_ladders`)
 *
 * Given a user's current tier and their team total performance, look
 * up the team-rate bracket that applies to them.
 *
 * Rules:
 *   - If the user's tier is not team-eligible, rate = `"0"`. This is
 *     used on the *subordinate* side of differential calculation:
 *     a basic-tier line root contributes `S_rate = 0` so the
 *     differential becomes the full user rate.
 *   - If the team ladder for the user's tier has no bracket covering
 *     the given performance (including the `performance < min_of_first_bracket`
 *     case), rate = `"0"`.
 *   - Otherwise, rate = the bracket's `team_rate`.
 *
 * Why `"0"` for unmatched performance:
 *   The spec's default ladders start at `performance_min = 1`. A line
 *   root with performance 0 has no qualifying bracket, which means
 *   they contribute nothing against their own line. Treating this as
 *   a concrete zero rate (rather than throwing) matches both the
 *   team-differential equation (`max(0, U_rate - 0) = U_rate`) and
 *   the equal-level trigger condition (`U_rate == S_rate` cannot
 *   match because U_rate > 0).
 */
import type { RateString, TierCode } from '@posx/shared-types';
import { amountGte, amountLte } from '@posx/shared-utils';

import type { TeamLadderBracket, TeamLadderDefinitions } from './inputs';

export const ZERO_RATE: RateString = '0';

export interface TeamRateResolutionInput {
  readonly tier: TierCode | null;
  readonly team_total_performance: string;
  readonly team_ladders: TeamLadderDefinitions;
  /**
   * Whether the tier is eligible for team reward at all. Callers are
   * expected to pass this value (from the tier definition) so we do
   * not re-resolve tier eligibility here.
   */
  readonly team_eligible: boolean;
}

export interface TeamRateResolutionResult {
  readonly team_rate: RateString;
  readonly bracket: TeamLadderBracket | null;
}

export function resolveTeamRate(
  input: TeamRateResolutionInput,
): TeamRateResolutionResult {
  if (!input.team_eligible || input.tier === null) {
    return { team_rate: ZERO_RATE, bracket: null };
  }

  const ladder = input.team_ladders.ladders[input.tier];
  if (!ladder || ladder.length === 0) {
    return { team_rate: ZERO_RATE, bracket: null };
  }

  for (const bracket of ladder) {
    if (!amountGte(input.team_total_performance, bracket.performance_min)) continue;
    if (bracket.performance_max !== null) {
      if (!amountLte(input.team_total_performance, bracket.performance_max)) continue;
    }
    return { team_rate: bracket.team_rate, bracket };
  }

  return { team_rate: ZERO_RATE, bracket: null };
}
