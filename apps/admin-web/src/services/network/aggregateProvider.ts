/**
 * Frontend aggregate `NetworkDataProvider`.
 *
 * This is the Phase-7 interim implementation. It composes existing admin
 * endpoints (user list, team ranking, user tree) into a synthetic view
 * for the `/network` pages. Every returned payload is clearly marked as
 * `source: 'frontend-aggregate'` via `DataSourceMeta` so the UI can
 * render a "Client aggregate" chip next to affected sections.
 *
 * When the backend ships `/admin/network/overview`, swap this file out
 * for `backendProvider.ts` via `networkProvider.ts` — no page component
 * should change.
 *
 * Non-goals:
 *   - 100% statistical accuracy. The aggregate runs in the browser on a
 *     bounded user list, so tail agents may be missed. That is OK for
 *     operations at Phase 7 scope — leaders and depth buckets use the
 *     team-ranking endpoint which is authoritative.
 *   - Replacing the backend. This is a product bridge, not a spec.
 */
import Decimal from 'decimal.js';

import { api } from '../../api/endpoints';
import { mapTeamRankingToLeaders, synthesizeDepthDistribution, synthesizeHeatmap } from './mappers';
import type {
  HierarchyAnalysis,
  NetworkDataProvider,
  NetworkLeader,
  NetworkOverview,
  NetworkOverviewKpis,
  UserNetworkNode,
  UserNetworkSummary,
} from './types';

type Row = Record<string, unknown>;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const aggregateNetworkProvider: NetworkDataProvider = {
  async getNetworkOverview(): Promise<NetworkOverview> {
    // Pull enough source rows to synthesize a realistic aggregate. In a
    // production context the backend would expose a dedicated endpoint
    // that does this in one query.
    const [usersRes, rankingRes] = await Promise.all([
      api.listUsers({ page: 1, page_size: 200 }),
      api.teamRanking({ page: 1, page_size: 20 }),
    ]);

    const userItems = (usersRes['items'] as Row[]) ?? [];
    const leaders = mapTeamRankingToLeaders(
      ((rankingRes['items'] as Row[]) ?? []).map((r) => ({
        rank: num(r['rank']),
        walletAddress: str(r['wallet_address']),
        tier: str(r['tier'], 'none'),
        teamSize: num(r['team_size']),
        directCount: num(r['direct_count']),
        teamVolume: str(r['team_total_performance'], '0'),
      })),
    );

    const depthDistribution = synthesizeDepthDistribution(userItems);
    const heatmap = synthesizeHeatmap(depthDistribution);

    const totalAgents = userItems.length;
    const activeAgents = userItems.filter((r) => str(r['status']) === 'active').length;
    const maxDepth = depthDistribution.length
      ? Math.max(...depthDistribution.map((d) => d.depth))
      : 0;
    const totalDirect = userItems.reduce(
      (acc, r) => acc + num(r['direct_referral_count']),
      0,
    );
    const averageDirect = totalAgents ? Number((totalDirect / totalAgents).toFixed(2)) : 0;
    const topLeaderVolume = leaders[0]?.teamVolume ?? '0';
    const totalTeamVolume = leaders
      .reduce((acc, l) => acc.plus(new Decimal(l.teamVolume || 0)), new Decimal(0))
      .toFixed(0);

    const kpis: NetworkOverviewKpis = {
      totalAgents,
      activeAgents,
      maxDepth,
      averageDirect,
      topLeaderVolume,
      totalTeamVolume,
    };

    return {
      meta: {
        source: 'frontend-aggregate',
        generatedAt: nowIso(),
        note: 'Aggregated from /admin/users + /admin/reports/rankings/team',
      },
      kpis,
      depthDistribution,
      topLeaders: leaders,
      heatmap,
    };
  },

  async getHierarchyAnalysis(): Promise<HierarchyAnalysis> {
    const overview = await this.getNetworkOverview();
    const depths = overview.depthDistribution;
    const totalDepth = depths.length ? Math.max(...depths.map((d) => d.depth)) : 0;
    const maxWidth = depths.length ? Math.max(...depths.map((d) => d.agentCount)) : 0;
    const averageChildren = Number(overview.kpis.averageDirect.toFixed(2));

    return {
      meta: {
        source: 'frontend-aggregate',
        generatedAt: nowIso(),
        note: 'Derived from network overview aggregate',
      },
      depthDistribution: depths,
      averageChildren,
      maxWidth,
      totalDepth,
    };
  },

  async getTopLeaders(limit = 10): Promise<readonly NetworkLeader[]> {
    const res = await api.teamRanking({ page: 1, page_size: limit });
    return mapTeamRankingToLeaders(
      ((res['items'] as Row[]) ?? []).map((r) => ({
        rank: num(r['rank']),
        walletAddress: str(r['wallet_address']),
        tier: str(r['tier'], 'none'),
        teamSize: num(r['team_size']),
        directCount: num(r['direct_count']),
        teamVolume: str(r['team_total_performance'], '0'),
      })),
    );
  },

  async getUserNetwork(walletAddress: string): Promise<UserNetworkSummary> {
    const tree = await api.getUserTree(walletAddress);
    const rawNodes = (tree['nodes'] as Row[]) ?? [];

    // Normalise nodes — backend structure is flat with parent pointers.
    const nodes: UserNetworkNode[] = rawNodes.map((r, idx) => ({
      id: str(r['wallet_address'], `node-${idx}`),
      walletAddress: str(r['wallet_address']),
      parentId:
        (r['parent_wallet_address'] as string | null | undefined) ??
        (idx === 0 ? null : walletAddress),
      depth: num(r['depth']),
      directCount: num(r['direct_count']),
      teamSize: num(r['team_size']),
      tier: (r['current_tier'] as string | null | undefined) ?? null,
      status: str(r['status'], 'unknown'),
    }));

    const root = nodes.find((n) => n.parentId === null) ?? nodes[0];
    const depth = nodes.length ? Math.max(...nodes.map((n) => n.depth)) : 0;
    const directCount = nodes.filter((n) => n.parentId === root?.id).length;

    return {
      walletAddress,
      totalNodes: nodes.length,
      depth,
      directCount,
      teamSize: Math.max(0, nodes.length - 1),
      nodes,
    };
  },
};
