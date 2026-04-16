/**
 * Normalized reward qualification minimums.
 *
 * Source of truth: 01 §4.1 and 09 §9.3
 * (`qualification_rules.reward_minimums`).
 */
import type { AmountString } from '@posx/shared-types';

export interface QualificationPolicy {
  readonly reward_min_deposit_threshold: AmountString;
  readonly reward_min_holding_threshold: AmountString;
}
