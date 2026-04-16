/**
 * Default config factory.
 *
 * Returns the baseline config version set described in
 * 09_config_center_spec.md §22 — the same values the seed script
 * inserts into `config_versions` for local development. Also used by
 * tests that need a deterministic "factory defaults" starting point.
 *
 * This module is NOT the source of truth for config VALUES at
 * runtime. At runtime, the Config Center rows in PostgreSQL are
 * authoritative. This factory is a fixture generator.
 */
import {
  ApplyScope,
  ConfigGroup,
  ConfigVersionStatus,
} from '@posx/shared-types';

import type { ConfigVersionRow } from './types';

export interface DefaultConfigOptions {
  /**
   * `effective_from` stamp applied to every generated row. Defaults
   * to the beginning of 2026 to match the seed dataset.
   */
  readonly effectiveFrom?: string;
  /**
   * ID generator. Defaults to a simple indexed placeholder so tests
   * can reason about equality. Seed scripts override this with a
   * `gen_random_uuid()`-backed implementation.
   */
  readonly idFactory?: (index: number) => string;
}

const DEFAULT_EFFECTIVE_FROM = '2026-01-01T00:00:00.000Z';

function makeRow(args: {
  id: string;
  group: string;
  key: string;
  versionNo: number;
  value: Record<string, unknown>;
  effectiveFrom: string;
  scope: ApplyScope;
  description: string;
}): ConfigVersionRow {
  return {
    id: args.id,
    config_group: args.group as ConfigVersionRow['config_group'],
    config_key: args.key,
    version_no: args.versionNo,
    config_value: args.value,
    effective_from: args.effectiveFrom,
    apply_scope: args.scope,
    status: ConfigVersionStatus.Active,
    description: args.description,
    created_at: args.effectiveFrom,
  };
}

/**
 * Build the full set of default config rows (14 keys spanning 12
 * groups — see 09 §22 and §9).
 */
export function buildDefaultConfigRows(
  options: DefaultConfigOptions = {},
): ConfigVersionRow[] {
  const effectiveFrom = options.effectiveFrom ?? DEFAULT_EFFECTIVE_FROM;
  const idFactory =
    options.idFactory ?? ((index) => `cfg_default_${String(index).padStart(3, '0')}`);

  const rows: ConfigVersionRow[] = [];
  let index = 0;

  const push = (partial: Omit<Parameters<typeof makeRow>[0], 'id' | 'effectiveFrom'>) => {
    rows.push(
      makeRow({
        id: idFactory(index),
        effectiveFrom,
        ...partial,
      }),
    );
    index += 1;
  };

  // 1. pricing.token_price
  push({
    group: ConfigGroup.Pricing,
    key: 'token_price',
    versionNo: 1,
    value: { token_price: '0.0618', currency: 'USDT' },
    scope: ApplyScope.NextSettlementDay,
    description: 'Daily POSX sale price (USDT per POSX)',
  });

  // 2. purchase_rules.minimum_purchase_amount
  push({
    group: ConfigGroup.PurchaseRules,
    key: 'minimum_purchase_amount',
    versionNo: 1,
    value: { minimum_purchase_amount: '1000', currency: 'USDT' },
    scope: ApplyScope.NewOrdersOnly,
    description: 'Minimum single-purchase USDT amount',
  });

  // 3. purchase_rules.quick_amount_options
  push({
    group: ConfigGroup.PurchaseRules,
    key: 'quick_amount_options',
    versionNo: 1,
    value: { options: ['1000', '5000', '10000', '50000'] },
    scope: ApplyScope.AllUsers,
    description: 'Frontend quick-amount buttons',
  });

  // 4. qualification_rules.reward_minimums
  push({
    group: ConfigGroup.QualificationRules,
    key: 'reward_minimums',
    versionNo: 1,
    value: {
      reward_min_deposit_threshold: '1000',
      reward_min_holding_threshold: '1000',
    },
    scope: ApplyScope.NextSettlementDay,
    description: 'Minimum deposit + holding thresholds for reward eligibility',
  });

  // 5. tier_rules.tier_definitions
  push({
    group: ConfigGroup.TierRules,
    key: 'tier_definitions',
    versionNo: 1,
    value: {
      tiers: [
        {
          tier_code: 'basic',
          display_name: 'Basic',
          holding_min: '1000',
          holding_max: '9999.999999999999999999',
          deposit_min: '1000',
          direct_rate: '0.05',
          team_eligible: false,
        },
        {
          tier_code: 'advanced',
          display_name: 'Advanced',
          holding_min: '10000',
          holding_max: '49999.999999999999999999',
          deposit_min: '1000',
          direct_rate: '0.10',
          team_eligible: true,
        },
        {
          tier_code: 'elite',
          display_name: 'Elite',
          holding_min: '50000',
          holding_max: null,
          deposit_min: '1000',
          direct_rate: '0.15',
          team_eligible: true,
        },
      ],
    },
    scope: ApplyScope.NextSettlementDay,
    description: 'Tier table with direct rates and team eligibility',
  });

  // 6. team_reward_rules.effective_depth
  push({
    group: ConfigGroup.TeamRewardRules,
    key: 'effective_depth',
    versionNo: 1,
    value: { effective_level_start: 2, effective_level_end: 7 },
    scope: ApplyScope.NextSettlementDay,
    description: 'Effective descendant depth range for team performance',
  });

  // 7. team_reward_rules.team_ladders
  push({
    group: ConfigGroup.TeamRewardRules,
    key: 'team_ladders',
    versionNo: 1,
    value: {
      ladders: {
        advanced: [
          { performance_min: '1', performance_max: '100000', team_rate: '0.01' },
          { performance_min: '100001', performance_max: '500000', team_rate: '0.03' },
          { performance_min: '500001', performance_max: '1000000', team_rate: '0.05' },
          { performance_min: '1000001', performance_max: '5000000', team_rate: '0.10' },
          { performance_min: '5000001', performance_max: null, team_rate: '0.15' },
        ],
        elite: [
          { performance_min: '1', performance_max: '100000', team_rate: '0.02' },
          { performance_min: '100001', performance_max: '500000', team_rate: '0.03' },
          { performance_min: '500001', performance_max: '1000000', team_rate: '0.05' },
          { performance_min: '1000001', performance_max: '5000000', team_rate: '0.10' },
          { performance_min: '5000001', performance_max: null, team_rate: '0.15' },
        ],
      },
      max_team_rate: '0.15',
    },
    scope: ApplyScope.NextSettlementDay,
    description: 'Team rate ladders per tier',
  });

  // 8. equal_level_rules.equal_level_policy
  push({
    group: ConfigGroup.EqualLevelRules,
    key: 'equal_level_policy',
    versionNo: 1,
    value: {
      equal_level_rate: '0.03',
      subordinate_team_performance_threshold: '100000',
      replacement_enabled: true,
    },
    scope: ApplyScope.NextSettlementDay,
    description: 'Equal-level replacement conditions and rate',
  });

  // 9. burn_rules.burn_policy
  push({
    group: ConfigGroup.BurnRules,
    key: 'burn_policy',
    versionNo: 1,
    value: {
      burn_disable_threshold: '10000',
      cap_basis: 'holding_value',
      applies_to: ['team', 'equal_level'],
      excludes: ['direct'],
    },
    scope: ApplyScope.NextSettlementDay,
    description: 'Burn threshold and cap model',
  });

  // 10. vesting_rules.vesting_policy
  push({
    group: ConfigGroup.VestingRules,
    key: 'vesting_policy',
    versionNo: 1,
    value: { lock_days: 90, release_days: 365, mode: 'lot_based' },
    scope: ApplyScope.NewOrdersOnly,
    description: 'Vesting parameters for new purchases',
  });

  // 11. claim_rules.claim_policy
  push({
    group: ConfigGroup.ClaimRules,
    key: 'claim_policy',
    versionNo: 1,
    value: {
      min_claim_amount: '10',
      claim_scope_default: 'claim_all',
      allow_claim_by_type: true,
      pending_signature_ttl_minutes: 30,
    },
    scope: ApplyScope.NextSettlementDay,
    description: 'Claim policy parameters',
  });

  // 12. display_rules.enabled_languages
  push({
    group: ConfigGroup.DisplayRules,
    key: 'enabled_languages',
    versionNo: 1,
    value: { languages: ['zh-CN', 'zh-TW', 'en', 'ko'] },
    scope: ApplyScope.AllUsers,
    description: 'Supported UI locales',
  });

  // 13. sync_rules.chain_sync_policy
  push({
    group: ConfigGroup.SyncRules,
    key: 'chain_sync_policy',
    versionNo: 1,
    value: {
      min_confirmations: 12,
      scan_batch_size: 500,
      reorg_safety_window: 20,
    },
    scope: ApplyScope.AllUsers,
    description: 'Chain sync confirmation and scan parameters',
  });

  // 14. system_limits.pagination_defaults
  push({
    group: ConfigGroup.SystemLimits,
    key: 'pagination_defaults',
    versionNo: 1,
    value: { default_page_size: 20, max_page_size: 100 },
    scope: ApplyScope.AllUsers,
    description: 'Default and maximum pagination sizes',
  });

  return rows;
}
