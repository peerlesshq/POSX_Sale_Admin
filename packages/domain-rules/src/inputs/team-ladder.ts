/**
 * Normalized team ladder input for domain-rules.
 *
 * Source of truth: 01_business_rules_spec.md §6 and
 * 09_config_center_spec.md §9.5 (`team_reward_rules.team_ladders`).
 */
import type { AmountString, RateString, TierCode } from '@posx/shared-types';

/**
 * One bracket in a tier-specific ladder. `performance_max` of `null`
 * represents the top bracket (no upper bound).
 */
export interface TeamLadderBracket {
  readonly performance_min: AmountString;
  readonly performance_max: AmountString | null;
  readonly team_rate: RateString;
}

/**
 * Team ladder definitions per tier, plus the global `max_team_rate`
 * used as a safety ceiling when verifying ladders.
 */
export interface TeamLadderDefinitions {
  /**
   * Ladders keyed by tier code. Only tiers that have `team_eligible`
   * true in the tier definitions are expected to appear here; the
   * normalizer rejects inconsistent configurations.
   */
  readonly ladders: Readonly<Partial<Record<TierCode, ReadonlyArray<TeamLadderBracket>>>>;
  readonly max_team_rate: RateString;
}

/**
 * Effective descendant depth range used for team performance
 * aggregation on each settlement day.
 *
 * Source: 01 §3.5 and 09 §9.5 `team_reward_rules.effective_depth`.
 */
export interface EffectiveDepthConfig {
  readonly effective_level_start: number;
  readonly effective_level_end: number;
}
