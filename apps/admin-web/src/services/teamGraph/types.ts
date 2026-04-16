/**
 * TeamGraph domain types — the shape consumed by `/network/team`.
 *
 * These are frontend-layer types decoupled from the API contract. The
 * provider maps raw API rows into these. When the backend ships a real
 * `/admin/network/overview` endpoint we only swap providers, not types.
 */

export type TeamGraphDataSource = 'frontend-aggregate' | 'backend';

export interface TeamGraphMeta {
  readonly source: TeamGraphDataSource;
  readonly generatedAt: string;
  readonly note: string;
}

/** One wallet in the graph. */
export interface TeamGraphNode {
  readonly walletAddress: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly tier: string;
  readonly status: string;
  readonly personalPerformance: string;
  readonly teamPerformance: string;
  readonly directCount: number;
  readonly teamSize: number;
  readonly rewardDirect: string;
  readonly rewardTeam: string;
  readonly rewardEqualLevel: string;
  readonly rewardBurned: string;
  readonly rewardTotal: string;
  readonly rewardClaimable: string;
  readonly teamRate: string;
  readonly isPeer: boolean;
  readonly buyCount: number;
  readonly createdAt: string;
}

/** Full graph snapshot — produced once, then queried locally. */
export interface TeamGraphSnapshot {
  readonly meta: TeamGraphMeta;
  readonly nodes: ReadonlyMap<string, TeamGraphNode>;
  readonly roots: readonly string[];
  /** Parent wallet → array of child wallets. `null` key = roots. */
  readonly childrenByParent: ReadonlyMap<string | null, readonly string[]>;
  readonly globalKpis: TeamGraphKpis;
  readonly depthHistogram: readonly DepthBucket[];
  readonly topLeaders: readonly TeamGraphNode[];
}

export interface TeamGraphKpis {
  readonly totalWallets: number;
  readonly totalBindings: number;
  readonly rootCount: number;
  readonly maxDepth: number;
  readonly activeWallets: number;
  readonly walletsWithTeam: number;
  readonly totalDirectReward: string;
  readonly totalTeamReward: string;
  readonly totalEqualReward: string;
  readonly totalBurned: string;
  readonly topLeaderVolume: string;
}

export interface DepthBucket {
  readonly depth: number;
  readonly total: number;
  readonly active: number;
  readonly teamVolume: string;
}

/** The narrow interface the network page depends on. */
export interface TeamGraphProvider {
  getSnapshot(): Promise<TeamGraphSnapshot>;
}
