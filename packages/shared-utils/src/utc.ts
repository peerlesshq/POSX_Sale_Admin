/**
 * UTC date helpers.
 *
 * Business rule: all settlement / reporting dates use UTC day boundaries
 * (01 §2, 11 §4). This module is the ONLY supported way to derive UTC
 * day boundaries in the codebase. Callers must not construct ad-hoc
 * `new Date(...)` math for business-day logic.
 */
import type { IsoTimestamp, UtcDate } from '@posx/shared-types';

const UTC_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export class InvalidUtcDateError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid UTC date: ${JSON.stringify(value)}`);
    this.name = 'InvalidUtcDateError';
  }
}

export class InvalidIsoTimestampError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid ISO timestamp: ${JSON.stringify(value)}`);
    this.name = 'InvalidIsoTimestampError';
  }
}

export function isUtcDate(value: unknown): value is UtcDate {
  if (typeof value !== 'string' || !UTC_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isIsoTimestamp(value: unknown): value is IsoTimestamp {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_REGEX.test(value)) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

/**
 * Convert a Date (or ms) into the UTC calendar date that contains it.
 */
export function toUtcDate(input: Date | number): UtcDate {
  const date = typeof input === 'number' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new InvalidIsoTimestampError(input);
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as UtcDate;
}

/**
 * Convert an ISO timestamp string into the UTC calendar date that
 * contains it.
 */
export function isoToUtcDate(iso: IsoTimestamp): UtcDate {
  if (!isIsoTimestamp(iso)) {
    throw new InvalidIsoTimestampError(iso);
  }
  return toUtcDate(new Date(iso));
}

/**
 * Start of the UTC day (00:00:00.000Z).
 */
export function utcDayStart(dateStr: UtcDate): IsoTimestamp {
  if (!isUtcDate(dateStr)) throw new InvalidUtcDateError(dateStr);
  return `${dateStr}T00:00:00.000Z` as IsoTimestamp;
}

/**
 * End of the UTC day (23:59:59.999Z). Used for inclusive range queries
 * that cover an entire calendar day.
 */
export function utcDayEnd(dateStr: UtcDate): IsoTimestamp {
  if (!isUtcDate(dateStr)) throw new InvalidUtcDateError(dateStr);
  return `${dateStr}T23:59:59.999Z` as IsoTimestamp;
}

/**
 * Next UTC day in YYYY-MM-DD form. Used for config `effective_from`
 * default logic (09 §5.2).
 */
export function nextUtcDate(dateStr: UtcDate): UtcDate {
  if (!isUtcDate(dateStr)) throw new InvalidUtcDateError(dateStr);
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return toUtcDate(next);
}

export function previousUtcDate(dateStr: UtcDate): UtcDate {
  if (!isUtcDate(dateStr)) throw new InvalidUtcDateError(dateStr);
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return toUtcDate(prev);
}

export function addUtcDays(dateStr: UtcDate, days: number): UtcDate {
  if (!isUtcDate(dateStr)) throw new InvalidUtcDateError(dateStr);
  if (!Number.isInteger(days)) {
    throw new Error(`addUtcDays requires integer days, got ${days}`);
  }
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return toUtcDate(shifted);
}

/**
 * Compare two UTC dates lexicographically. Since `UtcDate` is always
 * `YYYY-MM-DD`, lexical comparison is equivalent to chronological.
 */
export function compareUtcDate(a: UtcDate, b: UtcDate): -1 | 0 | 1 {
  if (!isUtcDate(a)) throw new InvalidUtcDateError(a);
  if (!isUtcDate(b)) throw new InvalidUtcDateError(b);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// -----------------------------
// ISO timestamp comparison
// -----------------------------
// These helpers exist because ISO 8601 timestamps are NOT safe to
// compare lexically. `IsoTimestampSchema` accepts both
//   "2026-04-13T00:00:00Z"
// and
//   "2026-04-13T00:00:00.000Z"
// and the ASCII ordering of `.` (0x2E) vs `Z` (0x5A) means
// `"2026...000Z" < "2026...Z"` even though they represent the same
// instant. Parsing to millisecond offset is the only robust path.

function parseIsoMs(value: IsoTimestamp): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new InvalidIsoTimestampError(value);
  }
  return ms;
}

export function compareIsoTimestamps(
  a: IsoTimestamp,
  b: IsoTimestamp,
): -1 | 0 | 1 {
  const am = parseIsoMs(a);
  const bm = parseIsoMs(b);
  if (am < bm) return -1;
  if (am > bm) return 1;
  return 0;
}

export function isoTimestampEquals(a: IsoTimestamp, b: IsoTimestamp): boolean {
  return compareIsoTimestamps(a, b) === 0;
}

export function isoTimestampLt(a: IsoTimestamp, b: IsoTimestamp): boolean {
  return compareIsoTimestamps(a, b) < 0;
}

export function isoTimestampLte(a: IsoTimestamp, b: IsoTimestamp): boolean {
  return compareIsoTimestamps(a, b) <= 0;
}

export function isoTimestampGt(a: IsoTimestamp, b: IsoTimestamp): boolean {
  return compareIsoTimestamps(a, b) > 0;
}

export function isoTimestampGte(a: IsoTimestamp, b: IsoTimestamp): boolean {
  return compareIsoTimestamps(a, b) >= 0;
}

/**
 * Convert a Date / string / number into a canonical ISO UTC
 * timestamp. Defensive — used at service-layer boundaries where
 * runtime may hand us a Date object even though the TypeScript type
 * says string. Throws on invalid input.
 */
export function asIsoTimestamp(
  value: Date | string | number,
): IsoTimestamp {
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso as IsoTimestamp;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new InvalidIsoTimestampError(value);
    return d.toISOString() as IsoTimestamp;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new InvalidIsoTimestampError(value);
  return d.toISOString() as IsoTimestamp;
}
