/**
 * Amount math.
 *
 * Decimal-safe arithmetic for financial values represented as strings.
 * No business module may use native `number` arithmetic on amounts.
 *
 * Conventions:
 *   - Amounts are decimal strings matching /^-?\d+(\.\d+)?$/
 *   - All results are canonicalised via `Decimal#toFixed()` (fixed point)
 *   - Precision: 40 decimal places, rounding DOWN (conservative for
 *     outbound user balances; burn / adjustment flows are responsible
 *     for their own rounding explicitly when needed)
 */
import Decimal from 'decimal.js';

import type { AmountString } from '@posx/shared-types';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_DOWN,
  toExpNeg: -40,
  toExpPos: 40,
});

const AMOUNT_REGEX = /^-?\d+(\.\d+)?$/;

export const ZERO_AMOUNT: AmountString = '0';

/**
 * Type guard: checks that a value is a syntactically valid amount
 * string. Does NOT check range or domain meaning.
 */
export function isAmountString(value: unknown): value is AmountString {
  return typeof value === 'string' && AMOUNT_REGEX.test(value);
}

/**
 * Parse an amount string into a Decimal, throwing on invalid input.
 *
 * Exposed primarily for internal use in this module; business code
 * should prefer the `add/sub/mul/div/cmp/min/max` helpers so that all
 * amount arithmetic funnels through one canonical path.
 */
export function parseAmount(value: AmountString): Decimal {
  if (!isAmountString(value)) {
    throw new AmountFormatError(value);
  }
  return new Decimal(value);
}

export class AmountFormatError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid amount string: ${JSON.stringify(value)}`);
    this.name = 'AmountFormatError';
  }
}

function toFixed(d: Decimal): AmountString {
  return d.toFixed();
}

// -----------------------------
// Arithmetic
// -----------------------------

export function addAmount(a: AmountString, b: AmountString): AmountString {
  return toFixed(parseAmount(a).plus(parseAmount(b)));
}

export function subAmount(a: AmountString, b: AmountString): AmountString {
  return toFixed(parseAmount(a).minus(parseAmount(b)));
}

export function mulAmount(a: AmountString, b: AmountString): AmountString {
  return toFixed(parseAmount(a).times(parseAmount(b)));
}

export function divAmount(a: AmountString, b: AmountString): AmountString {
  const divisor = parseAmount(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero in amount arithmetic');
  }
  return toFixed(parseAmount(a).dividedBy(divisor));
}

export function sumAmounts(values: ReadonlyArray<AmountString>): AmountString {
  let acc = new Decimal(0);
  for (const v of values) {
    acc = acc.plus(parseAmount(v));
  }
  return toFixed(acc);
}

// -----------------------------
// Comparison
// -----------------------------

export function compareAmount(a: AmountString, b: AmountString): -1 | 0 | 1 {
  const result = parseAmount(a).comparedTo(parseAmount(b));
  if (result < 0) return -1;
  if (result > 0) return 1;
  return 0;
}

export function amountEquals(a: AmountString, b: AmountString): boolean {
  return compareAmount(a, b) === 0;
}

export function amountLt(a: AmountString, b: AmountString): boolean {
  return compareAmount(a, b) < 0;
}

export function amountLte(a: AmountString, b: AmountString): boolean {
  return compareAmount(a, b) <= 0;
}

export function amountGt(a: AmountString, b: AmountString): boolean {
  return compareAmount(a, b) > 0;
}

export function amountGte(a: AmountString, b: AmountString): boolean {
  return compareAmount(a, b) >= 0;
}

export function isZero(a: AmountString): boolean {
  return parseAmount(a).isZero();
}

export function isPositive(a: AmountString): boolean {
  return parseAmount(a).isPositive() && !parseAmount(a).isZero();
}

export function isNegative(a: AmountString): boolean {
  return parseAmount(a).isNegative();
}

export function isNonNegative(a: AmountString): boolean {
  return !parseAmount(a).isNegative();
}

// -----------------------------
// Min / max / clamp
// -----------------------------

export function maxAmount(a: AmountString, b: AmountString): AmountString {
  return amountGte(a, b) ? toFixed(parseAmount(a)) : toFixed(parseAmount(b));
}

export function minAmount(a: AmountString, b: AmountString): AmountString {
  return amountLte(a, b) ? toFixed(parseAmount(a)) : toFixed(parseAmount(b));
}

export function clampAmount(
  value: AmountString,
  low: AmountString,
  high: AmountString,
): AmountString {
  if (amountLt(value, low)) return toFixed(parseAmount(low));
  if (amountGt(value, high)) return toFixed(parseAmount(high));
  return toFixed(parseAmount(value));
}

// -----------------------------
// Formatting
// -----------------------------

/**
 * Canonical zero-padded form. Used when persisting to tables that store
 * `numeric(38, 18)` — callers that want a specific decimal-place count
 * can pass `decimals`.
 */
export function normalizeAmount(
  value: AmountString,
  decimals = 18,
): AmountString {
  return parseAmount(value).toFixed(decimals);
}

/**
 * Trim trailing zeros after the decimal point without losing precision.
 * Useful for display where `1.0000` should render as `1`.
 */
export function trimTrailingZeros(value: AmountString): AmountString {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' || trimmed === '-' ? '0' : trimmed;
}
