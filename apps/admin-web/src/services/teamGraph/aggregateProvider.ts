/**
 * Frontend-aggregate TeamGraphProvider.
 *
 * Composes `/admin/users`, `/admin/rewards/*`, and
 * `/admin/reports/rankings/team` into a `TeamGraphSnapshot`. This is
 * the Phase 7 interim implementation — when the backend ships a real
 * `/admin/network/overview` endpoint we swap this out, page code
 * stays the same.
 */
import { api } from '../../api/endpoints';

import { buildTeamGraph } from './graphBuilder';
import type { TeamGraphProvider, TeamGraphSnapshot } from './types';

type Row = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export const aggregateTeamGraphProvider: TeamGraphProvider = {
  async getSnapshot(): Promise<TeamGraphSnapshot> {
    // Pull everything we need in parallel.
    const [usersRes, directRes, teamRes, equalRes, burnsRes, rankingRes] = await Promise.all([
      api.listUsers({ page: 1, page_size: 500 }),
      api.rewardsDirect({ page: 1, page_size: 500 }),
      api.rewardsTeam({ page: 1, page_size: 500 }),
      api.rewardsEqualLevel({ page: 1, page_size: 500 }),
      api.rewardsBurns({ page: 1, page_size: 500 }),
      api.teamRanking({ page: 1, page_size: 200 }),
    ]);

    const userRows = ((usersRes['items'] as Row[]) ?? []).map((r) => ({
      wallet_address: asString(r['wallet_address']),
      referrer_address:
        (r['referrer_address'] as string | null | undefined) ?? null,
      status: asString(r['status'], 'unknown'),
      cumulative_deposit: asString(r['cumulative_deposit'], '0'),
      current_tier: (r['current_tier'] as string | null) ?? null,
      direct_referral_count: asNum(r['direct_referral_count']),
      team_size: asNum(r['team_size']),
      team_total_performance: asString(r['team_total_performance'], '0'),
      created_at: asString(r['created_at']),
    }));

    const mapReward = (rows: unknown) =>
      ((rows as Row[]) ?? []).map((r) => ({
        wallet_address:
          asString(r['wallet_address']) ||
          asString(r['to_wallet_address']),
        reward_amount: asString(r['reward_amount']),
        actual_total: asString(r['actual_total']),
        actual_amount: asString(r['actual_amount']),
        burned_amount: asString(r['burned_amount']),
        raw_total: asString(r['raw_total']),
        raw_amount: asString(r['raw_amount']),
      }));

    const rankingRows = ((rankingRes['items'] as Row[]) ?? []).map((r) => ({
      wallet_address: asString(r['wallet_address']),
      team_rate: asString(r['team_rate'], '0'),
    }));

    return buildTeamGraph({
      users: userRows,
      rewardsDirect: mapReward(directRes['items']),
      rewardsTeam: mapReward(teamRes['items']),
      rewardsEqual: mapReward(equalRes['items']),
      rewardsBurns: mapReward(burnsRes['items']),
      teamRanking: rankingRows,
      source: 'frontend-aggregate',
      note: 'Aggregated on the client from /admin/users + /admin/rewards/* + /admin/reports/rankings/team',
    });
  },
};
