/**
 * Shared formatters for numbers, currencies, times, and wallets.
 *
 * Used by cells, KPI cards, charts, and everywhere else. Every call
 * goes through `Intl.NumberFormat` / `Intl.DateTimeFormat` which tie
 * back to the active admin locale.
 *
 * Consumers that need the tabular-nums look must also apply the
 * `.px-tabular` class to the containing element (see fonts.css).
 */
import Decimal from 'decimal.js';

import { getLocale } from './i18n';

const INTL_LOCALE: Record<string, string> = {
  'zh-CN': 'zh-CN',
  en: 'en-US',
};

function intl(): string {
  return INTL_LOCALE[getLocale()] ?? 'en-US';
}

/** Safely coerce unknown → number for display purposes. */
export function toNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Safely coerce to Decimal for precision-sensitive math. */
export function toDecimal(value: unknown): Decimal {
  try {
    if (value == null || value === '') return new Decimal(0);
    if (value instanceof Decimal) return value;
    return new Decimal(value as Decimal.Value);
  } catch {
    return new Decimal(0);
  }
}

/** Plain integer with thousands separators (`12,345`). */
export function formatInt(value: unknown): string {
  return new Intl.NumberFormat(intl(), { maximumFractionDigits: 0 }).format(toNumber(value));
}

/** Two-decimal fixed number. */
export function formatDecimal(value: unknown, digits = 2): string {
  return new Intl.NumberFormat(intl(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(toNumber(value));
}

/** Compact notation (`1.2M`, `567K`). */
export function formatCompact(value: unknown): string {
  return new Intl.NumberFormat(intl(), {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

/** Compact USDT display — `$1.2M`. */
export function formatCompactUsdt(value: unknown): string {
  return `$${formatCompact(value)}`;
}

/** Full USDT with two decimals and thousands separators — `$12,345.67`. */
export function formatUsdt(value: unknown): string {
  return `$${new Intl.NumberFormat(intl(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value))}`;
}

/** Percentage from a 0-1 input: 0.125 → `12.5%`. */
export function formatPercent(value: unknown, digits = 1): string {
  return new Intl.NumberFormat(intl(), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toNumber(value));
}

/** Truncate a wallet / tx hash: `0x1234…abcd`. */
export function truncateHash(value: string, head = 6, tail = 4): string {
  if (!value) return '';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/* ------------------------------------------------------------------
 * Time / date formatters
 * ------------------------------------------------------------------ */

export function formatDateTimeUtc(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intl(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateUtc(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(intl(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(d);
}

/** Relative time — `5 min ago`, `3 h ago`, locale-aware. */
export function formatRelativeTime(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const absSec = Math.max(0, Math.round(diff / 1000));
  const rtf = new Intl.RelativeTimeFormat(intl(), { numeric: 'auto' });

  if (absSec < 60) return rtf.format(-absSec, 'second');
  if (absSec < 3600) return rtf.format(-Math.round(absSec / 60), 'minute');
  if (absSec < 86400) return rtf.format(-Math.round(absSec / 3600), 'hour');
  if (absSec < 2592000) return rtf.format(-Math.round(absSec / 86400), 'day');
  if (absSec < 31536000) return rtf.format(-Math.round(absSec / 2592000), 'month');
  return rtf.format(-Math.round(absSec / 31536000), 'year');
}

/** Delta calculation — returns direction + formatted pct. */
export function deltaDirection(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (previous === 0) {
    if (current > 0) return 'up';
    if (current < 0) return 'down';
    return 'flat';
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (pct > 0.5) return 'up';
  if (pct < -0.5) return 'down';
  return 'flat';
}

export function formatDelta(current: number, previous: number): string {
  if (previous === 0) {
    if (current === 0) return '0%';
    return current > 0 ? '+∞%' : '-∞%';
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
