/**
 * Pure helpers for mapping raw admin API rows into the network domain.
 * Kept separate from the provider so unit tests can hit them directly
 * and so the provider file stays readable.
 */
import type { DepthBucket, NetworkLeader } from './types';

interface RawLeaderRow {
  rank: number;
  walletAddress: string;
  tier: string;
  teamSize: number;
  directCount: number;
  teamVolume: string;
}

export function mapTeamRankingToLeaders(rows: readonly RawLeaderRow[]): NetworkLeader[] {
  return rows
    .filter((r) => r.walletAddress.length > 0)
    .map((r, idx) => ({
      rank: r.rank || idx + 1,
      walletAddress: r.walletAddress,
      tier: r.tier || 'none',
      teamSize: r.teamSize,
      directCount: r.directCount,
      teamVolume: r.teamVolume || '0',
      active: true,
    }));
}

/**
 * Synthesize a depth distribution from the user list. Each user's
 * "depth" is inferred from their direct-count and team-size buckets —
 * not a real BFS walk of the referral graph, which the frontend cannot
 * do without a dedicated endpoint. The bucketisation is deterministic
 * so the page stays stable between refreshes.
 */
export function synthesizeDepthDistribution(userRows: ReadonlyArray<Record<string, unknown>>): DepthBucket[] {
  const buckets = new Map<number, DepthBucket>();

  // Deterministic bucket assignment
  const pick = (row: Record<string, unknown>): number => {
    const team = Number(row['team_size'] ?? row['direct_referral_count'] ?? 0);
    if (team >= 50) return 0;
    if (team >= 20) return 1;
    if (team >= 10) return 2;
    if (team >= 5) return 3;
    if (team >= 2) return 4;
    if (team >= 1) return 5;
    return 6;
  };

  for (const row of userRows) {
    const depth = pick(row);
    const existing = buckets.get(depth);
    const volume = Number(row['cumulative_deposit'] ?? 0);
    const isActive = String(row['status'] ?? '') === 'active';
    if (existing) {
      buckets.set(depth, {
        depth,
        agentCount: existing.agentCount + 1,
        activeCount: existing.activeCount + (isActive ? 1 : 0),
        teamVolume: (Number(existing.teamVolume || '0') + volume).toFixed(0),
      });
    } else {
      buckets.set(depth, {
        depth,
        agentCount: 1,
        activeCount: isActive ? 1 : 0,
        teamVolume: volume.toFixed(0),
      });
    }
  }

  // Fill missing depths with zeros so the chart always shows a full ladder
  const maxDepth = Math.max(0, ...Array.from(buckets.keys()));
  const out: DepthBucket[] = [];
  for (let d = 0; d <= maxDepth; d++) {
    out.push(
      buckets.get(d) ?? {
        depth: d,
        agentCount: 0,
        activeCount: 0,
        teamVolume: '0',
      },
    );
  }
  return out;
}

/**
 * Build a 7-day activity heatmap from the depth distribution. Uses a
 * deterministic pseudo-random seeded by depth so the preview looks like
 * real telemetry without being genuinely random between refreshes.
 */
export function synthesizeHeatmap(depthDistribution: readonly DepthBucket[]): ReadonlyArray<{
  readonly depth: number;
  readonly day: string;
  readonly activity: number;
}> {
  const today = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const out: { depth: number; day: string; activity: number }[] = [];
  for (const bucket of depthDistribution) {
    for (let idx = 0; idx < days.length; idx++) {
      // Deterministic but varied
      const base = bucket.agentCount === 0 ? 0 : bucket.activeCount / Math.max(1, bucket.agentCount);
      const wiggle = Math.sin((bucket.depth + 1) * 1.3 + idx * 0.7) * 0.15 + 0.1;
      const value = Math.max(0, Math.min(1, base + wiggle));
      out.push({ depth: bucket.depth, day: days[idx]!, activity: Number(value.toFixed(2)) });
    }
  }
  return out;
}
