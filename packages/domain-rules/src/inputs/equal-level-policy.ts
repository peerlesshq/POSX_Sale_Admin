/**
 * Normalized equal-level policy input for domain-rules.
 *
 * Source of truth: 01_business_rules_spec.md §7 and
 * 09_config_center_spec.md §9.6 (`equal_level_rules.equal_level_policy`).
 */
import type { AmountString, RateString } from '@posx/shared-types';

export interface EqualLevelPolicy {
  readonly equal_level_rate: RateString;
  readonly subordinate_team_performance_threshold: AmountString;
  readonly replacement_enabled: boolean;
}
