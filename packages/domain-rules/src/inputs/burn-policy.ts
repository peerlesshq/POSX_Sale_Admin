/**
 * Normalized burn policy input for domain-rules.
 *
 * Source of truth: 01_business_rules_spec.md §8 and
 * 09_config_center_spec.md §9.7 (`burn_rules.burn_policy`).
 *
 * Burn applies ONLY to reward types listed in `applies_to`. Direct
 * rewards (01 §5.3) are always excluded. The normalizer rejects any
 * config that tries to list `direct` in `applies_to`.
 */
import type { AmountString, BurnRewardType } from '@posx/shared-types';

export const BurnCapBasis = {
  HoldingValue: 'holding_value',
} as const;

export type BurnCapBasis = (typeof BurnCapBasis)[keyof typeof BurnCapBasis];

export interface BurnPolicy {
  readonly burn_disable_threshold: AmountString;
  readonly cap_basis: BurnCapBasis;
  readonly applies_to: ReadonlyArray<BurnRewardType>;
}
