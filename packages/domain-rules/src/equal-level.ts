/**
 * Equal-level replacement.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §7
 *
 * Replacement triggers for a line when ALL of the following are true:
 *   1. `U_rate === S_rate`
 *   2. `S` meets the minimum team performance threshold
 *      (`equal_level_policy.subordinate_team_performance_threshold`)
 *   3. `U` is team-reward-qualified
 *   4. The line is active on the settlement day (boolean passed by caller)
 *   5. `equal_level_policy.replacement_enabled` is `true`
 *
 * When replacement applies:
 *   - line differential reward becomes 0
 *   - line equal-level reward = line_effective_performance × equal_level_rate
 *
 * Each direct subordinate line is evaluated independently (01 §7.5).
 */
import type { AmountString, RateString } from '@posx/shared-types';
import { amountEquals, amountGte, mulAmount } from '@posx/shared-utils';

import type { EqualLevelPolicy } from './inputs';

export interface EqualLevelInput {
  readonly user_team_rate: RateString;
  readonly subordinate_team_rate: RateString;
  /**
   * Team total performance of the subordinate line root. This is NOT
   * the line effective performance from the user's perspective — the
   * equal-level threshold is applied to the subordinate's own team
   * aggregate (01 §7.1 condition #2).
   */
  readonly subordinate_team_total_performance: AmountString;
  readonly user_team_reward_qualified: boolean;
  readonly line_active: boolean;
  readonly line_effective_performance: AmountString;
  readonly policy: EqualLevelPolicy;
}

export interface EqualLevelResult {
  readonly applies: boolean;
  readonly raw_reward_amount: AmountString;
}

export function isEqualLevelApplicable(input: EqualLevelInput): boolean {
  if (!input.policy.replacement_enabled) return false;
  if (!input.user_team_reward_qualified) return false;
  if (!input.line_active) return false;
  if (!amountEquals(input.user_team_rate, input.subordinate_team_rate)) return false;
  if (
    !amountGte(
      input.subordinate_team_total_performance,
      input.policy.subordinate_team_performance_threshold,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Evaluate equal-level replacement for one line. If replacement does
 * not apply, `applies = false` and `raw_reward_amount = "0"`; the
 * team-differential module's result for the same line is what the
 * settlement orchestrator should persist in that case.
 */
export function evaluateEqualLevel(input: EqualLevelInput): EqualLevelResult {
  if (!isEqualLevelApplicable(input)) {
    return { applies: false, raw_reward_amount: '0' };
  }
  const raw = mulAmount(
    input.line_effective_performance,
    input.policy.equal_level_rate,
  );
  return { applies: true, raw_reward_amount: raw };
}
