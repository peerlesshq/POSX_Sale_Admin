/**
 * Reward type taxonomies.
 *
 * This file intentionally defines three different reward-type unions
 * because their applicable value sets are different across contexts:
 *
 *   - `RewardCategory`      — general-purpose (direct / team / equal_level)
 *   - `BurnRewardType`      — only reward types that participate in burn
 *                             (team / equal_level), per 01 §8.1 and
 *                             03 §10.6
 *   - `ClaimItemRewardType` — reward types that can be locked into a
 *                             claim_order_item, per 03 §10.8
 *
 * The direct-reward contract (01 §5) is "chain fact, never burned", so
 * `direct` is present in `RewardCategory` but NOT in `BurnRewardType`.
 */
import { createEnumGuard } from '../internal/enum-helpers';

// --- Generic reward category ---

export const RewardCategory = {
  Direct: 'direct',
  Team: 'team',
  EqualLevel: 'equal_level',
} as const;

export type RewardCategory = (typeof RewardCategory)[keyof typeof RewardCategory];

export const REWARD_CATEGORY_VALUES = [
  RewardCategory.Direct,
  RewardCategory.Team,
  RewardCategory.EqualLevel,
] as const satisfies ReadonlyArray<RewardCategory>;

export const isRewardCategory = createEnumGuard(REWARD_CATEGORY_VALUES);

// --- Burn-applicable reward type (01 §8.1) ---

export const BurnRewardType = {
  Team: 'team',
  EqualLevel: 'equal_level',
} as const;

export type BurnRewardType = (typeof BurnRewardType)[keyof typeof BurnRewardType];

export const BURN_REWARD_TYPE_VALUES = [
  BurnRewardType.Team,
  BurnRewardType.EqualLevel,
] as const satisfies ReadonlyArray<BurnRewardType>;

export const isBurnRewardType = createEnumGuard(BURN_REWARD_TYPE_VALUES);

// --- Claim order item reward type (03 §10.8) ---

export const ClaimItemRewardType = {
  Team: 'team',
  EqualLevel: 'equal_level',
  AdjustmentCredit: 'adjustment_credit',
} as const;

export type ClaimItemRewardType =
  (typeof ClaimItemRewardType)[keyof typeof ClaimItemRewardType];

export const CLAIM_ITEM_REWARD_TYPE_VALUES = [
  ClaimItemRewardType.Team,
  ClaimItemRewardType.EqualLevel,
  ClaimItemRewardType.AdjustmentCredit,
] as const satisfies ReadonlyArray<ClaimItemRewardType>;

export const isClaimItemRewardType = createEnumGuard(
  CLAIM_ITEM_REWARD_TYPE_VALUES,
);

/**
 * The set of tables that can supply a claim_order_item row (03 §10.8).
 * Stored alongside `source_snapshot_id` to disambiguate.
 */
export const ClaimItemSourceTable = {
  TeamRewardsDaily: 'team_rewards_daily',
  EqualLevelRewardsDaily: 'equal_level_rewards_daily',
  AdjustmentRecords: 'adjustment_records',
} as const;

export type ClaimItemSourceTable =
  (typeof ClaimItemSourceTable)[keyof typeof ClaimItemSourceTable];

export const CLAIM_ITEM_SOURCE_TABLE_VALUES = [
  ClaimItemSourceTable.TeamRewardsDaily,
  ClaimItemSourceTable.EqualLevelRewardsDaily,
  ClaimItemSourceTable.AdjustmentRecords,
] as const satisfies ReadonlyArray<ClaimItemSourceTable>;

export const isClaimItemSourceTable = createEnumGuard(
  CLAIM_ITEM_SOURCE_TABLE_VALUES,
);

/**
 * The set of tables that can be the source of a burn record (03 §10.6).
 */
export const BurnSourceTable = {
  TeamRewardsDaily: 'team_rewards_daily',
  EqualLevelRewardsDaily: 'equal_level_rewards_daily',
} as const;

export type BurnSourceTable =
  (typeof BurnSourceTable)[keyof typeof BurnSourceTable];

export const BURN_SOURCE_TABLE_VALUES = [
  BurnSourceTable.TeamRewardsDaily,
  BurnSourceTable.EqualLevelRewardsDaily,
] as const satisfies ReadonlyArray<BurnSourceTable>;

export const isBurnSourceTable = createEnumGuard(BURN_SOURCE_TABLE_VALUES);
