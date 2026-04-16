/**
 * Config group taxonomy.
 *
 * Source of truth: 09_config_center_spec.md §8 and §9
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ConfigGroup = {
  Pricing: 'pricing',
  PurchaseRules: 'purchase_rules',
  QualificationRules: 'qualification_rules',
  TierRules: 'tier_rules',
  TeamRewardRules: 'team_reward_rules',
  EqualLevelRules: 'equal_level_rules',
  BurnRules: 'burn_rules',
  VestingRules: 'vesting_rules',
  ClaimRules: 'claim_rules',
  DisplayRules: 'display_rules',
  SyncRules: 'sync_rules',
  SystemLimits: 'system_limits',
} as const;

export type ConfigGroup = (typeof ConfigGroup)[keyof typeof ConfigGroup];

export const CONFIG_GROUP_VALUES = [
  ConfigGroup.Pricing,
  ConfigGroup.PurchaseRules,
  ConfigGroup.QualificationRules,
  ConfigGroup.TierRules,
  ConfigGroup.TeamRewardRules,
  ConfigGroup.EqualLevelRules,
  ConfigGroup.BurnRules,
  ConfigGroup.VestingRules,
  ConfigGroup.ClaimRules,
  ConfigGroup.DisplayRules,
  ConfigGroup.SyncRules,
  ConfigGroup.SystemLimits,
] as const satisfies ReadonlyArray<ConfigGroup>;

export const isConfigGroup = createEnumGuard(CONFIG_GROUP_VALUES);

/**
 * High-risk config groups that require stronger UI confirmation and
 * additional audit attention (09 §21).
 */
export const HIGH_RISK_CONFIG_GROUPS = [
  ConfigGroup.Pricing,
  ConfigGroup.QualificationRules,
  ConfigGroup.TierRules,
  ConfigGroup.TeamRewardRules,
  ConfigGroup.EqualLevelRules,
  ConfigGroup.BurnRules,
  ConfigGroup.VestingRules,
  ConfigGroup.ClaimRules,
  ConfigGroup.SyncRules,
] as const satisfies ReadonlyArray<ConfigGroup>;
