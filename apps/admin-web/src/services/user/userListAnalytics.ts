/**
 * User list analytics — derived KPIs and segment filters.
 *
 * All logic here is pure. The list page feeds the raw row array in
 * (straight from `api.listUsers`) and gets:
 *
 *   - a typed KPI strip object for the top-of-page metric row
 *   - a segment predicate for quick-view switching
 *   - a filter predicate that combines the GlobalFilters + user-only
 *     facets (tier, has_team, has_rewards, deposit range)
 *
 * No React. No API calls. Fully testable.
 */

import type { GlobalFilters } from '../../components/shared';
import { toNumber } from '../../lib/format';
import { inRange } from '../../lib/timeRange';

/* --------------------------------------------------------------------- */
/*  Types                                                                */
/* --------------------------------------------------------------------- */

export type UserSegment =
  | 'all'
  | 'active'
  | 'high_value'
  | 'restricted'
  | 'has_team'
  | 'new'
  | 'rewarded';

export interface UserListRow {
  readonly wallet_address: string;
  readonly status: string;
  readonly current_tier: string | null;
  readonly cumulative_deposit: string;
  readonly direct_referral_count: number;
  readonly team_size: number;
  readonly team_total_performance: string;
  readonly created_at: string;
  // Optional extras the list endpoint might expose in the future.
  readonly reward_total?: string;
  readonly claimable_total?: string;
  readonly holding_value_usdt?: string;
}

export interface UserListKpis {
  readonly total: number;
  readonly active: number;
  readonly restricted: number;
  readonly elite: number;
  /** cumulative_deposit > HIGH_VALUE_THRESHOLD */
  readonly highValue: number;
  /** created within last 24h */
  readonly newToday: number;
  /** team_size > 0 */
  readonly hasTeam: number;
  /** reward_total > 0 when the field exists, else best-effort via team_total_performance > 0 */
  readonly rewarded: number;
}

export interface UserListFilters {
  /** Shared analytics filters (time range + wallet + tier + status + amount range). */
  readonly global: GlobalFilters;
  /** Only include users whose team_size > 0. */
  readonly hasTeam: boolean;
  /** Only include users whose reward_total > 0. */
  readonly hasRewards: boolean;
}

/* --------------------------------------------------------------------- */
/*  Constants                                                            */
/* --------------------------------------------------------------------- */

/** Deposit threshold that defines a "high value" user in the KPI strip. */
export const HIGH_VALUE_THRESHOLD = 50_000;

const RESTRICTED_STATUSES = new Set([
  'restricted_purchase',
  'restricted_claim',
  'suspended',
  'blacklisted',
]);

/* --------------------------------------------------------------------- */
/*  KPI computation                                                      */
/* --------------------------------------------------------------------- */

export function computeUserListKpis(rows: readonly UserListRow[]): UserListKpis {
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  let active = 0;
  let restricted = 0;
  let elite = 0;
  let highValue = 0;
  let newToday = 0;
  let hasTeam = 0;
  let rewarded = 0;

  for (const row of rows) {
    if (row.status === 'active') active += 1;
    if (RESTRICTED_STATUSES.has(row.status)) restricted += 1;
    if (row.current_tier === 'elite') elite += 1;
    if (toNumber(row.cumulative_deposit) >= HIGH_VALUE_THRESHOLD) highValue += 1;
    if (row.created_at && nowMs - Date.parse(row.created_at) <= oneDayMs) newToday += 1;
    if (row.team_size > 0) hasTeam += 1;
    // `reward_total` isn't in the current mock list row — fall back
    // to `team_total_performance > 0` as a proxy for "has rewards"
    // activity when the field is absent.
    const rewardSignal =
      row.reward_total !== undefined
        ? toNumber(row.reward_total)
        : toNumber(row.team_total_performance);
    if (rewardSignal > 0) rewarded += 1;
  }

  return {
    total: rows.length,
    active,
    restricted,
    elite,
    highValue,
    newToday,
    hasTeam,
    rewarded,
  };
}

/* --------------------------------------------------------------------- */
/*  Segment predicate                                                    */
/* --------------------------------------------------------------------- */

export function applySegment(
  rows: readonly UserListRow[],
  segment: UserSegment,
): UserListRow[] {
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  switch (segment) {
    case 'all':
      return [...rows];
    case 'active':
      return rows.filter((r) => r.status === 'active');
    case 'high_value':
      return rows.filter((r) => toNumber(r.cumulative_deposit) >= HIGH_VALUE_THRESHOLD);
    case 'restricted':
      return rows.filter((r) => RESTRICTED_STATUSES.has(r.status));
    case 'has_team':
      return rows.filter((r) => r.team_size > 0);
    case 'new':
      return rows.filter(
        (r) => r.created_at && nowMs - Date.parse(r.created_at) <= oneDayMs * 7,
      );
    case 'rewarded':
      return rows.filter((r) => {
        const signal =
          r.reward_total !== undefined
            ? toNumber(r.reward_total)
            : toNumber(r.team_total_performance);
        return signal > 0;
      });
  }
}

/* --------------------------------------------------------------------- */
/*  Filter predicate                                                     */
/* --------------------------------------------------------------------- */

export function applyUserFilters(
  rows: readonly UserListRow[],
  filters: UserListFilters,
): UserListRow[] {
  const term = filters.global.wallet.trim().toLowerCase();
  const tier = filters.global.tier.trim().toLowerCase();
  const status = filters.global.status.trim().toLowerCase();
  const min = filters.global.amountMin.trim() === '' ? null : Number(filters.global.amountMin);
  const max = filters.global.amountMax.trim() === '' ? null : Number(filters.global.amountMax);

  return rows.filter((row) => {
    // Time range applies to created_at (registration time).
    if (row.created_at && !inRange(row.created_at, filters.global.range)) return false;
    if (term && !row.wallet_address.toLowerCase().includes(term)) return false;
    if (tier && (row.current_tier ?? '').toLowerCase() !== tier) return false;
    if (status && row.status.toLowerCase() !== status) return false;
    const deposit = toNumber(row.cumulative_deposit);
    if (min !== null && Number.isFinite(min) && deposit < min) return false;
    if (max !== null && Number.isFinite(max) && deposit > max) return false;
    if (filters.hasTeam && row.team_size <= 0) return false;
    if (filters.hasRewards) {
      const signal =
        row.reward_total !== undefined
          ? toNumber(row.reward_total)
          : toNumber(row.team_total_performance);
      if (signal <= 0) return false;
    }
    return true;
  });
}
