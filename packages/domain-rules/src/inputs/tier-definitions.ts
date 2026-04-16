/**
 * Normalized tier definitions input for domain-rules.
 *
 * Source of truth: 01_business_rules_spec.md §4 and
 * 09_config_center_spec.md §9.4 (`tier_rules.tier_definitions`).
 *
 * This type is the boundary between the config layer (which parses
 * raw `config_value` JSON) and the compute layer (which consumes a
 * normalized input object). No domain-rules function may look at a
 * `ConfigVersionRow` directly.
 */
import type { AmountString, RateString, TierCode } from '@posx/shared-types';

export interface TierDefinition {
  readonly tier_code: TierCode;
  readonly display_name: string;
  readonly holding_min: AmountString;
  /** `null` represents an open-ended upper tier (no ceiling). */
  readonly holding_max: AmountString | null;
  readonly deposit_min: AmountString;
  readonly direct_rate: RateString;
  readonly team_eligible: boolean;
}

/**
 * Ordered, validated set of tiers. The order is strictly ascending by
 * `holding_min` and is enforced by the normalizer, not re-checked here.
 */
export interface TierDefinitions {
  readonly tiers: ReadonlyArray<TierDefinition>;
}
