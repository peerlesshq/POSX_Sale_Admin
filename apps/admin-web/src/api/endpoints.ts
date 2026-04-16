/**
 * Admin-web API surface.
 *
 * Exports two clients:
 *   - `realApi` — fetch-based client against the edge function
 *   - `mockApi` — imported from `./mock`, backed by fixture data
 *
 * The shipping `api` is chosen by `VITE_USE_MOCK_API`. The env loader
 * hard-disables the mock in production, so there is no way for a
 * production bundle to run against it.
 */
import { loadEnv } from '../env';

import { apiRequest } from './client';
import { mockApi } from './mock';

type Query = Record<string, string | number | undefined>;
type Data = Record<string, unknown>;

export const realApi = {
  // auth
  login(email: string, password: string) {
    return apiRequest<{
      admin_user_id: string;
      name: string;
      role: 'super_admin' | 'operator' | 'viewer';
      session_token: string;
      expires_at: string;
    }>({ method: 'POST', path: '/admin/auth/login', body: { email, password }, auth: false });
  },
  logout() {
    return apiRequest<{ logged_out: true }>({ method: 'POST', path: '/admin/auth/logout' });
  },
  dashboard() {
    return apiRequest<Data>({ method: 'GET', path: '/admin/dashboard' });
  },

  // users
  listUsers(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/users', query });
  },
  getUser(wallet: string) {
    return apiRequest<Data>({ method: 'GET', path: `/admin/users/${wallet}` });
  },
  getUserTree(wallet: string, query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: `/admin/users/${wallet}/tree`, query });
  },
  updateUserStatus(
    wallet: string,
    body: {
      target_status: string;
      reason: string;
      effective_from: string;
      note?: string;
    },
  ) {
    return apiRequest<Data>({
      method: 'PATCH',
      path: `/admin/users/${wallet}/status`,
      body,
    });
  },

  // rewards
  rewardsDirect(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/rewards/direct', query });
  },
  rewardsTeam(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/rewards/team', query });
  },
  rewardsTeamDetail(id: string) {
    return apiRequest<Data>({ method: 'GET', path: `/admin/rewards/team/${id}` });
  },
  rewardsEqualLevel(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/rewards/equal-level', query });
  },
  rewardsBurns(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/rewards/burns', query });
  },

  // config
  listConfig(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/config', query });
  },
  createConfig(body: {
    config_group: string;
    config_key: string;
    config_value: Record<string, unknown>;
    effective_from: string;
    apply_scope: string;
    description?: string;
  }) {
    return apiRequest<Data>({ method: 'POST', path: '/admin/config', body });
  },

  // settlement + recompute
  listSettlementJobs(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/settlement/jobs', query });
  },
  triggerSettlement(body: {
    settlement_date: string;
    mode: 'official' | 'backfill';
    reason: string;
  }) {
    return apiRequest<Data>({ method: 'POST', path: '/admin/settlement/trigger', body });
  },
  recomputePreview(body: { settlement_date: string; reason: string }) {
    return apiRequest<Data>({ method: 'POST', path: '/admin/recompute/preview', body });
  },
  recomputeApply(body: { settlement_date: string; reason: string }) {
    return apiRequest<Data>({ method: 'POST', path: '/admin/recompute/apply', body });
  },

  // reports + export worker
  teamRanking(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/reports/rankings/team', query });
  },
  createExport(body: { report_type: string; filters?: Record<string, unknown> }) {
    return apiRequest<Data>({ method: 'POST', path: '/admin/reports/export', body });
  },
  getExport(id: string) {
    return apiRequest<Data>({ method: 'GET', path: `/admin/reports/export/${id}` });
  },
  runExport(id: string) {
    return apiRequest<Data>({ method: 'POST', path: `/admin/reports/export/${id}/run` });
  },
  /**
   * Build the full download URL for a ready export job. Used for
   * `<a href>` links — apiRequest cannot be used because browsers
   * cannot attach custom headers to anchor clicks.
   */
  exportDownloadUrl(id: string): string {
    const env = loadEnv();
    const base = env.apiBaseUrl.replace(/\/$/, '');
    return `${base}/admin/reports/export/${id}/download`;
  },

  // system
  chainSync() {
    return apiRequest<Data>({ method: 'GET', path: '/admin/system/chain-sync' });
  },
  jobRuns(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/system/jobs', query });
  },
  systemHealth() {
    return apiRequest<Data>({ method: 'GET', path: '/admin/system/health' });
  },
  logs(query?: Query) {
    return apiRequest<Data>({ method: 'GET', path: '/admin/logs', query });
  },

  // admin accounts
  listAdmins() {
    return apiRequest<Data>({ method: 'GET', path: '/admin/accounts' });
  },
  createAdmin(body: CreateAdminBody) {
    return apiRequest<Data, CreateAdminBody>({
      method: 'POST',
      path: '/admin/accounts',
      body,
    });
  },
  updateAdmin(id: string, body: UpdateAdminBody) {
    return apiRequest<Data, UpdateAdminBody>({
      method: 'PATCH',
      path: `/admin/accounts/${id}`,
      body,
    });
  },
};

/**
 * Body types for admin-account mutations. Exported so callers can
 * drive their local mutation state off the exact shape the API
 * accepts, removing an entire class of silent type mismatches.
 */
export interface CreateAdminBody {
  email: string;
  password: string;
  name: string;
  role: string;
  /** Operator audit reason — backend requires it for super_admin role. */
  reason?: string;
}

export interface UpdateAdminBody {
  role?: string;
  status?: string;
  name?: string;
  /** Operator audit reason — required for every destructive mutation. */
  reason?: string;
  /** Rotate the current session token for this admin. */
  rotate_session?: boolean;
}

export type AdminApi = typeof realApi;

function selectApi(): AdminApi {
  const env = loadEnv();
  return env.useMockApi ? (mockApi as AdminApi) : realApi;
}

export const api: AdminApi = selectApi();
