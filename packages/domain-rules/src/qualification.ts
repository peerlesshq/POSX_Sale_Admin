/**
 * Reward qualification.
 *
 * Source of truth: 01_business_rules_spec.md §4.1 and §4.3.
 *
 * Pure function: inputs come from the caller (no config or DB lookups).
 *
 * Rules:
 *   - `reward_qualified` ⇔ cumulative_deposit ≥ min_deposit AND
 *                          holding_value_usdt ≥ min_holding
 *   - `team_reward_qualified` ⇔ reward_qualified AND tier ∈ team-eligible tiers
 */
import type { AmountString, TierCode } from '@posx/shared-types';
import { amountGte } from '@posx/shared-utils';

import type { QualificationPolicy, TierDefinitions } from './inputs';

export interface QualificationInput {
  readonly cumulative_deposit: AmountString;
  readonly holding_value_usdt: AmountString;
  readonly tier: TierCode | null;
  readonly qualification_policy: QualificationPolicy;
  readonly tier_definitions: TierDefinitions;
}

export interface QualificationResult {
  readonly reward_qualified: boolean;
  readonly team_reward_qualified: boolean;
}

/**
 * True when the user meets BOTH the deposit and holding thresholds.
 * Does not check tier at all — see `isTeamRewardQualified` for the
 * team-eligibility check.
 */
export function isRewardQualified(input: QualificationInput): boolean {
  const { reward_min_deposit_threshold, reward_min_holding_threshold } =
    input.qualification_policy;
  return (
    amountGte(input.cumulative_deposit, reward_min_deposit_threshold) &&
    amountGte(input.holding_value_usdt, reward_min_holding_threshold)
  );
}

/**
 * True when the user is reward-qualified AND their current tier has
 * `team_eligible = true` in the tier definitions.
 *
 * A `null` tier is never team-eligible. A tier code not present in
 * the provided `tier_definitions` is treated as not-eligible; callers
 * that want to surface "unknown tier" as a config bug must do so
 * explicitly rather than relying on this function.
 */
export function isTeamRewardQualified(input: QualificationInput): boolean {
  if (!isRewardQualified(input)) return false;
  if (input.tier === null) return false;
  const tierDef = input.tier_definitions.tiers.find((t) => t.tier_code === input.tier);
  if (!tierDef) return false;
  return tierDef.team_eligible;
}

/**
 * Single-call helper that returns both flags at once. Convenient for
 * snapshot persistence paths.
 */
export function evaluateQualification(input: QualificationInput): QualificationResult {
  const rewardQualified = isRewardQualified(input);
  const teamRewardQualified =
    rewardQualified &&
    input.tier !== null &&
    (input.tier_definitions.tiers.find((t) => t.tier_code === input.tier)?.team_eligible ?? false);
  return {
    reward_qualified: rewardQualified,
    team_reward_qualified: teamRewardQualified,
  };
}
