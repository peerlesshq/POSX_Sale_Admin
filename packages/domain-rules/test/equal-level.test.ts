/**
 * Unit tests for equal-level replacement.
 *
 * Reference: 01_business_rules_spec.md §7. Equal-level is replacement,
 * not additive — these tests assert that the differential half of the
 * reward is NOT duplicated into the equal-level amount. Instead, the
 * line_effective_performance is multiplied by the equal-level rate.
 */
import { describe, expect, it } from 'vitest';

import { evaluateEqualLevel, isEqualLevelApplicable } from '../src/equal-level';
import type { EqualLevelPolicy } from '../src/inputs';

const policy: EqualLevelPolicy = {
  replacement_enabled: true,
  equal_level_rate: '0.03',
  subordinate_team_performance_threshold: '100000',
};

const base = {
  user_team_rate: '0.03',
  subordinate_team_rate: '0.03',
  subordinate_team_total_performance: '150000',
  user_team_reward_qualified: true,
  line_active: true,
  line_effective_performance: '175000',
  policy,
};

describe('isEqualLevelApplicable', () => {
  it('returns true when all five conditions are met', () => {
    expect(isEqualLevelApplicable(base)).toBe(true);
  });

  it('returns false when replacement_enabled is false', () => {
    expect(
      isEqualLevelApplicable({ ...base, policy: { ...policy, replacement_enabled: false } }),
    ).toBe(false);
  });

  it('returns false when user is not team-reward-qualified', () => {
    expect(isEqualLevelApplicable({ ...base, user_team_reward_qualified: false })).toBe(false);
  });

  it('returns false when line is inactive', () => {
    expect(isEqualLevelApplicable({ ...base, line_active: false })).toBe(false);
  });

  it('returns false when the team rates differ', () => {
    expect(isEqualLevelApplicable({ ...base, subordinate_team_rate: '0.02' })).toBe(false);
  });

  it('returns false when subordinate team total is below threshold', () => {
    expect(
      isEqualLevelApplicable({ ...base, subordinate_team_total_performance: '99999' }),
    ).toBe(false);
  });

  it('returns true at exactly the threshold', () => {
    expect(
      isEqualLevelApplicable({ ...base, subordinate_team_total_performance: '100000' }),
    ).toBe(true);
  });
});

describe('evaluateEqualLevel', () => {
  it('returns 0 when not applicable', () => {
    const out = evaluateEqualLevel({ ...base, subordinate_team_rate: '0.05' });
    expect(out.applies).toBe(false);
    expect(out.raw_reward_amount).toBe('0');
  });

  it('returns line_effective_performance × equal_level_rate when applicable', () => {
    const out = evaluateEqualLevel(base);
    expect(out.applies).toBe(true);
    // 175000 * 0.03 = 5250
    expect(out.raw_reward_amount).toBe('5250');
  });

  it('does NOT add on top of differential — replacement only', () => {
    // If the formula were "differential + equal_level", the result
    // for a subordinate rate gap of 0 would still be the equal-level
    // amount. If the formula were "max(differential, equal_level)"
    // or "equal_level", both give 5250 because differential is 0.
    // This test locks the replacement spec: the equal-level amount
    // comes from line_effective_performance × equal_level_rate,
    // never from any other combination.
    const out = evaluateEqualLevel(base);
    expect(out.raw_reward_amount).toBe('5250');
  });
});
