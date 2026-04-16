/**
 * Mock API implementation for user-web.
 *
 * Enabled via VITE_USE_MOCK_API=true (local/staging only — the env
 * loader hard-disables this in production). The mock client is
 * keyed off the currently authenticated wallet: when the dev persona
 * picker writes a fake session, the mock recognises the wallet and
 * returns data appropriate to that persona.
 *
 * This file is structurally identical to `./endpoints.ts` so call
 * sites never need to branch. Every function returns a `Promise<T>`
 * that resolves with the same shape the real API returns.
 *
 * The mock is deliberately SIMPLE. It does not simulate:
 *   - config effective-from windows
 *   - realistic pagination
 *   - multi-day settlement history
 * QA should exercise those paths against the real API + seed.
 */
import { DEV_PERSONAS, findPersonaByWallet, type DevPersona } from '../lib/dev-personas';
import { loadSession } from '../lib/session';

interface MockDataset {
  readonly persona: DevPersona;
}

function currentDataset(): MockDataset | null {
  const session = loadSession();
  if (!session) return null;
  const persona = findPersonaByWallet(session.wallet);
  if (!persona) return null;
  return { persona };
}

function fallbackPersona(): DevPersona {
  return DEV_PERSONAS[0]!;
}

async function tick<T>(value: T, ms = 120): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
}

function rand(wallet: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < wallet.length; i += 1) {
    h = (h * 31 + wallet.charCodeAt(i)) >>> 0;
  }
  return h % 1000;
}

// ---- Canned response builders ----

function buildPublicConfig() {
  return {
    token_price: '0.0618',
    min_purchase_amount: '100',
    quick_amount_options: ['100', '500', '1000', '5000'],
    reward_min_deposit_threshold: '100',
    reward_min_holding_threshold: '100',
    min_claim_amount: '1',
    languages: ['zh-CN', 'zh-TW', 'en', 'ko'],
    theme_options: ['light', 'dark', 'system'],
    announcements: null as Record<string, string> | null,
  };
}

function buildProfile(p: DevPersona) {
  return {
    wallet_address: p.walletAddress,
    status: p.userStatus,
    referrer_address: null as string | null,
    referral_bound: false,
    bound_at: null as string | null,
    cumulative_deposit: p.cumulativeDeposit,
    holding_posx_amount: p.holdingValueUsdt,
    holding_value_usdt: p.holdingValueUsdt,
    current_tier: p.tier,
    reward_qualified: p.tier !== null,
    team_reward_qualified: p.tier === 'elite' || p.tier === 'advanced',
    direct_rate: p.tier === 'elite' ? '0.15' : p.tier === 'advanced' ? '0.12' : '0.10',
    team_rate: p.tier === 'elite' ? '0.03' : p.tier === 'advanced' ? '0.01' : '0',
    created_at: '2026-04-01T00:00:00.000Z',
  };
}

function buildDashboard(p: DevPersona) {
  const direct = String(rand(p.walletAddress, 7));
  const team = String(rand(p.walletAddress, 11));
  const equal = String(rand(p.walletAddress, 13));
  return {
    profile: buildProfile(p),
    claimable: {
      direct_total: direct,
      team_total: team,
      equal_level_total: equal,
      total_claimable: String(Number(direct) + Number(team) + Number(equal)),
    },
    vesting: {
      total_locked: p.cumulativeDeposit,
      total_released: '0',
      total_withdrawable: '0',
      total_withdrawn: '0',
    },
    recent_purchases: p.cumulativeDeposit === '0'
      ? []
      : [
          {
            purchase_id: `mock-${p.key}-1`,
            usdt_amount: p.cumulativeDeposit,
            posx_amount: String(Number(p.cumulativeDeposit) / 0.0618),
            purchase_at: '2026-04-02T10:00:00.000Z',
            tx_hash: `0xmock${p.key}`,
            status: 'confirmed',
          },
        ],
  };
}

function paginated<T>(items: T[]) {
  return {
    items,
    pagination: { page: 1, page_size: 20, total: items.length, has_more: false },
  };
}

// ---- Mock client ----

export const mockApi = {
  // auth — dev bypass never calls these, but keep them valid for
  // test harnesses that call the endpoints directly.
  authNonce(walletAddress: string) {
    return tick({
      wallet_address: walletAddress,
      nonce: 'mock-nonce',
      message_to_sign: `POSX mock | ${walletAddress}`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  },
  authVerify(walletAddress: string) {
    return tick({
      wallet_address: walletAddress,
      session_token: `mock-session-${Date.now()}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      user_status: 'active',
    });
  },
  authLogout() {
    return tick({ logged_out: true as const });
  },

  publicConfig() {
    return tick(buildPublicConfig());
  },

  userProfile() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick(buildProfile(ds.persona));
  },
  userDashboard() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick(buildDashboard(ds.persona) as unknown as Record<string, unknown>);
  },

  // purchase
  createPurchaseOrder(body: {
    client_order_id: string;
    usdt_amount: string;
    expected_token_price?: string;
  }) {
    return tick({
      purchase_order_id: `mock-order-${Date.now()}`,
      client_order_id: body.client_order_id,
      usdt_amount: body.usdt_amount,
      status: 'pending_tx',
    } as unknown as Record<string, unknown>);
  },
  attachPurchaseTx(orderId: string, body: { purchase_tx_hash: string }) {
    return tick({
      purchase_order_id: orderId,
      status: 'tx_submitted',
      purchase_tx_hash: body.purchase_tx_hash,
    } as unknown as Record<string, unknown>);
  },
  getPurchaseOrder(orderId: string) {
    return tick({
      purchase_order_id: orderId,
      status: 'confirmed',
    } as unknown as Record<string, unknown>);
  },
  recoverPurchase(txHash: string) {
    return tick({
      tx_hash: txHash,
      recovered: true,
    } as unknown as Record<string, unknown>);
  },

  // vesting
  vesting() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick(
      paginated(
        ds.persona.cumulativeDeposit === '0'
          ? []
          : [
              {
                vesting_lot_id: `mock-${ds.persona.key}-lot-1`,
                total_locked: ds.persona.cumulativeDeposit,
                released: '0',
                withdrawable: '0',
                withdrawn: '0',
                start_time: '2026-04-02T10:00:00.000Z',
                status: 'active',
              },
            ],
      ) as unknown as Record<string, unknown>,
    );
  },

  // rewards
  rewardOverview() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    const p = ds.persona;
    const direct = rand(p.walletAddress, 7);
    const team = rand(p.walletAddress, 11);
    const equal = rand(p.walletAddress, 13);
    return tick({
      claimable: {
        direct_total: String(direct),
        team_total: String(team),
        equal_level_total: String(equal),
        total_claimable: String(direct + team + equal),
      },
      pending_confirmation: {
        team_total: '0',
        equal_level_total: '0',
      },
      historical: {
        direct_total_earned: String(direct * 2),
        team_total_earned: String(team * 2),
        equal_level_total_earned: String(equal * 2),
        total_burned: p.key === 'burn_user' ? '250' : '0',
      },
    } as unknown as Record<string, unknown>);
  },
  rewardsDirect() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick(
      paginated(
        ds.persona.directReferralCount === 0
          ? []
          : [
              {
                direct_reward_id: `mock-${ds.persona.key}-dr-1`,
                from_wallet_address: `0x${'0'.repeat(38)}01`,
                reward_amount: String(rand(ds.persona.walletAddress, 19)),
                reward_rate: '0.15',
                rewarded_at: '2026-04-03T10:00:00.000Z',
              },
            ],
      ) as unknown as Record<string, unknown>,
    );
  },
  rewardsTeam() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick(
      paginated([
        {
          team_reward_daily_id: `mock-${ds.persona.key}-team-1`,
          settle_date: '2026-04-12',
          raw_total: String(rand(ds.persona.walletAddress, 23)),
          burned_amount: ds.persona.key === 'burn_user' ? '100' : '0',
          actual_total: String(rand(ds.persona.walletAddress, 23)),
          status: 'claimable',
        },
      ]) as unknown as Record<string, unknown>,
    );
  },
  rewardsEqualLevel() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    if (ds.persona.tier !== 'elite') {
      return tick(paginated([]) as unknown as Record<string, unknown>);
    }
    return tick(
      paginated([
        {
          equal_level_reward_id: `mock-${ds.persona.key}-el-1`,
          settle_date: '2026-04-12',
          line_root_wallet_address: `0x${'1'.repeat(38)}02`,
          raw_amount: String(rand(ds.persona.walletAddress, 29)),
          burned_amount: '0',
          actual_amount: String(rand(ds.persona.walletAddress, 29)),
          status: 'claimable',
        },
      ]) as unknown as Record<string, unknown>,
    );
  },
  burnStatus() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick({
      holding_value_usdt: ds.persona.holdingValueUsdt,
      burn_cap: ds.persona.holdingValueUsdt,
      used_burn_capacity: ds.persona.key === 'burn_user' ? '500' : '0',
      remaining_capacity:
        ds.persona.key === 'burn_user'
          ? String(Number(ds.persona.holdingValueUsdt) - 500)
          : ds.persona.holdingValueUsdt,
      burn_active: ds.persona.key === 'burn_user',
    } as unknown as Record<string, unknown>);
  },
  claimHistory() {
    return tick(paginated([]) as unknown as Record<string, unknown>);
  },

  // claims
  createClaim(body: { client_request_id: string; claim_scope: 'claim_all' | 'claim_by_type' }) {
    return tick({
      claim_order_id: `mock-claim-${Date.now()}`,
      client_request_id: body.client_request_id,
      claim_scope: body.claim_scope,
      status: 'pending_signature',
      signed_message: `POSX Mock Claim | request:${body.client_request_id}`,
      requested_total_amount: '1000',
    } as unknown as Record<string, unknown>);
  },
  signClaim(claimOrderId: string) {
    return tick({
      claim_order_id: claimOrderId,
      status: 'queued',
    } as unknown as Record<string, unknown>);
  },
  getClaim(claimOrderId: string) {
    return tick({
      claim_order_id: claimOrderId,
      status: 'confirmed',
      broadcast_tx_hash: '0xmock-claim-broadcast',
    } as unknown as Record<string, unknown>);
  },

  // team
  teamOverview() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    return tick({
      team_total_performance: String(rand(ds.persona.walletAddress, 31) * 10),
      direct_count: ds.persona.directReferralCount,
      current_team_rate:
        ds.persona.tier === 'elite' ? '0.03' : ds.persona.tier === 'advanced' ? '0.01' : '0',
    } as unknown as Record<string, unknown>);
  },
  teamMembers() {
    return tick(paginated([]) as unknown as Record<string, unknown>);
  },
  teamDailyDetails() {
    return tick(paginated([]) as unknown as Record<string, unknown>);
  },

  // invite
  invite() {
    const ds = currentDataset() ?? { persona: fallbackPersona() };
    const locked = ds.persona.cumulativeDeposit === '0';
    return tick({
      locked,
      reason: locked ? 'purchase_required' : null,
      invite_code: locked ? null : `MOCK-${ds.persona.key.toUpperCase().slice(0, 6)}`,
      invite_link: locked ? null : `https://posx.example/?ref=${ds.persona.walletAddress}`,
    } as unknown as Record<string, unknown>);
  },
  inviteReferrals() {
    return tick(paginated([]) as unknown as Record<string, unknown>);
  },
};
