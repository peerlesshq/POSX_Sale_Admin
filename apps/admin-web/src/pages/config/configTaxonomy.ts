/**
 * Config taxonomy — frontend metadata layer for the Config Center.
 *
 * This file owns the human-facing display metadata for every config
 * group and config key that the platform recognises. The API returns
 * raw `config_versions` rows with `config_group` / `config_key`; this
 * taxonomy maps those identifiers to:
 *
 *   - professional Chinese group/key names and descriptions
 *   - risk level (high / medium / low) derived from
 *     `HIGH_RISK_CONFIG_GROUPS` in @posx/shared-types
 *   - the renderer id that `ConfigValueRenderer` should dispatch to
 *   - short schema field descriptions for create/review flows
 *
 * The source of truth for schemas and semantics is
 * `09_config_center_spec.md`. This file intentionally does not invent
 * new fields — it only provides display metadata around existing
 * backend shapes.
 *
 * NOTE: This is a frontend adapter. When the backend eventually serves
 * taxonomy through `/admin/config/taxonomy`, the shape here is what the
 * frontend expects — only the source needs swapping.
 */
import { ConfigGroup, HIGH_RISK_CONFIG_GROUPS } from '@posx/shared-types';

/* --------------------------------------------------------------------- */
/*  Types                                                                */
/* --------------------------------------------------------------------- */

/**
 * Renderer kinds. Maps each config key to a specific structured
 * renderer. `generic` is the fallback that uses a labelled key/value
 * panel instead of a raw JSON dump.
 */
export type ConfigRendererKind =
  | 'pricing'
  | 'tier_definitions'
  | 'team_ladders'
  | 'burn_policy'
  | 'vesting_policy'
  | 'claim_policy'
  | 'generic';

export type ConfigRiskLevel = 'high' | 'medium' | 'low';

export interface ConfigKeyMeta {
  /** Backend key, e.g. `token_price`. */
  readonly key: string;
  /** Professional Chinese label, e.g. "代币售价". */
  readonly labelZh: string;
  /** One-line Chinese description. */
  readonly descriptionZh: string;
  /** Renderer dispatch id. */
  readonly renderer: ConfigRendererKind;
  /**
   * Recommended apply_scope from the spec. Used in the create flow to
   * pre-select a sane default and in the detail summary to explain
   * intended use.
   */
  readonly recommendedScope:
    | 'all_users'
    | 'new_users_only'
    | 'new_orders_only'
    | 'next_settlement_day';
  /**
   * Optional override for per-key risk. When absent, the group risk
   * level is used. Set this for keys that are inherently higher risk
   * than their group (e.g. `tier_definitions` within `tier_rules` is
   * always very high).
   */
  readonly riskOverride?: ConfigRiskLevel;
  /**
   * Human-readable schema field hints, used in create-version review
   * and in the generic renderer. Keys are the JSON field names
   * returned by the backend.
   */
  readonly schemaFields?: Readonly<Record<string, string>>;
}

export interface ConfigGroupMeta {
  readonly group: ConfigGroup;
  /** Professional Chinese group label. */
  readonly labelZh: string;
  /** Professional Chinese group description. */
  readonly descriptionZh: string;
  readonly risk: ConfigRiskLevel;
  readonly keys: readonly ConfigKeyMeta[];
}

/* --------------------------------------------------------------------- */
/*  Risk helpers                                                         */
/* --------------------------------------------------------------------- */

const HIGH_RISK_SET: ReadonlySet<ConfigGroup> = new Set(HIGH_RISK_CONFIG_GROUPS);

/** Returns the risk level for a group based on the shared-types source. */
export function groupRiskLevel(group: ConfigGroup): ConfigRiskLevel {
  if (HIGH_RISK_SET.has(group)) return 'high';
  // Only display / system_limits fall outside the high-risk list.
  if (group === ConfigGroup.SystemLimits) return 'medium';
  return 'low';
}

/* --------------------------------------------------------------------- */
/*  Taxonomy                                                             */
/* --------------------------------------------------------------------- */

export const CONFIG_TAXONOMY: readonly ConfigGroupMeta[] = [
  {
    group: ConfigGroup.Pricing,
    labelZh: '定价策略',
    descriptionZh: '代币售价与计价币种。影响购买结算、档位与持仓价值评估。',
    risk: 'high',
    keys: [
      {
        key: 'token_price',
        labelZh: '代币售价',
        descriptionZh: 'POSX 当前对外售价，用于前台展示及持仓价值计算。',
        renderer: 'pricing',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
        schemaFields: {
          token_price: '单位价格（字符串）',
          currency: '计价币种',
        },
      },
    ],
  },
  {
    group: ConfigGroup.PurchaseRules,
    labelZh: '购买规则',
    descriptionZh: '新订单最低额度与前台快捷金额选项。仅对新订单生效。',
    risk: 'low',
    keys: [
      {
        key: 'minimum_purchase_amount',
        labelZh: '最低购买金额',
        descriptionZh: '单笔最低 USDT 金额。低于该值的订单会被拒绝。',
        renderer: 'generic',
        recommendedScope: 'new_orders_only',
        schemaFields: {
          minimum_purchase_amount: '最低金额（字符串）',
          currency: '计价币种',
        },
      },
      {
        key: 'quick_amount_options',
        labelZh: '快捷金额选项',
        descriptionZh: '前台购买页的快捷金额按钮。全量用户生效。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        schemaFields: {
          options: '金额数组（升序，字符串）',
        },
      },
    ],
  },
  {
    group: ConfigGroup.QualificationRules,
    labelZh: '资格门槛',
    descriptionZh: '奖励资格的基础门槛。直接决定用户是否入参结算。',
    risk: 'high',
    keys: [
      {
        key: 'reward_minimums',
        labelZh: '奖励资格门槛',
        descriptionZh: '获取奖励所需的最小累计购买与最小持仓阈值。',
        renderer: 'generic',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
        schemaFields: {
          reward_min_deposit_threshold: '最小累计购买（USDT）',
          reward_min_holding_threshold: '最小持仓阈值（USDT 当量）',
        },
      },
    ],
  },
  {
    group: ConfigGroup.TierRules,
    labelZh: '档位定义',
    descriptionZh: '用户等级与持仓区间定义。影响直推率与团队资格。',
    risk: 'high',
    keys: [
      {
        key: 'tier_definitions',
        labelZh: '档位与区间',
        descriptionZh: '档位持仓区间、直推率与团队资格标记。极高风险。',
        renderer: 'tier_definitions',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
      },
    ],
  },
  {
    group: ConfigGroup.TeamRewardRules,
    labelZh: '团队奖励规则',
    descriptionZh: '团队业绩有效层级深度与团队奖梯度率表。',
    risk: 'high',
    keys: [
      {
        key: 'effective_depth',
        labelZh: '有效层级深度',
        descriptionZh: '团队业绩计入的后代层级区间（闭区间）。',
        renderer: 'generic',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
        schemaFields: {
          effective_level_start: '起始层（从 1 开始）',
          effective_level_end: '结束层（含）',
        },
      },
      {
        key: 'team_ladders',
        labelZh: '团队梯度率表',
        descriptionZh: '按档位 × 团队业绩分段的团队奖率矩阵。',
        renderer: 'team_ladders',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
      },
    ],
  },
  {
    group: ConfigGroup.EqualLevelRules,
    labelZh: '平级奖规则',
    descriptionZh: '平级替代奖率、下级业绩门槛与启用开关。',
    risk: 'high',
    keys: [
      {
        key: 'equal_level_policy',
        labelZh: '平级奖策略',
        descriptionZh: '平级替代奖的计提率、下级门槛与启用开关。',
        renderer: 'generic',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
        schemaFields: {
          equal_level_rate: '平级奖率（0–1）',
          subordinate_team_performance_threshold: '下级业绩门槛（USDT）',
          replacement_enabled: '是否启用替代',
        },
      },
    ],
  },
  {
    group: ConfigGroup.BurnRules,
    labelZh: '销毁规则',
    descriptionZh: '销毁启用阈值、封顶基准与适用奖励范围。',
    risk: 'high',
    keys: [
      {
        key: 'burn_policy',
        labelZh: '销毁策略',
        descriptionZh: '销毁启/停阈值、封顶基准与适用/豁免奖励类型。',
        renderer: 'burn_policy',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
      },
    ],
  },
  {
    group: ConfigGroup.VestingRules,
    labelZh: '锁仓与释放',
    descriptionZh: '新购订单的锁定期、线性释放天数与释放模式。',
    risk: 'high',
    keys: [
      {
        key: 'vesting_policy',
        labelZh: '锁仓策略',
        descriptionZh: '新订单锁定期、线性释放天数与释放模式。',
        renderer: 'vesting_policy',
        recommendedScope: 'new_orders_only',
        riskOverride: 'high',
      },
    ],
  },
  {
    group: ConfigGroup.ClaimRules,
    labelZh: '提取规则',
    descriptionZh: '最小提取额、默认提取范围与签名有效期。',
    risk: 'high',
    keys: [
      {
        key: 'claim_policy',
        labelZh: '提取策略',
        descriptionZh: '最小提取额、默认提取范围、分类提取与签名有效期。',
        renderer: 'claim_policy',
        recommendedScope: 'next_settlement_day',
        riskOverride: 'high',
      },
    ],
  },
  {
    group: ConfigGroup.DisplayRules,
    labelZh: '前台展示',
    descriptionZh: '前台语言、公告内容与主题可选项。风险较低。',
    risk: 'low',
    keys: [
      {
        key: 'enabled_languages',
        labelZh: '启用语言',
        descriptionZh: '前台可切换的语言集合。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        schemaFields: {
          languages: '语言代码数组',
        },
      },
      {
        key: 'announcements',
        labelZh: '全站公告',
        descriptionZh: '多语言公告文案，按 key 发布。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        schemaFields: {
          announcement_key: '公告键',
          content: '多语言内容映射',
        },
      },
      {
        key: 'theme_options',
        labelZh: '主题选项',
        descriptionZh: '前台可切换的主题集合。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        schemaFields: {
          themes: '主题代码数组',
        },
      },
    ],
  },
  {
    group: ConfigGroup.SyncRules,
    labelZh: '链上同步策略',
    descriptionZh: '区块确认阈值、扫描批次与重组安全窗口。',
    risk: 'high',
    keys: [
      {
        key: 'chain_sync_policy',
        labelZh: '链同步策略',
        descriptionZh: '确认数、扫描批次与重组保护窗口。操作风险高。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        riskOverride: 'high',
        schemaFields: {
          min_confirmations: '最小确认数',
          scan_batch_size: '单次扫描区块数',
          reorg_safety_window: '重组安全窗口（区块数）',
        },
      },
    ],
  },
  {
    group: ConfigGroup.SystemLimits,
    labelZh: '系统限额',
    descriptionZh: '分页默认值、导出上限与保留期。',
    risk: 'medium',
    keys: [
      {
        key: 'pagination_defaults',
        labelZh: '分页默认',
        descriptionZh: '默认页大小与最大页大小。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        schemaFields: {
          default_page_size: '默认页大小',
          max_page_size: '最大页大小',
        },
      },
      {
        key: 'report_export_limits',
        labelZh: '报表导出限额',
        descriptionZh: '单次导出最大行数与文件保留天数。',
        renderer: 'generic',
        recommendedScope: 'all_users',
        schemaFields: {
          max_export_rows: '最大导出行数',
          retention_days: '文件保留天数',
        },
      },
    ],
  },
];

/* --------------------------------------------------------------------- */
/*  Lookups                                                              */
/* --------------------------------------------------------------------- */

const GROUP_INDEX: ReadonlyMap<ConfigGroup, ConfigGroupMeta> = new Map(
  CONFIG_TAXONOMY.map((g) => [g.group, g]),
);

export function getGroupMeta(group: string): ConfigGroupMeta | undefined {
  return GROUP_INDEX.get(group as ConfigGroup);
}

export function getKeyMeta(
  group: string,
  key: string,
): ConfigKeyMeta | undefined {
  const g = getGroupMeta(group);
  if (!g) return undefined;
  return g.keys.find((k) => k.key === key);
}

/** Returns the effective risk for a (group, key) pair. */
export function effectiveRisk(
  group: string,
  key?: string,
): ConfigRiskLevel {
  const g = getGroupMeta(group);
  if (!g) return 'low';
  if (key) {
    const k = g.keys.find((x) => x.key === key);
    if (k?.riskOverride) return k.riskOverride;
  }
  return g.risk;
}

/** Returns a professional Chinese label for a group, or the raw id. */
export function groupLabel(group: string): string {
  return getGroupMeta(group)?.labelZh ?? group;
}

/** Returns a professional Chinese label for a key, or the raw id. */
export function keyLabel(group: string, key: string): string {
  return getKeyMeta(group, key)?.labelZh ?? key;
}
