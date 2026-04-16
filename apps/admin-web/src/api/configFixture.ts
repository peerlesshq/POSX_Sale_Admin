/**
 * Config Center mock fixture.
 *
 * Generates a realistic set of `config_versions` records covering
 * every group and key from `09_config_center_spec.md`. The shape of
 * every record matches the backend contract — this file does not
 * invent fields. When the real `/admin/config` endpoint comes online,
 * only the source swaps; consumers do not care.
 *
 * Dataset scope:
 *   - 12 groups (all of them)
 *   - ~15 config keys
 *   - ~30 total versions including:
 *       • active (current)
 *       • active (future / scheduled)
 *       • superseded
 *       • disabled (1 example to exercise that state)
 *   - at least 4 keys have a scheduled future version
 *   - at least 6 keys have historical versions for diff
 *
 * "now" reference is `2026-04-14T00:00:00Z`. All effective_from dates
 * are relative to this so the active/future/history split stays
 * deterministic regardless of when the app is booted.
 */

type Scope = 'all_users' | 'new_users_only' | 'new_orders_only' | 'next_settlement_day';
type Status = 'draft' | 'active' | 'superseded' | 'disabled';

export interface ConfigVersionRecord {
  readonly config_version_id: string;
  readonly config_group: string;
  readonly config_key: string;
  readonly version_no: number;
  readonly config_value: Record<string, unknown>;
  readonly effective_from: string;
  readonly apply_scope: Scope;
  readonly status: Status;
  readonly description: string;
  readonly created_by: string;
  readonly created_at: string;
}

/** Reference "now" used across all fixture timestamps. */
const NOW = '2026-04-14T00:00:00.000Z';

/* Date helpers --------------------------------------------------------- */

function iso(date: string): string {
  return new Date(date).toISOString();
}

function daysBefore(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function daysAfter(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/* ID counter for deterministic UUID-ish strings ------------------------ */
let __seq = 0;
function nextId(group: string, key: string): string {
  __seq += 1;
  return `cfg-${group.replace(/_/g, '')}-${key.replace(/_/g, '')}-${String(
    __seq,
  ).padStart(4, '0')}`;
}

/* Builder helper: emits one record ------------------------------------- */

interface VersionSpec {
  version_no: number;
  value: Record<string, unknown>;
  effective_from: string;
  apply_scope: Scope;
  status: Status;
  description: string;
  created_by?: string;
  created_at?: string;
}

function row(
  group: string,
  key: string,
  spec: VersionSpec,
): ConfigVersionRecord {
  return {
    config_version_id: nextId(group, key),
    config_group: group,
    config_key: key,
    version_no: spec.version_no,
    config_value: spec.value,
    effective_from: iso(spec.effective_from),
    apply_scope: spec.apply_scope,
    status: spec.status,
    description: spec.description,
    created_by: spec.created_by ?? 'admin@posx.io',
    created_at: iso(spec.created_at ?? spec.effective_from),
  };
}

/* --------------------------------------------------------------------- */
/*  Fixture builder                                                      */
/* --------------------------------------------------------------------- */

function buildFixture(): ConfigVersionRecord[] {
  __seq = 0;
  const records: ConfigVersionRecord[] = [];

  /* ---------- pricing.token_price ---------------------------------- */
  // history v1 -> active v2 -> future v3
  records.push(
    row('pricing', 'token_price', {
      version_no: 1,
      value: { token_price: '0.0500', currency: 'USDT' },
      effective_from: daysBefore(180),
      apply_scope: 'next_settlement_day',
      status: 'superseded',
      description: '初始定价 0.05 USDT',
      created_at: daysBefore(182),
    }),
    row('pricing', 'token_price', {
      version_no: 2,
      value: { token_price: '0.0618', currency: 'USDT' },
      effective_from: daysBefore(60),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '调整为 0.0618 USDT',
      created_at: daysBefore(62),
    }),
    row('pricing', 'token_price', {
      version_no: 3,
      value: { token_price: '0.0750', currency: 'USDT' },
      effective_from: daysAfter(14),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '预排期：阶段性提价至 0.075 USDT',
      created_by: 'ops@posx.io',
      created_at: daysBefore(2),
    }),
  );

  /* ---------- purchase_rules.minimum_purchase_amount --------------- */
  records.push(
    row('purchase_rules', 'minimum_purchase_amount', {
      version_no: 1,
      value: { minimum_purchase_amount: '500', currency: 'USDT' },
      effective_from: daysBefore(200),
      apply_scope: 'new_orders_only',
      status: 'superseded',
      description: '初始最低购买额 500',
      created_at: daysBefore(205),
    }),
    row('purchase_rules', 'minimum_purchase_amount', {
      version_no: 2,
      value: { minimum_purchase_amount: '1000', currency: 'USDT' },
      effective_from: daysBefore(90),
      apply_scope: 'new_orders_only',
      status: 'active',
      description: '提升至 1000 USDT',
      created_at: daysBefore(95),
    }),
  );

  /* ---------- purchase_rules.quick_amount_options ------------------ */
  records.push(
    row('purchase_rules', 'quick_amount_options', {
      version_no: 1,
      value: { options: ['1000', '5000', '10000', '50000'] },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '前台快捷金额集合',
      created_at: daysBefore(200),
    }),
  );

  /* ---------- qualification_rules.reward_minimums ------------------ */
  records.push(
    row('qualification_rules', 'reward_minimums', {
      version_no: 1,
      value: {
        reward_min_deposit_threshold: '500',
        reward_min_holding_threshold: '500',
      },
      effective_from: daysBefore(200),
      apply_scope: 'next_settlement_day',
      status: 'superseded',
      description: '初版门槛 500 / 500',
      created_at: daysBefore(205),
    }),
    row('qualification_rules', 'reward_minimums', {
      version_no: 2,
      value: {
        reward_min_deposit_threshold: '1000',
        reward_min_holding_threshold: '1000',
      },
      effective_from: daysBefore(45),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '对齐 basic 档位持仓下限',
      created_at: daysBefore(50),
    }),
  );

  /* ---------- tier_rules.tier_definitions -------------------------- */
  const tiersV1 = {
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
        direct_rate: '0.08',
        team_eligible: true,
      },
      {
        tier_code: 'elite',
        display_name: 'Elite',
        holding_min: '50000',
        holding_max: null,
        deposit_min: '1000',
        direct_rate: '0.12',
        team_eligible: true,
      },
    ],
  };
  const tiersV2 = {
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
  };
  const tiersV3 = {
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
        holding_max: '199999.999999999999999999',
        deposit_min: '1000',
        direct_rate: '0.15',
        team_eligible: true,
      },
      {
        tier_code: 'sovereign',
        display_name: 'Sovereign',
        holding_min: '200000',
        holding_max: null,
        deposit_min: '2000',
        direct_rate: '0.18',
        team_eligible: true,
      },
    ],
  };
  records.push(
    row('tier_rules', 'tier_definitions', {
      version_no: 1,
      value: tiersV1,
      effective_from: daysBefore(200),
      apply_scope: 'next_settlement_day',
      status: 'superseded',
      description: '初版档位：basic/advanced/elite',
      created_at: daysBefore(205),
    }),
    row('tier_rules', 'tier_definitions', {
      version_no: 2,
      value: tiersV2,
      effective_from: daysBefore(60),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '提高 advanced / elite 直推率',
      created_at: daysBefore(65),
    }),
    row('tier_rules', 'tier_definitions', {
      version_no: 3,
      value: tiersV3,
      effective_from: daysAfter(30),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '新增 Sovereign 顶级档位',
      created_by: 'ops@posx.io',
      created_at: daysBefore(5),
    }),
  );

  /* ---------- team_reward_rules.effective_depth -------------------- */
  records.push(
    row('team_reward_rules', 'effective_depth', {
      version_no: 1,
      value: { effective_level_start: 2, effective_level_end: 7 },
      effective_from: daysBefore(200),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '团队业绩计入层级区间 L2–L7',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- team_reward_rules.team_ladders ----------------------- */
  const laddersV1 = {
    ladders: {
      advanced: [
        { performance_min: '1', performance_max: '100000', team_rate: '0.01' },
        { performance_min: '100001', performance_max: '500000', team_rate: '0.03' },
        { performance_min: '500001', performance_max: '1000000', team_rate: '0.05' },
        { performance_min: '1000001', performance_max: '5000000', team_rate: '0.08' },
        { performance_min: '5000001', performance_max: null, team_rate: '0.12' },
      ],
      elite: [
        { performance_min: '1', performance_max: '100000', team_rate: '0.02' },
        { performance_min: '100001', performance_max: '500000', team_rate: '0.03' },
        { performance_min: '500001', performance_max: '1000000', team_rate: '0.05' },
        { performance_min: '1000001', performance_max: '5000000', team_rate: '0.08' },
        { performance_min: '5000001', performance_max: null, team_rate: '0.12' },
      ],
    },
    max_team_rate: '0.12',
  };
  const laddersV2 = {
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
  };
  records.push(
    row('team_reward_rules', 'team_ladders', {
      version_no: 1,
      value: laddersV1,
      effective_from: daysBefore(200),
      apply_scope: 'next_settlement_day',
      status: 'superseded',
      description: '初始梯度率表，封顶 12%',
      created_at: daysBefore(205),
    }),
    row('team_reward_rules', 'team_ladders', {
      version_no: 2,
      value: laddersV2,
      effective_from: daysBefore(60),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '上调顶段至 15%，对齐档位调整',
      created_at: daysBefore(65),
    }),
  );

  /* ---------- equal_level_rules.equal_level_policy ----------------- */
  records.push(
    row('equal_level_rules', 'equal_level_policy', {
      version_no: 1,
      value: {
        equal_level_rate: '0.03',
        subordinate_team_performance_threshold: '100000',
        replacement_enabled: true,
      },
      effective_from: daysBefore(200),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '平级奖率 3%，替代启用',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- burn_rules.burn_policy ------------------------------- */
  const burnV1 = {
    burn_disable_threshold: '5000',
    cap_basis: 'holding_value',
    applies_to: ['team', 'equal_level'],
    excludes: ['direct'],
  };
  const burnV2 = {
    burn_disable_threshold: '10000',
    cap_basis: 'holding_value',
    applies_to: ['team', 'equal_level'],
    excludes: ['direct'],
  };
  const burnV3 = {
    burn_disable_threshold: '8000',
    cap_basis: 'holding_value',
    applies_to: ['team', 'equal_level'],
    excludes: ['direct'],
  };
  records.push(
    row('burn_rules', 'burn_policy', {
      version_no: 1,
      value: burnV1,
      effective_from: daysBefore(200),
      apply_scope: 'next_settlement_day',
      status: 'superseded',
      description: '初始销毁阈值 5000',
      created_at: daysBefore(205),
    }),
    row('burn_rules', 'burn_policy', {
      version_no: 2,
      value: burnV2,
      effective_from: daysBefore(45),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '销毁阈值上调至 10000',
      created_at: daysBefore(50),
    }),
    row('burn_rules', 'burn_policy', {
      version_no: 3,
      value: burnV3,
      effective_from: daysAfter(21),
      apply_scope: 'next_settlement_day',
      status: 'active',
      description: '预排期：下调阈值至 8000',
      created_by: 'ops@posx.io',
      created_at: daysBefore(1),
    }),
  );

  /* ---------- vesting_rules.vesting_policy ------------------------- */
  records.push(
    row('vesting_rules', 'vesting_policy', {
      version_no: 1,
      value: { lock_days: 90, release_days: 365, mode: 'lot_based' },
      effective_from: daysBefore(200),
      apply_scope: 'new_orders_only',
      status: 'active',
      description: '90 天锁仓 + 365 天线性释放',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- claim_rules.claim_policy ----------------------------- */
  records.push(
    row('claim_rules', 'claim_policy', {
      version_no: 1,
      value: {
        min_claim_amount: '10',
        claim_scope_default: 'claim_all',
        allow_claim_by_type: true,
        pending_signature_ttl_minutes: 30,
      },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'superseded',
      description: '初版提取策略',
      created_at: daysBefore(205),
    }),
    row('claim_rules', 'claim_policy', {
      version_no: 2,
      value: {
        min_claim_amount: '10',
        claim_scope_default: 'claim_all',
        allow_claim_by_type: true,
        pending_signature_ttl_minutes: 15,
      },
      effective_from: daysBefore(30),
      apply_scope: 'all_users',
      status: 'active',
      description: '签名有效期收紧至 15 分钟',
      created_at: daysBefore(32),
    }),
  );

  /* ---------- display_rules.enabled_languages ---------------------- */
  records.push(
    row('display_rules', 'enabled_languages', {
      version_no: 1,
      value: { languages: ['zh-CN', 'zh-TW', 'en', 'ko'] },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '启用 4 语言',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- display_rules.announcements -------------------------- */
  records.push(
    row('display_rules', 'announcements', {
      version_no: 1,
      value: {
        announcement_key: 'global_notice',
        content: {
          'zh-CN': '欢迎体验 POSX',
          'zh-TW': '歡迎體驗 POSX',
          en: 'Welcome to POSX',
          ko: 'POSX에 오신 것을 환영합니다',
        },
      },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '默认全站欢迎公告',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- display_rules.theme_options -------------------------- */
  records.push(
    row('display_rules', 'theme_options', {
      version_no: 1,
      value: { themes: ['light', 'dark', 'auto'] },
      effective_from: daysBefore(300),
      apply_scope: 'all_users',
      status: 'disabled',
      description: '废弃：暂停 auto 主题选项',
      created_at: daysBefore(305),
    }),
    row('display_rules', 'theme_options', {
      version_no: 2,
      value: { themes: ['light', 'dark'] },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '只保留 light/dark',
      created_at: daysBefore(202),
    }),
  );

  /* ---------- sync_rules.chain_sync_policy ------------------------- */
  records.push(
    row('sync_rules', 'chain_sync_policy', {
      version_no: 1,
      value: { min_confirmations: 12, scan_batch_size: 500, reorg_safety_window: 20 },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '默认同步策略',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- system_limits.pagination_defaults -------------------- */
  records.push(
    row('system_limits', 'pagination_defaults', {
      version_no: 1,
      value: { default_page_size: 20, max_page_size: 100 },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '默认分页设置',
      created_at: daysBefore(205),
    }),
  );

  /* ---------- system_limits.report_export_limits ------------------- */
  records.push(
    row('system_limits', 'report_export_limits', {
      version_no: 1,
      value: { max_export_rows: 100000, retention_days: 7 },
      effective_from: daysBefore(200),
      apply_scope: 'all_users',
      status: 'active',
      description: '报表导出限额',
      created_at: daysBefore(205),
    }),
  );

  return records;
}

/* --------------------------------------------------------------------- */
/*  Singleton                                                            */
/* --------------------------------------------------------------------- */

let CACHE: readonly ConfigVersionRecord[] | null = null;

export function getConfigFixture(): readonly ConfigVersionRecord[] {
  if (!CACHE) {
    CACHE = Object.freeze(buildFixture());
  }
  return CACHE;
}

/** Total record count — for assertions and dashboards. */
export function fixtureSize(): number {
  return getConfigFixture().length;
}
