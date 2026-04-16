/**
 * Agent Network domain types.
 *
 * These types define the shape that page components consume, independent
 * of whether data comes from a frontend aggregation adapter (today) or a
 * real backend endpoint (`/admin/network/overview`, later). Changing the
 * data source later must NOT require changing these types — the adapter
 * layer is responsible for the mapping.
 *
 * Everything here is read-only; the provider owns the source of truth.
 */

export type NetworkDataSource = 'frontend-aggregate' | 'backend';

export interface DataSourceMeta {
  readonly source: NetworkDataSource;
  /** UTC ISO timestamp of when this snapshot was produced. */
  readonly generatedAt: string;
  /**
   * Human-readable description for a small footnote next to sections
   * that mix aggregate and real data.
   */
  readonly note: string;
}

/** One tier of the agent pyramid (depth = distance from root). */
export interface DepthBucket {
  readonly depth: number;
  readonly agentCount: number;
  readonly activeCount: number;
  readonly teamVolume: string; // decimal string (USDT)
}

/** A head-of-team agent for the leaders table. */
export interface NetworkLeader {
  readonly rank: number;
  readonly walletAddress: string;
  readonly tier: string;
  readonly teamSize: number;
  readonly directCount: number;
  readonly teamVolume: string; // decimal string (USDT)
  readonly active: boolean;
}

/** Top-level network KPIs. */
export interface NetworkOverviewKpis {
  readonly totalAgents: number;
  readonly activeAgents: number;
  readonly maxDepth: number;
  readonly averageDirect: number;
  readonly topLeaderVolume: string; // decimal string (USDT)
  readonly totalTeamVolume: string; // decimal string (USDT)
}

/** Full network overview payload. */
export interface NetworkOverview {
  readonly meta: DataSourceMeta;
  readonly kpis: NetworkOverviewKpis;
  readonly depthDistribution: readonly DepthBucket[];
  readonly topLeaders: readonly NetworkLeader[];
  /** Optional 7-day activity series per depth level for the heatmap. */
  readonly heatmap: readonly {
    readonly depth: number;
    readonly day: string; // YYYY-MM-DD
    readonly activity: number; // 0..1
  }[];
}

/** Hierarchy analysis — same source, different aggregation. */
export interface HierarchyAnalysis {
  readonly meta: DataSourceMeta;
  readonly depthDistribution: readonly DepthBucket[];
  readonly averageChildren: number;
  readonly maxWidth: number;
  readonly totalDepth: number;
}

/** Per-user subtree summary used by the UserTree page. */
export interface UserNetworkSummary {
  readonly walletAddress: string;
  readonly totalNodes: number;
  readonly depth: number;
  readonly directCount: number;
  readonly teamSize: number;
  /** Flat node list suitable for an ECharts `tree` series. */
  readonly nodes: readonly UserNetworkNode[];
}

export interface UserNetworkNode {
  readonly id: string;
  readonly walletAddress: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly directCount: number;
  readonly teamSize: number;
  readonly tier: string | null;
  readonly status: string;
}

/**
 * The provider contract. Any future data source — mock / aggregate / real
 * backend endpoint — must satisfy this interface.
 */
export interface NetworkDataProvider {
  getNetworkOverview(): Promise<NetworkOverview>;
  getHierarchyAnalysis(): Promise<HierarchyAnalysis>;
  getTopLeaders(limit?: number): Promise<readonly NetworkLeader[]>;
  getUserNetwork(walletAddress: string): Promise<UserNetworkSummary>;
}
