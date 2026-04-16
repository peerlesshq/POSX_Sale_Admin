/**
 * Rich team-graph fixture data.
 *
 * Generates ~40 users in a 5-level deterministic referral tree so the
 * `/network/team` page has something meaningful to render in mock mode.
 *
 * Design rules:
 *   1. NEVER change API contract field names — this fixture only fills
 *      in the fields that were previously returning `null` or `'0'`.
 *   2. Deterministic. The same tree shows up on every page load.
 *   3. Derive team_size / team_performance / rewards from the spec
 *      so running the numbers in the UI matches the tree topology.
 *   4. Every derived number is a STRING in the API response (the real
 *      contract stores amounts as decimal strings).
 */

export type SeedUserStatus = 'active' | 'restricted_purchase' | 'restricted_claim' | 'suspended';

/**
 * Tree spec: [child_id, parent_id, tier, personal_deposit, status?]
 *
 * id = 1 is the root (no parent). IDs are dense from 1..40.
 * Every id referenced as a parent must appear earlier in the spec so
 * BFS / toposort processing works in one pass.
 */
const TREE_SPEC: ReadonlyArray<readonly [number, number | null, string, number, SeedUserStatus?]> = [
  [1, null, 'elite', 520000],
  // L1 under root
  [2, 1, 'elite', 420000],
  [3, 1, 'advanced', 210000],
  [4, 1, 'advanced', 165000],
  [5, 1, 'basic', 48000, 'restricted_purchase'],
  // L2 under 2
  [6, 2, 'elite', 260000],
  [7, 2, 'advanced', 110000],
  [8, 2, 'advanced', 95000],
  // L2 under 3
  [9, 3, 'advanced', 88000],
  [10, 3, 'basic', 34000],
  [11, 3, 'basic', 26000],
  // L2 under 4
  [12, 4, 'advanced', 56000],
  [13, 4, 'basic', 19000],
  // L2 under 5
  [14, 5, 'basic', 14000],
  [15, 5, 'basic', 9500, 'restricted_claim'],
  // L3 under 6
  [16, 6, 'advanced', 128000],
  [17, 6, 'advanced', 92000],
  [18, 6, 'basic', 32000],
  [19, 6, 'basic', 18500],
  // L3 under 7
  [20, 7, 'advanced', 52000],
  [21, 7, 'basic', 36000],
  // L3 under 8
  [22, 8, 'basic', 28000],
  // L3 under 9
  [23, 9, 'advanced', 60000],
  [24, 9, 'basic', 22000],
  // L3 under 10
  [25, 10, 'basic', 14500],
  // L3 under 12
  [26, 12, 'basic', 17000],
  [27, 12, 'basic', 8800, 'suspended'],
  // L3 under 14
  [28, 14, 'basic', 5200],
  // L4 under 16
  [29, 16, 'advanced', 55000],
  [30, 16, 'basic', 36000],
  // L4 under 17
  [31, 17, 'basic', 30000],
  [32, 17, 'basic', 18000],
  // L4 under 20
  [33, 20, 'basic', 24000],
  // L4 under 23
  [34, 23, 'basic', 17000],
  // L4 under 26
  [35, 26, 'basic', 10000],
  // L5 under 29
  [36, 29, 'basic', 13500],
  [37, 29, 'basic', 5500],
  // L5 under 31
  [38, 31, 'basic', 7800],
  // L5 under 33
  [39, 33, 'basic', 4200],
  // L5 under 36
  [40, 36, 'basic', 3100],
];

export interface SeedUser {
  readonly id: number;
  readonly walletAddress: string;
  readonly parentId: number | null;
  readonly parentWallet: string | null;
  readonly tier: string;
  readonly status: SeedUserStatus;
  readonly personalDeposit: number;
  readonly directReferralCount: number;
  readonly teamSize: number;
  readonly teamPerformance: number;
  readonly depth: number;
  readonly rewardDirectTotal: number;
  readonly rewardTeamTotal: number;
  readonly rewardEqualTotal: number;
  readonly rewardBurnedTotal: number;
  readonly rewardClaimableTotal: number;
  readonly teamRate: number; // e.g. 0.03 for 3%
  readonly isPeer: boolean;
  readonly buyCount: number;
  readonly createdAt: string;
}

/** Deterministic wallet for an integer id. */
function walletOf(id: number): string {
  return '0xdeadbeef' + id.toString(16).padStart(32, '0');
}

/**
 * NOW reference for fixtures. Must match any other fixture that
 * depends on "today" so analytics windows line up across tabs.
 */
const FIXTURE_NOW_MS = Date.UTC(2026, 3, 14, 12, 0, 0); // 2026-04-14 12:00 UTC

/**
 * Deterministically spread a user's createdAt across the last 55 days.
 * Uses a simple hash of the id so different users land on different
 * days without obvious clustering.
 */
function spreadDate(id: number): string {
  // Hash id into [0, 55) days ago
  const daysAgo = ((id * 17 + 3) % 55);
  // Scatter within the day too (hours 0-23)
  const hour = (id * 7) % 24;
  const minute = (id * 13) % 60;
  const d = new Date(FIXTURE_NOW_MS);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Team rate by tier. */
function rateOf(tier: string): number {
  if (tier === 'elite') return 0.03;
  if (tier === 'advanced') return 0.015;
  return 0;
}

/** Direct reward rate per downline purchase, by tier. */
function directRateOf(tier: string): number {
  if (tier === 'elite') return 0.08;
  if (tier === 'advanced') return 0.05;
  return 0.02;
}

/** Equal-level rate — only for elite. */
function equalRateOf(tier: string): number {
  return tier === 'elite' ? 0.005 : 0;
}

interface Work {
  id: number;
  parentId: number | null;
  tier: string;
  status: SeedUserStatus;
  personalDeposit: number;
  children: number[];
  depth: number;
  teamSize: number;
  teamPerformance: number;
}

/**
 * Build the full seed user list. Expensive on the cold path but cached
 * by module-level memoization.
 */
let cachedUsers: readonly SeedUser[] | null = null;

export function getSeedUsers(): readonly SeedUser[] {
  if (cachedUsers) return cachedUsers;

  // 1. Materialize the raw tree into a map
  const map = new Map<number, Work>();
  for (const [id, parentId, tier, personal, status] of TREE_SPEC) {
    map.set(id, {
      id,
      parentId,
      tier,
      status: status ?? 'active',
      personalDeposit: personal,
      children: [],
      depth: 0,
      teamSize: 0,
      teamPerformance: 0,
    });
  }

  // 2. Attach children
  for (const w of map.values()) {
    if (w.parentId !== null) {
      const parent = map.get(w.parentId);
      if (parent) parent.children.push(w.id);
    }
  }

  // 3. BFS depth (from roots downward)
  const roots = Array.from(map.values()).filter((w) => w.parentId === null);
  const queue: number[] = roots.map((r) => r.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const w = map.get(id)!;
    for (const childId of w.children) {
      const child = map.get(childId)!;
      child.depth = w.depth + 1;
      queue.push(childId);
    }
  }

  // 4. Post-order derive team_size and team_performance (sum of
  //    descendants' personal deposits).
  function derive(id: number): { size: number; perf: number } {
    const w = map.get(id)!;
    let size = 0;
    let perf = 0;
    for (const childId of w.children) {
      const child = map.get(childId)!;
      const sub = derive(childId);
      size += 1 + sub.size;
      perf += child.personalDeposit + sub.perf;
    }
    w.teamSize = size;
    w.teamPerformance = perf;
    return { size, perf };
  }
  for (const root of roots) derive(root.id);

  // 5. Compute reward summaries per user
  const out: SeedUser[] = [];
  for (const w of map.values()) {
    // Direct reward ≈ personal deposit × tier direct rate × (some factor)
    //   In reality this is per-referral; for the mock we approximate
    //   by assuming each direct referral contributes their personal
    //   deposit × rate. For UI purposes it just needs to be big enough
    //   to look real and respect the hierarchy.
    let directReward = 0;
    for (const childId of w.children) {
      const child = map.get(childId)!;
      directReward += child.personalDeposit * directRateOf(w.tier);
    }

    const teamReward = w.teamPerformance * rateOf(w.tier);
    const equalReward = w.teamPerformance * equalRateOf(w.tier);
    const gross = directReward + teamReward + equalReward;
    const burn =
      w.status === 'restricted_claim' ? gross * 0.22 :
      w.status === 'suspended' ? gross * 0.5 :
      gross * 0.06;
    const claimable = Math.max(0, gross - burn);

    // Peer flag: advanced/elite with depth >=2
    const isPeer = (w.tier === 'elite' || w.tier === 'advanced') && w.depth >= 2;

    // Simulated buy count: proportional to personal deposit
    const buyCount = Math.max(1, Math.round(w.personalDeposit / 12000));

    out.push({
      id: w.id,
      walletAddress: walletOf(w.id),
      parentId: w.parentId,
      parentWallet: w.parentId === null ? null : walletOf(w.parentId),
      tier: w.tier,
      status: w.status,
      personalDeposit: w.personalDeposit,
      directReferralCount: w.children.length,
      teamSize: w.teamSize,
      teamPerformance: w.teamPerformance,
      depth: w.depth,
      rewardDirectTotal: Math.round(directReward),
      rewardTeamTotal: Math.round(teamReward),
      rewardEqualTotal: Math.round(equalReward),
      rewardBurnedTotal: Math.round(burn),
      rewardClaimableTotal: Math.round(claimable),
      teamRate: rateOf(w.tier),
      isPeer,
      buyCount,
      // Spread createdAt across the last 55 days (relative to NOW =
      // 2026-04-14) so trend/analytics charts have a meaningful
      // distribution. Deterministic: driven by id.
      createdAt: spreadDate(w.id),
    });
  }

  // Sort by id for deterministic order
  out.sort((a, b) => a.id - b.id);
  cachedUsers = out;
  return out;
}

/** Cheap lookup by wallet address. */
export function findSeedUser(wallet: string): SeedUser | undefined {
  return getSeedUsers().find((u) => u.walletAddress === wallet);
}

/** Direct children of a wallet — order matches the spec insertion order. */
export function seedDirectChildren(wallet: string): readonly SeedUser[] {
  const users = getSeedUsers();
  const parent = users.find((u) => u.walletAddress === wallet);
  if (!parent) return [];
  return users.filter((u) => u.parentId === parent.id);
}

/** Ancestors list (root → ... → parent of wallet). */
export function seedAncestors(wallet: string): readonly SeedUser[] {
  const users = getSeedUsers();
  const target = users.find((u) => u.walletAddress === wallet);
  if (!target) return [];
  const out: SeedUser[] = [];
  let cur: SeedUser | undefined = target;
  while (cur && cur.parentWallet) {
    const parent = users.find((u) => u.walletAddress === cur!.parentWallet);
    if (!parent) break;
    out.unshift(parent);
    cur = parent;
  }
  return out;
}

/** Full subtree rooted at wallet (BFS order). */
export function seedSubtree(wallet: string): readonly SeedUser[] {
  const users = getSeedUsers();
  const root = users.find((u) => u.walletAddress === wallet);
  if (!root) return [];
  const out: SeedUser[] = [root];
  const queue: SeedUser[] = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const children = users.filter((u) => u.parentId === cur.id);
    for (const c of children) {
      out.push(c);
      queue.push(c);
    }
  }
  return out;
}

/* ------------------------------------------------------------------
 * Shape helpers for API-contract-compatible responses.
 * ------------------------------------------------------------------ */

/**
 * Row as returned from `listUsers`. Keeps all original field names and
 * adds `referrer_address` (which the real contract also exposes but the
 * old mock was leaving out).
 */
export function asListRow(u: SeedUser): Record<string, unknown> {
  return {
    wallet_address: u.walletAddress,
    referrer_address: u.parentWallet,
    status: u.status,
    cumulative_deposit: String(u.personalDeposit),
    current_tier: u.tier,
    direct_referral_count: u.directReferralCount,
    team_size: u.teamSize,
    team_total_performance: String(u.teamPerformance),
    created_at: u.createdAt,
  };
}

/** Shape for `/admin/users/:wallet` detail. */
export function asDetail(u: SeedUser): Record<string, unknown> {
  return {
    identity: {
      wallet_address: u.walletAddress,
      status: u.status,
      created_at: u.createdAt,
      first_purchase_at: u.createdAt,
    },
    referral: {
      referrer_address: u.parentWallet,
      bound_at: u.parentWallet ? u.createdAt : null,
      binding_source: u.parentWallet ? 'referral_link' : null,
      direct_referral_count: u.directReferralCount,
      team_size: u.teamSize,
    },
    financial: {
      cumulative_deposit: String(u.personalDeposit),
      holding_value_usdt: String(u.personalDeposit),
      current_tier: u.tier,
      reward_qualified: u.tier !== null,
      team_reward_qualified: u.tier === 'elite' || u.tier === 'advanced',
      personal_performance: String(u.personalDeposit),
      team_total_performance: String(u.teamPerformance),
      buy_count: u.buyCount,
      team_rate: String(u.teamRate),
      is_peer: u.isPeer,
    },
    reward_summary: {
      direct_total: String(u.rewardDirectTotal),
      team_total: String(u.rewardTeamTotal),
      equal_level_total: String(u.rewardEqualTotal),
      claimable_total: String(u.rewardClaimableTotal),
      burned_total: String(u.rewardBurnedTotal),
      total: String(
        u.rewardDirectTotal + u.rewardTeamTotal + u.rewardEqualTotal,
      ),
    },
  };
}

/** Shape for `/admin/users/:wallet/tree` — full subtree nodes. */
export function asTreeNode(u: SeedUser): Record<string, unknown> {
  return {
    wallet_address: u.walletAddress,
    parent_wallet_address: u.parentWallet,
    depth: u.depth,
    status: u.status,
    cumulative_deposit: String(u.personalDeposit),
    current_tier: u.tier,
    direct_referral_count: u.directReferralCount,
    team_size: u.teamSize,
    team_total_performance: String(u.teamPerformance),
  };
}

/** Global rewards lists derived from seed data. */
export function asRewardDirectRow(u: SeedUser): Record<string, unknown> {
  return {
    direct_reward_id: `mock-direct-${u.id}`,
    from_wallet_address: u.parentWallet ?? u.walletAddress,
    to_wallet_address: u.walletAddress,
    reward_amount: String(u.rewardDirectTotal),
    reward_rate: String(0.03),
    rewarded_at: u.createdAt,
  };
}

export function asRewardTeamRow(u: SeedUser): Record<string, unknown> {
  return {
    team_reward_daily_id: `mock-team-${u.id}`,
    wallet_address: u.walletAddress,
    settle_date: u.createdAt.slice(0, 10),
    raw_total: String(u.rewardTeamTotal + u.rewardBurnedTotal),
    burned_amount: String(u.rewardBurnedTotal),
    actual_total: String(u.rewardTeamTotal),
    status: u.status === 'active' ? 'claimable' : 'pending',
  };
}

export function asRewardEqualRow(u: SeedUser): Record<string, unknown> {
  return {
    equal_level_reward_id: `mock-equal-${u.id}`,
    wallet_address: u.walletAddress,
    settle_date: u.createdAt.slice(0, 10),
    raw_amount: String(u.rewardEqualTotal + Math.round(u.rewardBurnedTotal / 3)),
    burned_amount: String(Math.round(u.rewardBurnedTotal / 3)),
    actual_amount: String(u.rewardEqualTotal),
    status: 'claimable',
  };
}

export function asRewardBurnRow(u: SeedUser): Record<string, unknown> {
  return {
    burn_record_id: `mock-burn-${u.id}`,
    wallet_address: u.walletAddress,
    reward_type: 'team',
    settle_date: u.createdAt.slice(0, 10),
    raw_amount: String(u.rewardTeamTotal + u.rewardBurnedTotal),
    burned_amount: String(u.rewardBurnedTotal),
    actual_amount: String(u.rewardTeamTotal),
    reason:
      u.status === 'restricted_claim'
        ? 'claim_restricted'
        : u.status === 'suspended'
          ? 'suspended_account'
          : 'holding_below_threshold',
  };
}

export function asTeamRankingRow(u: SeedUser): Record<string, unknown> {
  return {
    wallet_address: u.walletAddress,
    team_total_performance: String(u.teamPerformance),
    direct_count: u.directReferralCount,
    team_size: u.teamSize,
    current_tier: u.tier,
    team_rate: String(u.teamRate),
    status: u.status,
  };
}
