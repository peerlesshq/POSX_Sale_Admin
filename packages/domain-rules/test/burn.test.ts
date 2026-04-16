/**
 * Unit tests for `computeBurn`.
 *
 * Scope: pure function behaviour only. No DB, no services.
 * Reference: 01_business_rules_spec.md §8.
 */
import { describe, expect, it } from 'vitest';

import { BurnRewardType } from '@posx/shared-types';

import { BurnNotApplicableError, computeBurn, isBurnEnabled } from '../src/burn';
import type { BurnPolicy } from '../src/inputs';

const policy: BurnPolicy = {
  burn_disable_threshold: '10000',
  cap_basis: 'holding_value',
  applies_to: [BurnRewardType.Team, BurnRewardType.EqualLevel],
};

describe('isBurnEnabled', () => {
  it('returns false when holding_value exceeds threshold', () => {
    expect(isBurnEnabled('10001', policy)).toBe(false);
  });
  it('returns true when holding_value equals threshold', () => {
    expect(isBurnEnabled('10000', policy)).toBe(true);
  });
  it('returns true when holding_value is below threshold', () => {
    expect(isBurnEnabled('500', policy)).toBe(true);
  });
});

describe('computeBurn — disabled path', () => {
  it('returns raw = actual and burned = 0 when above threshold', () => {
    const result = computeBurn({
      reward_type: BurnRewardType.Team,
      raw_amount: '100',
      holding_value_usdt: '50000',
      used_burn_capacity_before: '0',
      policy,
    });
    expect(result.burn_enabled).toBe(false);
    expect(result.actual_amount).toBe('100');
    expect(result.burned_amount).toBe('0');
    expect(result.remaining_capacity).toBeNull();
    expect(result.remaining_after).toBeNull();
  });
});

describe('computeBurn — enabled path', () => {
  it('pays raw when remaining_capacity exceeds raw', () => {
    const result = computeBurn({
      reward_type: BurnRewardType.Team,
      raw_amount: '100',
      holding_value_usdt: '5000',
      used_burn_capacity_before: '0',
      policy,
    });
    expect(result.burn_enabled).toBe(true);
    expect(result.burn_cap).toBe('5000');
    expect(result.remaining_capacity).toBe('5000');
    expect(result.actual_amount).toBe('100');
    expect(result.burned_amount).toBe('0');
    expect(result.remaining_after).toBe('4900');
  });

  it('caps actual at remaining capacity and burns the rest', () => {
    const result = computeBurn({
      reward_type: BurnRewardType.Team,
      raw_amount: '1000',
      holding_value_usdt: '5000',
      used_burn_capacity_before: '4500',
      policy,
    });
    expect(result.burn_enabled).toBe(true);
    expect(result.remaining_capacity).toBe('500');
    expect(result.actual_amount).toBe('500');
    expect(result.burned_amount).toBe('500');
    expect(result.remaining_after).toBe('0');
  });

  it('returns actual = 0 when remaining_capacity is zero', () => {
    const result = computeBurn({
      reward_type: BurnRewardType.Team,
      raw_amount: '1000',
      holding_value_usdt: '5000',
      used_burn_capacity_before: '5000',
      policy,
    });
    expect(result.burn_enabled).toBe(true);
    expect(result.remaining_capacity).toBe('0');
    expect(result.actual_amount).toBe('0');
    expect(result.burned_amount).toBe('1000');
    expect(result.remaining_after).toBe('0');
  });

  it('treats used_burn_capacity_before larger than cap as zero remaining', () => {
    // Defensive case — an accounting bug upstream could over-count
    // historical burn. The function must not produce a negative
    // remaining capacity.
    const result = computeBurn({
      reward_type: BurnRewardType.Team,
      raw_amount: '500',
      holding_value_usdt: '5000',
      used_burn_capacity_before: '9999',
      policy,
    });
    expect(result.remaining_capacity).toBe('0');
    expect(result.actual_amount).toBe('0');
    expect(result.burned_amount).toBe('500');
  });

  it('equal-level rewards are burnable too', () => {
    const result = computeBurn({
      reward_type: BurnRewardType.EqualLevel,
      raw_amount: '300',
      holding_value_usdt: '1000',
      used_burn_capacity_before: '800',
      policy,
    });
    expect(result.actual_amount).toBe('200');
    expect(result.burned_amount).toBe('100');
  });
});

describe('computeBurn — defensive', () => {
  it('throws when a non-burnable reward type is passed', () => {
    expect(() =>
      computeBurn({
        // Direct rewards MUST never be burned per 01 §8.1.
        reward_type: 'direct' as unknown as BurnRewardType,
        raw_amount: '100',
        holding_value_usdt: '0',
        used_burn_capacity_before: '0',
        policy,
      }),
    ).toThrow(BurnNotApplicableError);
  });
});
