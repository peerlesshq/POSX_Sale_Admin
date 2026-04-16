/**
 * Time-range primitives shared by Reports, Rewards sub-pages, Network,
 * and any other analytics surface in the admin console.
 *
 * The core contract:
 *
 *   - `TimeRange` is always a half-open interval `[from, to)` expressed
 *     in UTC, carrying along the preset label the user selected.
 *   - `resolveRange(preset, customFrom, customTo)` builds a TimeRange
 *     aligned to UTC midnight. `today` covers `[UTC midnight, now)`.
 *   - `previousRange(range)` returns the preceding same-width window
 *     used for delta / delta-% comparisons on KPIs.
 *   - `inRange(date, range)` is the predicate every page uses to filter
 *     raw lists down to the selected window.
 *
 * All functions are pure and time-zone safe. They never touch
 * `Date.getTimezoneOffset()` or rely on the browser's local TZ.
 *
 * Reference "now" is `Date.now()` at call time. Tests can inject a
 * fixed clock through `resolveRange(..., now)`.
 */

export type TimeRangePreset =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'custom';

export interface TimeRange {
  readonly preset: TimeRangePreset;
  /** Inclusive lower bound in UTC. */
  readonly from: Date;
  /** Exclusive upper bound in UTC. */
  readonly to: Date;
  /** Short UTC label, e.g. "Apr 1 – Apr 14 UTC". */
  readonly label: string;
}

/* --------------------------------------------------------------------- */
/*  Date helpers                                                         */
/* --------------------------------------------------------------------- */

/** Returns a new Date at UTC midnight of the given date. */
export function startOfUtcDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Returns a new Date N full days before the given date (UTC). */
export function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Convert a value to a Date, returning `null` on failure. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

/** `YYYY-MM-DD` UTC day key for bucketing. */
export function dayKey(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** Human-readable UTC short label, e.g. `Apr 1 – Apr 14 UTC`. */
function formatRangeLabel(from: Date, to: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  // to is exclusive — show the last included day (to - 1s)
  const lastIncluded = new Date(to.getTime() - 1);
  return `${fmt.format(from)} – ${fmt.format(lastIncluded)} UTC`;
}

/* --------------------------------------------------------------------- */
/*  Range resolvers                                                      */
/* --------------------------------------------------------------------- */

/**
 * Build a `TimeRange` for the given preset.
 *
 * @param preset      One of the preset ids. `custom` requires both
 *                    `customFrom` and `customTo`.
 * @param customFrom  Inclusive lower bound for `custom`.
 * @param customTo    Exclusive upper bound for `custom`.
 * @param now         Reference "now"; defaults to `Date.now()`.
 */
export function resolveRange(
  preset: TimeRangePreset,
  customFrom?: Date | null,
  customTo?: Date | null,
  now: Date = new Date(),
): TimeRange {
  if (preset === 'custom') {
    if (customFrom && customTo) {
      return {
        preset: 'custom',
        from: startOfUtcDay(customFrom),
        to: startOfUtcDay(addUtcDays(customTo, 1)),
        label: formatRangeLabel(startOfUtcDay(customFrom), startOfUtcDay(addUtcDays(customTo, 1))),
      };
    }
    // Fall back to 30d if caller forgot to supply dates.
    preset = '30d';
  }

  const todayStart = startOfUtcDay(now);
  const tomorrow = addUtcDays(todayStart, 1);

  let from: Date;
  let to: Date;
  switch (preset) {
    case 'today':
      from = todayStart;
      to = tomorrow;
      break;
    case '7d':
      from = addUtcDays(todayStart, -6);
      to = tomorrow;
      break;
    case '30d':
      from = addUtcDays(todayStart, -29);
      to = tomorrow;
      break;
    case '90d':
      from = addUtcDays(todayStart, -89);
      to = tomorrow;
      break;
    default:
      from = addUtcDays(todayStart, -29);
      to = tomorrow;
  }
  return { preset, from, to, label: formatRangeLabel(from, to) };
}

/**
 * Returns the window immediately preceding the given one, with
 * identical width. Used for previous-period deltas on KPIs.
 *
 *   today  → yesterday (midnight..midnight)
 *   7d     → the 7 days ending on the day before the current window
 *   30d    → same, 30 days
 *   custom → same width shifted backwards
 */
export function previousRange(range: TimeRange): TimeRange {
  const widthMs = range.to.getTime() - range.from.getTime();
  const prevTo = new Date(range.from.getTime());
  const prevFrom = new Date(prevTo.getTime() - widthMs);
  return {
    preset: range.preset,
    from: prevFrom,
    to: prevTo,
    label: formatRangeLabel(prevFrom, prevTo),
  };
}

/** Predicate: does `value` fall within `range`? */
export function inRange(value: unknown, range: TimeRange): boolean {
  const d = toDate(value);
  if (!d) return false;
  const ts = d.getTime();
  return ts >= range.from.getTime() && ts < range.to.getTime();
}

/**
 * Inclusive sequence of `YYYY-MM-DD` day keys covering the range, in
 * ascending order. Used as the x-axis categories for trend charts.
 */
export function daysInRange(range: TimeRange): string[] {
  const out: string[] = [];
  let cursor = new Date(range.from);
  while (cursor.getTime() < range.to.getTime()) {
    out.push(dayKey(cursor));
    cursor = addUtcDays(cursor, 1);
  }
  return out;
}
