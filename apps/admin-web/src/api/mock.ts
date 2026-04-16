/**
 * Mock API implementation for admin-web.
 *
 * Enabled via VITE_USE_MOCK_API=true (local/staging only — the env
 * loader hard-disables this in production).
 *
 * The admin mock is much simpler than the user one: the goal is to
 * let a designer or PM exercise the admin console pages without
 * standing up the real backend. The data is canned and ignores most
 * filters.
 *
 * Every function returns a Promise resolving to the same envelope
 * `data` shape the real admin endpoints return.
 */
import { getConfigFixture, type ConfigVersionRecord } from './configFixture';
import {
  asDetail,
  asListRow,
  asRewardBurnRow,
  asRewardDirectRow,
  asRewardEqualRow,
  asRewardTeamRow,
  asTeamRankingRow,
  asTreeNode,
  findSeedUser,
  getSeedUsers,
  seedSubtree,
} from './teamGraphFixture';

type Data = Record<string, unknown>;

async function tick<T>(value: T, ms = 120): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
}

function paginated(items: Data[]) {
  return {
    items,
    pagination: { page: 1, page_size: 20, total: items.length, has_more: false },
  };
}

// ---- Fixture data ----

const MOCK_ADMINS: Data[] = [
  {
    admin_user_id: 'mock-admin-super',
    email: 'superadmin@posx.local',
    name: 'Mock Super Admin',
    role: 'super_admin',
    status: 'active',
    last_login_at: new Date().toISOString(),
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    admin_user_id: 'mock-admin-operator',
    email: 'operator@posx.local',
    name: 'Mock Operator',
    role: 'operator',
    status: 'active',
    last_login_at: new Date().toISOString(),
    created_at: '2026-04-01T00:00:00.000Z',
  },
  {
    admin_user_id: 'mock-admin-viewer',
    email: 'viewer@posx.local',
    name: 'Mock Viewer',
    role: 'viewer',
    status: 'active',
    last_login_at: null,
    created_at: '2026-04-01T00:00:00.000Z',
  },
];

// Rich user list now comes from the team-graph fixture (40 users,
// 5-level referral tree, derived rewards + team metrics). See
// `./teamGraphFixture.ts` for the source of truth.
const MOCK_USERS: Data[] = getSeedUsers().map(asListRow);

// In-memory export jobs so the ReportsPage can poll them.
interface MockExportJob {
  id: string;
  report_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  file_path: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

const mockExports: MockExportJob[] = [];

export const mockApi = {
  login(email: string, _password: string) {
    const match = MOCK_ADMINS.find((a) => a['email'] === email);
    if (!match) {
      return Promise.reject(new Error('mock: unknown email'));
    }
    return tick({
      admin_user_id: String(match['admin_user_id']),
      name: String(match['name']),
      role: match['role'] as 'super_admin' | 'operator' | 'viewer',
      session_token: `mock-admin-session-${Date.now()}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  },
  logout() {
    return tick({ logged_out: true as const });
  },
  dashboard() {
    // 14-day trend — hand-crafted so the chart tells a believable
    // story: deposits growing, rewards following with a 1-day lag,
    // a small burn spike mid-period.
    const days = 14;
    const today = new Date();
    const trend = Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (days - 1 - i));
      const iso = d.toISOString().slice(0, 10);
      const deposit = 18000 + i * 1800 + Math.round(Math.sin(i) * 4200);
      const reward = 4200 + i * 420 + Math.round(Math.cos(i) * 1100);
      const burn = i === 7 || i === 8 ? 1200 - (i - 7) * 300 : Math.max(0, 150 + i * 30 - 200);
      return {
        date: iso,
        deposit: Math.max(0, deposit),
        reward_total: Math.max(0, reward),
        burn_total: Math.max(0, burn),
      };
    });

    const todayRow = trend[trend.length - 1]!;
    const platformTotal = trend.reduce((sum, r) => sum + r.deposit, 0) + 380000;
    const rewardToday = todayRow.reward_total;
    const burnToday = todayRow.burn_total;
    // Split today's reward into the three channels with the same
    // mix the business documents describe (elite-heavy team).
    const directToday = Math.round(rewardToday * 0.32);
    const teamToday = Math.round(rewardToday * 0.5);
    const equalToday = rewardToday - directToday - teamToday;

    const seedUsers = getSeedUsers();
    const tierCount = (tier: string) => seedUsers.filter((u) => u.tier === tier).length;

    return tick({
      summary: {
        platform_total_deposit: String(platformTotal),
        today_deposit: String(todayRow.deposit),
        total_users: seedUsers.length,
        today_new_users: 3,
        reward_24h: {
          direct: String(directToday),
          team: String(teamToday),
          equal_level: String(equalToday),
        },
        burn_today: String(burnToday),
        burn_total: String(
          seedUsers.reduce((sum, u) => sum + u.rewardBurnedTotal, 0),
        ),
        total_locked_posx: '9384692',
        total_released_posx: '102331',
        pending_claims_count: seedUsers.filter((u) => u.status === 'restricted_claim').length,
      },
      trend,
      tier_distribution: [
        { tier: 'elite', count: tierCount('elite') },
        { tier: 'advanced', count: tierCount('advanced') },
        { tier: 'basic', count: tierCount('basic') },
        { tier: 'none', count: tierCount('none') },
      ],
    } as Data);
  },

  // users
  listUsers(query?: Record<string, string | number | undefined>) {
    // Support simple server-side filters the real contract exposes.
    const search = typeof query?.['search'] === 'string' ? query['search'].toLowerCase() : '';
    const status = typeof query?.['status'] === 'string' ? query['status'] : '';
    let items = [...MOCK_USERS];
    if (search) {
      items = items.filter((u) =>
        String(u['wallet_address'] ?? '').toLowerCase().includes(search),
      );
    }
    if (status) {
      items = items.filter((u) => u['status'] === status);
    }
    return tick({
      items,
      pagination: { page: 1, page_size: items.length, total: items.length, has_more: false },
    } as Data);
  },
  getUser(wallet: string) {
    const u = findSeedUser(wallet);
    if (!u) return Promise.reject(new Error('mock: user not found'));
    return tick(asDetail(u) as Data);
  },
  getUserTree(wallet: string) {
    const subtree = seedSubtree(wallet);
    if (subtree.length === 0) {
      return Promise.reject(new Error('mock: wallet not found'));
    }
    return tick({
      root_wallet_address: wallet,
      nodes: subtree.map(asTreeNode),
    } as Data);
  },
  updateUserStatus(wallet: string) {
    return tick({ wallet_address: wallet, updated: true } as Data);
  },

  // rewards
  rewardsDirect() {
    const rows = getSeedUsers()
      .filter((u) => u.rewardDirectTotal > 0)
      .map(asRewardDirectRow);
    return tick(paginated(rows) as Data);
  },
  rewardsTeam() {
    const rows = getSeedUsers()
      .filter((u) => u.rewardTeamTotal > 0)
      .map(asRewardTeamRow);
    return tick(paginated(rows) as Data);
  },
  rewardsTeamDetail(id: string) {
    return tick({
      team_reward_daily_id: id,
      wallet_address: '0xdeadbeef00000000000000000000000000000001',
      lines: [],
    } as Data);
  },
  rewardsEqualLevel() {
    const rows = getSeedUsers()
      .filter((u) => u.rewardEqualTotal > 0)
      .map(asRewardEqualRow);
    return tick(paginated(rows) as Data);
  },
  rewardsBurns() {
    const rows = getSeedUsers()
      .filter((u) => u.rewardBurnedTotal > 0)
      .map(asRewardBurnRow);
    return tick(paginated(rows) as Data);
  },

  // config
  listConfig() {
    // Returns the full fixture — the page performs all grouping /
    // current / future / history derivation client-side via
    // `pages/config/derive.ts`. The shape matches the real contract:
    // `{ items: ConfigVersion[] }`.
    const items = getConfigFixture() as unknown as Data[];
    return tick({ items } as Data);
  },
  createConfig(body: {
    config_group: string;
    config_key: string;
    config_value: Record<string, unknown>;
    effective_from: string;
    apply_scope: string;
    description?: string;
  }) {
    // Mock accepts the write and echoes a fake version id — the real
    // backend performs schema validation and persists a new row.
    const fake: ConfigVersionRecord = {
      config_version_id: `mock-config-${Date.now()}`,
      config_group: body.config_group,
      config_key: body.config_key,
      version_no: 99,
      config_value: body.config_value,
      effective_from: body.effective_from,
      apply_scope: body.apply_scope as ConfigVersionRecord['apply_scope'],
      status: 'active',
      description: body.description ?? '',
      created_by: 'mock-operator',
      created_at: new Date().toISOString(),
    };
    return tick(fake as unknown as Data);
  },

  // settlement
  listSettlementJobs() {
    return tick(
      paginated([
        {
          settlement_job_id: 'mock-settlement-latest',
          job_type: 'daily_settlement',
          mode: 'official',
          settlement_date: new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          status: 'completed',
          processed_user_count: 22,
          created_snapshot_count: 18,
          created_adjustment_count: 0,
          error_count: 0,
          started_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
          finished_at: new Date(Date.now() - 23 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
        },
      ]) as Data,
    );
  },
  triggerSettlement() {
    return tick({ settlement_job_id: 'mock-job-1', status: 'completed' } as Data);
  },
  recomputePreview() {
    return tick({ settlement_job_id: 'mock-recompute-preview', status: 'completed' } as Data);
  },
  recomputeApply() {
    return tick({ settlement_job_id: 'mock-recompute-apply', status: 'completed' } as Data);
  },

  // reports
  teamRanking() {
    const rows = getSeedUsers()
      .slice()
      .sort((a, b) => b.teamPerformance - a.teamPerformance)
      .slice(0, 30)
      .map((u, idx) => ({ rank: idx + 1, ...asTeamRankingRow(u) }));
    return tick({
      items: rows,
      pagination: { page: 1, page_size: rows.length, total: rows.length, has_more: false },
    } as Data);
  },
  createExport(body: { report_type: string; filters?: Record<string, unknown> }) {
    const id = `mock-export-${Date.now()}`;
    const now = new Date().toISOString();
    const job: MockExportJob = {
      id,
      report_type: body.report_type,
      status: 'completed',
      file_path: `mem://${id}`,
      error_message: null,
      created_at: now,
      finished_at: now,
    };
    mockExports.push(job);
    return tick({
      report_export_job_id: id,
      id,
      status: job.status,
      file_path: job.file_path,
      error_message: null,
      row_count: 0,
      created_at: now,
      finished_at: now,
    } as Data);
  },
  getExport(id: string) {
    const job = mockExports.find((j) => j.id === id);
    if (!job) return Promise.reject(new Error('mock: export not found'));
    return tick(job as unknown as Data);
  },
  runExport(id: string) {
    return tick({ id, status: 'completed' } as Data);
  },
  exportDownloadUrl(id: string): string {
    return `data:text/csv;charset=utf-8,mock%20export%20${id}`;
  },

  // system
  chainSync() {
    return tick({
      items: [
        {
          chain_id: 1,
          contract_address: '0x0000000000000000000000000000000000000001',
          sync_key: 'purchase_tracker',
          last_scanned_block: 20_100_500,
          last_confirmed_block: 20_100_495,
          updated_at: new Date().toISOString(),
        },
      ],
    } as Data);
  },
  jobRuns() {
    return tick(
      paginated([
        {
          job_run_id: 'mock-job-run-1',
          job_name: 'daily_settlement',
          status: 'completed',
          started_at: '2026-04-13T00:10:00.000Z',
          finished_at: '2026-04-13T00:12:30.000Z',
          rows_processed: 5,
          rows_failed: 0,
          error_message: null,
        },
      ]) as Data,
    );
  },
  systemHealth() {
    return tick({
      checks: [
        { health_key: 'database', status: 'ok', detail: { latency_ms: 3 } },
        { health_key: 'chain_sync', status: 'ok', detail: { lag_blocks: 5 } },
        { health_key: 'settlement_worker', status: 'ok', detail: { last_run: 'today' } },
        { health_key: 'edge_function', status: 'ok', detail: { p99_ms: 142 } },
        { health_key: 'claim_broadcaster', status: 'warn', detail: { queue_depth: 4 } },
        { health_key: 'vesting_release', status: 'ok', detail: { next_in: '4h' } },
      ],
    } as Data);
  },
  logs() {
    const now = Date.now();
    const items: Data[] = [
      {
        admin_log_id: 'mock-log-1',
        admin_user_id: 'mock-admin-super',
        action: 'trigger_settlement',
        target_type: 'settlement_job',
        target_id: 'job-0042',
        created_at: new Date(now - 12 * 60 * 1000).toISOString(),
      },
      {
        admin_log_id: 'mock-log-2',
        admin_user_id: 'mock-admin-operator',
        action: 'create_report_export',
        target_type: 'report_export_job',
        target_id: 'exp-0128',
        created_at: new Date(now - 27 * 60 * 1000).toISOString(),
      },
      {
        admin_log_id: 'mock-log-3',
        admin_user_id: 'mock-admin-operator',
        action: 'update_user_status',
        target_type: 'user',
        target_id: '0xdeadbeef00000000000000000000000000000006',
        created_at: new Date(now - 54 * 60 * 1000).toISOString(),
      },
      {
        admin_log_id: 'mock-log-4',
        admin_user_id: 'mock-admin-super',
        action: 'create_config_version',
        target_type: 'config_version',
        target_id: 'cfg-pricing-v12',
        created_at: new Date(now - 90 * 60 * 1000).toISOString(),
      },
      {
        admin_log_id: 'mock-log-5',
        admin_user_id: 'mock-admin-super',
        action: 'recompute_preview',
        target_type: 'settlement_job',
        target_id: 'job-0038',
        created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      },
    ];
    return tick({
      items,
      pagination: { page: 1, page_size: 20, total: items.length, has_more: false },
    } as Data);
  },

  // admin accounts
  listAdmins() {
    return tick({ items: MOCK_ADMINS } as Data);
  },
  createAdmin(body: {
    email: string;
    password: string;
    name: string;
    role: string;
    reason?: string;
  }) {
    const row = {
      admin_user_id: `mock-admin-${Date.now()}`,
      email: body.email,
      name: body.name,
      role: body.role,
      status: 'active',
      last_login_at: null,
      created_at: new Date().toISOString(),
    };
    MOCK_ADMINS.push(row);
    return tick(row as Data);
  },
  updateAdmin(
    id: string,
    body: {
      role?: string;
      status?: string;
      name?: string;
      reason?: string;
      rotate_session?: boolean;
    },
  ) {
    return tick({ admin_user_id: id, ...body } as Data);
  },
};
