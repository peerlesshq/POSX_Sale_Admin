/**
 * Display formatting helpers. Amounts are strings; we format them
 * for visual use only — the exact value remains accessible.
 */
import Decimal from 'decimal.js';

export function formatAmount(value: string, decimals = 2): string {
  try {
    const d = new Decimal(value);
    return d.toFixed(decimals, Decimal.ROUND_DOWN);
  } catch {
    return value;
  }
}

export function formatRate(value: string): string {
  try {
    const d = new Decimal(value).times(100);
    return `${d.toFixed(2)}%`;
  } catch {
    return value;
  }
}

export function maskWallet(value: string): string {
  if (!value || value.length < 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
