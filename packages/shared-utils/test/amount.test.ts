/**
 * Smoke tests for amount primitives.
 *
 * These are the building blocks every reward / burn / claim
 * calculation depends on. If these drift, every downstream computation
 * drifts too. Keep the tests fast and boring.
 */
import { describe, expect, it } from 'vitest';

import {
  addAmount,
  amountEquals,
  amountGt,
  amountGte,
  divAmount,
  maxAmount,
  minAmount,
  mulAmount,
  subAmount,
  ZERO_AMOUNT,
} from '../src/amount';

describe('amount primitives', () => {
  it('addAmount sums two decimal strings exactly', () => {
    expect(addAmount('100', '200')).toBe('300');
    expect(addAmount('0.1', '0.2')).toBe('0.3');
  });

  it('subAmount subtracts exactly', () => {
    expect(subAmount('300', '100')).toBe('200');
    expect(subAmount('1', '0.99')).toBe('0.01');
  });

  it('mulAmount multiplies exactly', () => {
    expect(mulAmount('175000', '0.03')).toBe('5250');
    expect(mulAmount('0', '9999')).toBe('0');
  });

  it('divAmount divides decimals (used by token-price conversion)', () => {
    // 200000 / 0.0618 — the fixture uses this to derive POSX amounts
    const result = divAmount('200000', '0.0618');
    expect(result.startsWith('3236245')).toBe(true);
  });

  it('minAmount and maxAmount work on decimal strings', () => {
    expect(minAmount('100', '200')).toBe('100');
    expect(maxAmount('100', '200')).toBe('200');
    expect(minAmount('0', '0')).toBe('0');
  });

  it('amountGt, amountGte, amountEquals', () => {
    expect(amountGt('5', '4')).toBe(true);
    expect(amountGt('5', '5')).toBe(false);
    expect(amountGte('5', '5')).toBe(true);
    expect(amountEquals('0.10', '0.1')).toBe(true);
  });

  it('ZERO_AMOUNT is the string "0"', () => {
    expect(ZERO_AMOUNT).toBe('0');
  });
});
