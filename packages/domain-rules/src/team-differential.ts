/**
 * Team differential reward calculation.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §6.3, §6.5, §6.6
 *
 * Rules:
 *   - For a user `U` and each direct subordinate line root `S`:
 *       differential_rate = max(0, U_rate - S_rate)
 *       line_reward_raw   = line_effective_performance × differential_rate
 *   - `max_team_rate` is a safety ceiling on `U_rate`. Callers should
 *     never pass a rate above `max_team_rate` (the ladder normalizer
 *     rejects such config), but the compute function clamps defensively.
 *   - Equal-level replacement is evaluated SEPARATELY by the
 *     `equal-level` module. Lines marked as replaced must be passed
 *     through with `raw_reward_amount = 0` here.
 *
 * This module does NOT sum the per-line amounts into a user total —
 * the settlement orchestrator is responsible for summation and for
 * invoking the equal-level replacement check on each line.
 */
import type { AmountString, RateString } from '@posx/shared-types';
import {
  amountGt,
  mulAmount,
  parseAmount,
  subAmount,
} from '@posx/shared-utils';

export interface TeamLinePerspective {
  readonly line_root_wallet_address: string;
  readonly line_effective_performance: AmountString;
  readonly subordinate_team_rate: RateString;
}

export interface TeamDifferentialInput {
  readonly user_team_rate: RateString;
  readonly max_team_rate: RateString;
  readonly line: TeamLinePerspective;
}

export interface TeamDifferentialResult {
  readonly differential_rate: RateString;
  readonly raw_reward_amount: AmountString;
}

/**
 * Compute `max(0, user_rate - subordinate_rate) × effective_performance`.
 *
 * The rate subtraction uses decimal arithmetic via `@posx/shared-utils`
 * so there is no float drift.
 */
export function computeLineDifferential(
  input: TeamDifferentialInput,
): TeamDifferentialResult {
  // Clamp user_rate to max_team_rate as a defence in depth.
  const userRateClamped = amountGt(input.user_team_rate, input.max_team_rate)
    ? input.max_team_rate
    : input.user_team_rate;

  // max(0, user_rate - subordinate_rate)
  const diff = subAmount(userRateClamped, input.line.subordinate_team_rate);
  const diffNonNegative: RateString = parseAmount(diff).isNegative() ? '0' : diff;

  const raw = mulAmount(input.line.line_effective_performance, diffNonNegative);

  return {
    differential_rate: diffNonNegative,
    raw_reward_amount: raw,
  };
}
