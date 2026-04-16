/**
 * Thin endpoint helpers. Every function returns the `data` field of
 * the envelope (the raw wire type). React Query hooks wrap these.
 *
 * Phase 6: the shipping `api` selects between `realApi` (this file)
 * and `mockApi` based on `VITE_USE_MOCK_API`. The env loader hard-
 * disables the mock in production.
 */
import { loadEnv } from '../env';

import { apiRequest } from './client';
import { mockApi } from './mock';

export const realApi = {
  // ---- auth ----
  authNonce(walletAddress: string) {
    return apiRequest<{
      wallet_address: string;
      nonce: string;
      message_to_sign: string;
      expires_at: string;
    }>({
      method: 'POST',
      path: '/auth/nonce',
      body: { wallet_address: walletAddress },
      auth: false,
    });
  },
  authVerify(walletAddress: string, nonce: string, signature: string) {
    return apiRequest<{
      wallet_address: string;
      session_token: string;
      expires_at: string;
      user_status: string;
    }>({
      method: 'POST',
      path: '/auth/verify',
      body: { wallet_address: walletAddress, nonce, signature },
      auth: false,
    });
  },
  authLogout() {
    return apiRequest<{ logged_out: true }>({ method: 'POST', path: '/auth/logout' });
  },

  // ---- public config ----
  publicConfig() {
    return apiRequest<{
      token_price: string;
      min_purchase_amount: string;
      quick_amount_options: string[];
      reward_min_deposit_threshold: string;
      reward_min_holding_threshold: string;
      min_claim_amount: string;
      languages: string[];
      theme_options: string[];
      announcements: Record<string, string> | null;
    }>({ method: 'GET', path: '/config/public', auth: false });
  },

  // ---- user profile + dashboard ----
  userProfile() {
    return apiRequest<{
      wallet_address: string;
      status: string;
      referrer_address: string | null;
      referral_bound: boolean;
      bound_at: string | null;
      cumulative_deposit: string;
      holding_posx_amount: string;
      holding_value_usdt: string;
      current_tier: string | null;
      reward_qualified: boolean;
      team_reward_qualified: boolean;
      direct_rate: string | null;
      team_rate: string | null;
      created_at: string;
    }>({ method: 'GET', path: '/user/profile' });
  },
  userDashboard() {
    return apiRequest<Record<string, unknown>>({ method: 'GET', path: '/user/dashboard' });
  },

  // ---- purchase ----
  createPurchaseOrder(body: {
    client_order_id: string;
    usdt_amount: string;
    expected_token_price?: string;
  }) {
    return apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/purchases/orders',
      body,
    });
  },
  attachPurchaseTx(orderId: string, body: { purchase_tx_hash: string; approval_tx_hash?: string }) {
    return apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: `/purchases/orders/${orderId}/tx`,
      body,
    });
  },
  getPurchaseOrder(orderId: string) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: `/purchases/orders/${orderId}`,
    });
  },
  recoverPurchase(txHash: string) {
    return apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: '/purchases/recover',
      body: { tx_hash: txHash },
    });
  },

  // ---- vesting ----
  vesting(page = 1, pageSize = 20) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/vesting',
      query: { page, page_size: pageSize },
    });
  },

  // ---- rewards ----
  rewardOverview() {
    return apiRequest<Record<string, unknown>>({ method: 'GET', path: '/rewards/overview' });
  },
  rewardsDirect(query?: Record<string, string | number | undefined>) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/rewards/direct',
      query,
    });
  },
  rewardsTeam(query?: Record<string, string | number | undefined>) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/rewards/team',
      query,
    });
  },
  rewardsEqualLevel(query?: Record<string, string | number | undefined>) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/rewards/equal-level',
      query,
    });
  },
  burnStatus() {
    return apiRequest<Record<string, unknown>>({ method: 'GET', path: '/rewards/burn-status' });
  },
  claimHistory() {
    return apiRequest<Record<string, unknown>>({ method: 'GET', path: '/rewards/claims' });
  },

  // ---- claims ----
  createClaim(body: { client_request_id: string; claim_scope: 'claim_all' | 'claim_by_type' }) {
    return apiRequest<Record<string, unknown>>({ method: 'POST', path: '/claims', body });
  },
  signClaim(claimOrderId: string, signature: string) {
    return apiRequest<Record<string, unknown>>({
      method: 'POST',
      path: `/claims/${claimOrderId}/sign`,
      body: { signature },
    });
  },
  getClaim(claimOrderId: string) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: `/claims/${claimOrderId}`,
    });
  },

  // ---- team ----
  teamOverview() {
    return apiRequest<Record<string, unknown>>({ method: 'GET', path: '/team/overview' });
  },
  teamMembers(query?: Record<string, string | number | undefined>) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/team/members',
      query,
    });
  },
  teamDailyDetails(query?: Record<string, string | number | undefined>) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/team/daily-details',
      query,
    });
  },

  // ---- invite ----
  invite() {
    return apiRequest<Record<string, unknown>>({ method: 'GET', path: '/invite' });
  },
  inviteReferrals(query?: Record<string, string | number | undefined>) {
    return apiRequest<Record<string, unknown>>({
      method: 'GET',
      path: '/invite/referrals',
      query,
    });
  },
};

export type UserApi = typeof realApi;

function selectApi(): UserApi {
  const env = loadEnv();
  return env.useMockApi ? (mockApi as unknown as UserApi) : realApi;
}

export const api: UserApi = selectApi();
