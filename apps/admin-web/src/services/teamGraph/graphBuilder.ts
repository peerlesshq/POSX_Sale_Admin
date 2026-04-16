/**
 * Pure graph builder — take a flat user list + supporting tables and
 * produce a TeamGraphSnapshot.
 *
 * No React, no network calls. Testable in isolation.
 */
import Decimal from 'decimal.js';

import type {
  DepthBucket,
  TeamGraphKpis,
  TeamGraphNode,
  TeamGraphSnapshot,
} from './types';

interface RawUserRow {
  wallet_address: string;
  referrer_address: string | null;
  status: string;
  cumulative_deposit: string | number;
  current_tier: string | null;
  direct_referral_count: number;
  team_size?: number;
  team_total_performance?: string | number;
  created_at?: string;
}

interface RawRewardRow {
  wallet_address: string;
  actual_total?: string | number;
  actual_amount?: string | number;
  reward_amount?: string | number;
  burned_amount?: string | number;
  raw_total?: string | number;
  raw_amount?: string | number;
}

interface RawRankingRow {
  wallet_address: string;
  team_rate?: string | number;
}

export interface BuildInput {
  readonly users: readonly RawUserRow[];
  readonly rewardsDirect?: readonly RawRewardRow[];
  readonly rewardsTeam?: readonly RawRewardRow[];
  readonly rewardsEqual?: readonly RawRewardRow[];
  readonly rewardsBurns?: readonly RawRewardRow[];
  readonly teamRanking?: readonly RawRankingRow[];
  readonly source?: 'frontend-aggregate' | 'backend';
  readonly note?: string;
}

function toDec(value: string | number | undefined | null): Decimal {
  if (value == null || value === '') return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

function groupSum(
  rows: readonly RawRewardRow[] | undefined,
  fields: readonly string[],
): Map<string, Decimal> {
  const out = new Map<string, Decimal>();
  if (!rows) return out;
  for (const row of rows) {
    const w = row.wallet_address;
    if (!w) continue;
    let amt = new Decimal(0);
    for (const f of fields) {
      const raw = (row as unknown as Record<string, unknown>)[f];
      if (raw != null && raw !== '') {
        amt = amt.plus(toDec(raw as string));
        break;
      }
    }
    out.set(w, (out.get(w) ?? new Decimal(0)).plus(amt));
  }
  return out;
}

export function buildTeamGraph(input: BuildInput): TeamGraphSnapshot {
  const nodes = new Map<string, TeamGraphNode>();
  const childrenByParent = new Map<string | null, string[]>();

  // Group rewards by wallet
  const directSum = groupSum(input.rewardsDirect, ['reward_amount', 'actual_amount', 'actual_total']);
  const teamSum = groupSum(input.rewardsTeam, ['actual_total', 'actual_amount']);
  const equalSum = groupSum(input.rewardsEqual, ['actual_amount', 'actual_total']);
  const burnSum = groupSum(input.rewardsBurns, ['burned_amount']);

  // Ranking rate lookup
  const rateMap = new Map<string, string>();
  if (input.teamRanking) {
    for (const r of input.teamRanking) {
      if (r.team_rate != null) rateMap.set(r.wallet_address, String(r.team_rate));
    }
  }

  // 1. Seed nodes
  for (const u of input.users) {
    const wallet = u.wallet_address;
    const personal = toDec(u.cumulative_deposit);
    const teamPerf = toDec(u.team_total_performance);
    const direct = directSum.get(wallet) ?? new Decimal(0);
    const team = teamSum.get(wallet) ?? new Decimal(0);
    const equal = equalSum.get(wallet) ?? new Decimal(0);
    const burned = burnSum.get(wallet) ?? new Decimal(0);
    const total = direct.plus(team).plus(equal);

    nodes.set(wallet, {
      walletAddress: wallet,
      parentId: u.referrer_address,
      depth: 0, // filled in pass 2
      tier: u.current_tier ?? 'none',
      status: u.status,
      personalPerformance: personal.toFixed(0),
      teamPerformance: teamPerf.toFixed(0),
      directCount: u.direct_referral_count ?? 0,
      teamSize: u.team_size ?? 0,
      rewardDirect: direct.toFixed(0),
      rewardTeam: team.toFixed(0),
      rewardEqualLevel: equal.toFixed(0),
      rewardBurned: burned.toFixed(0),
      rewardTotal: total.toFixed(0),
      rewardClaimable: total.minus(burned).toFixed(0),
      teamRate: rateMap.get(wallet) ?? '0',
      isPeer: (u.current_tier === 'elite' || u.current_tier === 'advanced') && false,
      buyCount: 0,
      createdAt: u.created_at ?? '',
    });

    const parentKey = u.referrer_address;
    const bucket = childrenByParent.get(parentKey);
    if (bucket) bucket.push(wallet);
    else childrenByParent.set(parentKey, [wallet]);
  }

  // 2. Compute depth via BFS from roots
  const roots = Array.from(childrenByParent.get(null) ?? []);
  // Roots may also include wallets whose referrer is not in the nodes map
  // (unknown parent) — treat those as roots too.
  for (const n of nodes.values()) {
    if (n.parentId && !nodes.has(n.parentId) && !roots.includes(n.walletAddress)) {
      roots.push(n.walletAddress);
    }
  }

  const queue: { id: string; depth: number }[] = roots.map((r) => ({ id: r, depth: 0 }));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const existing = nodes.get(id);
    if (!existing) continue;
    nodes.set(id, { ...existing, depth });
    const children = childrenByParent.get(id) ?? [];
    for (const c of children) queue.push({ id: c, depth: depth + 1 });
  }

  // 3. Compute depth histogram
  const histMap = new Map<number, { total: number; active: number; perf: Decimal }>();
  for (const n of nodes.values()) {
    const bucket = histMap.get(n.depth) ?? { total: 0, active: 0, perf: new Decimal(0) };
    bucket.total += 1;
    if (n.status === 'active') bucket.active += 1;
    bucket.perf = bucket.perf.plus(toDec(n.personalPerformance));
    histMap.set(n.depth, bucket);
  }
  const maxDepth = histMap.size ? Math.max(...histMap.keys()) : 0;
  const depthHistogram: DepthBucket[] = [];
  for (let d = 0; d <= maxDepth; d++) {
    const b = histMap.get(d) ?? { total: 0, active: 0, perf: new Decimal(0) };
    depthHistogram.push({
      depth: d,
      total: b.total,
      active: b.active,
      teamVolume: b.perf.toFixed(0),
    });
  }

  // 4. Top leaders (sorted by team performance)
  const topLeaders = Array.from(nodes.values())
    .slice()
    .sort((a, b) => toDec(b.teamPerformance).comparedTo(toDec(a.teamPerformance)))
    .slice(0, 10);

  // 5. Global KPIs
  const totalDirect = Array.from(nodes.values()).reduce(
    (acc, n) => acc.plus(toDec(n.rewardDirect)),
    new Decimal(0),
  );
  const totalTeam = Array.from(nodes.values()).reduce(
    (acc, n) => acc.plus(toDec(n.rewardTeam)),
    new Decimal(0),
  );
  const totalEqual = Array.from(nodes.values()).reduce(
    (acc, n) => acc.plus(toDec(n.rewardEqualLevel)),
    new Decimal(0),
  );
  const totalBurned = Array.from(nodes.values()).reduce(
    (acc, n) => acc.plus(toDec(n.rewardBurned)),
    new Decimal(0),
  );
  const activeWallets = Array.from(nodes.values()).filter((n) => n.status === 'active').length;
  const walletsWithTeam = Array.from(nodes.values()).filter((n) => n.teamSize > 0).length;
  const totalBindings = Array.from(nodes.values()).filter((n) => n.parentId != null).length;
  const topLeaderVolume = topLeaders[0]?.teamPerformance ?? '0';

  const kpis: TeamGraphKpis = {
    totalWallets: nodes.size,
    totalBindings,
    rootCount: roots.length,
    maxDepth,
    activeWallets,
    walletsWithTeam,
    totalDirectReward: totalDirect.toFixed(0),
    totalTeamReward: totalTeam.toFixed(0),
    totalEqualReward: totalEqual.toFixed(0),
    totalBurned: totalBurned.toFixed(0),
    topLeaderVolume,
  };

  return {
    meta: {
      source: input.source ?? 'frontend-aggregate',
      generatedAt: new Date().toISOString(),
      note:
        input.note ??
        'Aggregated from /admin/users + /admin/rewards/* + /admin/reports/rankings/team',
    },
    nodes,
    roots,
    childrenByParent,
    globalKpis: kpis,
    depthHistogram,
    topLeaders,
  };
}

/** Walk the parent chain up from a node until the root. */
export function computeAncestors(
  snapshot: TeamGraphSnapshot,
  wallet: string,
): readonly TeamGraphNode[] {
  const out: TeamGraphNode[] = [];
  let cur = snapshot.nodes.get(wallet);
  while (cur?.parentId) {
    const parent = snapshot.nodes.get(cur.parentId);
    if (!parent) break;
    out.unshift(parent);
    cur = parent;
  }
  return out;
}

/** Direct children of a wallet. */
export function computeDirectChildren(
  snapshot: TeamGraphSnapshot,
  wallet: string,
): readonly TeamGraphNode[] {
  const ids = snapshot.childrenByParent.get(wallet) ?? [];
  return ids
    .map((id) => snapshot.nodes.get(id))
    .filter((n): n is TeamGraphNode => !!n);
}
