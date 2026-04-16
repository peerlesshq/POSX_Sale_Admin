/**
 * Pure analytics helpers — zero I/O, zero React.
 *
 * These helpers live between the raw list payloads the mock / real API
 * returns and the chart / KPI components that need aggregated data.
 * Every page uses these so trend charts, distribution bars, and KPI
 * deltas are computed identically.
 *
 * All helpers are generic over the row shape: the caller supplies
 * accessor functions to pull the date, the numeric value, and (where
 * applicable) the group key out of each row. This keeps the helpers
 * agnostic to rewards / burns / team / direct contract differences.
 */

import {
  dayKey,
  daysInRange,
  inRange,
  type TimeRange,
} from './timeRange';

export interface TrendPoint {
  readonly day: string; // YYYY-MM-DD
  readonly value: number;
}

export interface GroupSum {
  readonly group: string;
  readonly value: number;
}

export interface DistributionBucket {
  readonly label: string;
  readonly count: number;
  readonly total: number;
  readonly lower: number;
  readonly upper: number;
}

/* --------------------------------------------------------------------- */
/*  Filter + trend                                                       */
/* --------------------------------------------------------------------- */

/** Keep only rows whose `date` accessor lands within the range. */
export function filterByRange<T>(
  rows: readonly T[],
  getDate: (row: T) => unknown,
  range: TimeRange,
): T[] {
  return rows.filter((row) => inRange(getDate(row), range));
}

/**
 * Bucket rows into one sum per day across the range. Days with no
 * matching rows are emitted as `{ day, value: 0 }` so the resulting
 * array is dense and safe to feed into a chart x-axis.
 */
export function bucketByDay<T>(
  rows: readonly T[],
  getDate: (row: T) => unknown,
  getValue: (row: T) => number,
  range: TimeRange,
): TrendPoint[] {
  const base: Map<string, number> = new Map(
    daysInRange(range).map((d) => [d, 0]),
  );
  for (const row of rows) {
    const dk = dayKey(getDate(row) as string);
    if (!dk) continue;
    if (!base.has(dk)) continue; // outside the range
    base.set(dk, (base.get(dk) ?? 0) + (getValue(row) || 0));
  }
  return Array.from(base, ([day, value]) => ({ day, value }));
}

/**
 * Like `bucketByDay`, but splits rows by a grouping key (e.g. reward
 * type). Returns a map of `group → TrendPoint[]` with one dense array
 * per group.
 */
export function bucketByDayGrouped<T>(
  rows: readonly T[],
  getDate: (row: T) => unknown,
  getValue: (row: T) => number,
  getGroup: (row: T) => string,
  range: TimeRange,
): Map<string, TrendPoint[]> {
  const groups = new Set<string>();
  for (const row of rows) groups.add(getGroup(row));
  const out = new Map<string, TrendPoint[]>();
  for (const g of groups) {
    out.set(
      g,
      bucketByDay(
        rows.filter((r) => getGroup(r) === g),
        getDate,
        getValue,
        range,
      ),
    );
  }
  return out;
}

/* --------------------------------------------------------------------- */
/*  Sums + KPIs                                                          */
/* --------------------------------------------------------------------- */

/** Total across a row set. */
export function sumBy<T>(rows: readonly T[], getValue: (row: T) => number): number {
  let total = 0;
  for (const row of rows) total += getValue(row) || 0;
  return total;
}

/** Unique count by key accessor (e.g. distinct wallets). */
export function countBy<T>(rows: readonly T[], getKey: (row: T) => string): number {
  const seen = new Set<string>();
  for (const row of rows) seen.add(getKey(row));
  return seen.size;
}

/** Aggregate totals by group (e.g. reward type) in one pass. */
export function sumByGroup<T>(
  rows: readonly T[],
  getGroup: (row: T) => string,
  getValue: (row: T) => number,
): GroupSum[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const g = getGroup(row);
    totals.set(g, (totals.get(g) ?? 0) + (getValue(row) || 0));
  }
  return Array.from(totals, ([group, value]) => ({ group, value })).sort(
    (a, b) => b.value - a.value,
  );
}

/** Top-N rows by value, highest first. Does not mutate the input. */
export function topNBy<T>(
  rows: readonly T[],
  getValue: (row: T) => number,
  n: number,
): T[] {
  return [...rows].sort((a, b) => getValue(b) - getValue(a)).slice(0, n);
}

/** Average value across a row set (rows × value); 0 when empty. */
export function averageBy<T>(
  rows: readonly T[],
  getValue: (row: T) => number,
): number {
  if (rows.length === 0) return 0;
  return sumBy(rows, getValue) / rows.length;
}

/* --------------------------------------------------------------------- */
/*  Deltas                                                               */
/* --------------------------------------------------------------------- */

export interface DeltaResult {
  readonly current: number;
  readonly previous: number;
  /** Signed delta: current − previous. */
  readonly delta: number;
  /** Relative delta in decimal (0.12 = +12%); `null` if previous is 0. */
  readonly pct: number | null;
  readonly direction: 'up' | 'down' | 'flat';
}

/** Compute the difference between current and previous scalar KPIs. */
export function computeDelta(current: number, previous: number): DeltaResult {
  const delta = current - previous;
  const pct =
    previous === 0 ? (current === 0 ? 0 : null) : (current - previous) / Math.abs(previous);
  let direction: DeltaResult['direction'] = 'flat';
  if (pct === null) {
    direction = current > 0 ? 'up' : current < 0 ? 'down' : 'flat';
  } else if (pct > 0.005) {
    direction = 'up';
  } else if (pct < -0.005) {
    direction = 'down';
  }
  return { current, previous, delta, pct, direction };
}

/* --------------------------------------------------------------------- */
/*  Distribution bucketing                                               */
/* --------------------------------------------------------------------- */

/**
 * Build `bucketCount` equal-width buckets across the value range of
 * `rows`, counting rows and summing their values per bucket. Useful
 * for "long tail vs whales" distribution charts.
 */
export function bucketDistribution<T>(
  rows: readonly T[],
  getValue: (row: T) => number,
  bucketCount = 8,
): DistributionBucket[] {
  if (rows.length === 0 || bucketCount <= 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const v = getValue(row) || 0;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    return [
      {
        label: formatBucketLabel(min, max),
        count: rows.length,
        total: sumBy(rows, getValue),
        lower: min,
        upper: max,
      },
    ];
  }
  const width = (max - min) / bucketCount;
  const buckets: DistributionBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: formatBucketLabel(min + width * i, min + width * (i + 1)),
    count: 0,
    total: 0,
    lower: min + width * i,
    upper: min + width * (i + 1),
  }));
  for (const row of rows) {
    const v = getValue(row) || 0;
    let idx = Math.floor((v - min) / width);
    if (idx === bucketCount) idx = bucketCount - 1; // include the max
    const bucket = buckets[idx]!;
    (bucket as { count: number }).count += 1;
    (bucket as { total: number }).total += v;
  }
  return buckets;
}

function formatBucketLabel(lower: number, upper: number): string {
  const l = Math.round(lower);
  const u = Math.round(upper);
  return `${l}–${u}`;
}

/**
 * Categorical distribution across explicit buckets (e.g. tiers).
 * Rows that don't match any bucket are dropped.
 */
export function bucketCategorical<T>(
  rows: readonly T[],
  getGroup: (row: T) => string,
  buckets: readonly string[],
): GroupSum[] {
  const totals = new Map<string, number>(buckets.map((b) => [b, 0]));
  for (const row of rows) {
    const g = getGroup(row);
    if (totals.has(g)) totals.set(g, (totals.get(g) ?? 0) + 1);
  }
  return Array.from(totals, ([group, value]) => ({ group, value }));
}
