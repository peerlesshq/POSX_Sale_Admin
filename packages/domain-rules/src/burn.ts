/**
 * Burn calculation.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §8
 *   - 03_database_schema_spec.md §10.6 (`burn_records`)
 *
 * Rules:
 *   1. Burn applies only to reward types listed in
 *      `burn_policy.applies_to` — team and equal_level. Direct rewards
 *      are NEVER burned (01 §5.3 / §8.1). Callers that pass a direct
 *      reward type receive an explicit error.
 *   2. If `holding_value_usdt > burn_disable_threshold`, no burn cap
 *      applies and `actual = raw, burned = 0, remaining_capacity` is
 *      `null` (unconstrained).
 *   3. Otherwise:
 *        burn_cap            = holding_value_usdt
 *        remaining_capacity  = max(0, burn_cap - used_burn_capacity_before)
 *        actual              = min(raw, remaining_capacity)
 *        burned              = raw - actual
 *   4. Burn capacity usage INCLUDES claimable AND claimed actual
 *      off-chain rewards (01 §8.4). The caller must supply
 *      `used_burn_capacity_before` including both states so users
 *      cannot avoid burn by withholding claims.
 *   5. Burned amounts are final — there is no retroactive recovery
 *      (01 §8.7). This rule is respected simply by never mutating
 *      old burn records.
 */
import type { AmountString, BurnRewardType } from '@posx/shared-types';
import {
  amountGt,
  maxAmount,
  minAmount,
  subAmount,
  ZERO_AMOUNT,
} from '@posx/shared-utils';

import type { BurnPolicy } from './inputs';

export class BurnNotApplicableError extends Error {
  constructor(public readonly rewardType: string) {
    super(`Burn is not defined for reward type: ${rewardType}`);
    this.name = 'BurnNotApplicableError';
  }
}

export interface BurnInput {
  readonly reward_type: BurnRewardType;
  readonly raw_amount: AmountString;
  readonly holding_value_usdt: AmountString;
  readonly used_burn_capacity_before: AmountString;
  readonly policy: BurnPolicy;
}

export interface BurnResult {
  /** `true` if the caller was below or at the disable threshold. */
  readonly burn_enabled: boolean;
  /** The cap for this snapshot. Equal to `holding_value_usdt` when enabled. */
  readonly burn_cap: AmountString;
  /**
   * Remaining capacity AFTER subtracting `used_burn_capacity_before`.
   * `null` when burn is disabled (no cap applies).
   */
  readonly remaining_capacity: AmountString | null;
  /** Actual payable amount (≤ raw). */
  readonly actual_amount: AmountString;
  /** Burned amount (≥ 0). */
  readonly burned_amount: AmountString;
  /**
   * Remaining capacity AFTER this snapshot's actual amount is
   * charged. `null` when burn is disabled. Callers can thread this
   * through sequential burn calculations for the same settlement run.
   */
  readonly remaining_after: AmountString | null;
}

/**
 * Verifies that the burn policy lists the given reward type in
 * `applies_to`. This is the one sanity check that runs on every call.
 */
function assertBurnable(rewardType: BurnRewardType, policy: BurnPolicy): void {
  if (!policy.applies_to.includes(rewardType)) {
    throw new BurnNotApplicableError(rewardType);
  }
}

export function isBurnEnabled(
  holding_value_usdt: AmountString,
  policy: BurnPolicy,
): boolean {
  // 01 §8.2: if holding_value > burn_disable_threshold, no burn cap.
  //          if holding_value <= burn_disable_threshold, burn applies.
  return !amountGt(holding_value_usdt, policy.burn_disable_threshold);
}

export function computeBurn(input: BurnInput): BurnResult {
  assertBurnable(input.reward_type, input.policy);

  if (!isBurnEnabled(input.holding_value_usdt, input.policy)) {
    return {
      burn_enabled: false,
      burn_cap: input.holding_value_usdt,
      remaining_capacity: null,
      actual_amount: input.raw_amount,
      burned_amount: ZERO_AMOUNT,
      remaining_after: null,
    };
  }

  const burn_cap = input.holding_value_usdt;
  const rawRemaining = subAmount(burn_cap, input.used_burn_capacity_before);
  const remaining_capacity = maxAmount(rawRemaining, ZERO_AMOUNT);

  const actual_amount = minAmount(input.raw_amount, remaining_capacity);
  const burned_amount = subAmount(input.raw_amount, actual_amount);
  const remaining_after = subAmount(remaining_capacity, actual_amount);

  return {
    burn_enabled: true,
    burn_cap,
    remaining_capacity,
    actual_amount,
    burned_amount,
    remaining_after,
  };
}
