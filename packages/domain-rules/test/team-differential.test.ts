/**
 * Unit tests for line differential computation.
 *
 * Reference: 01_business_rules_spec.md §6. Differential formula:
 *   differential_rate = max(U_rate - S_rate, 0) capped at max_team_rate
 *   raw_reward_amount = line_effective_performance × differential_rate
 */
import { describe, expect, it } from 'vitest';

import { computeLineDifferential } from '../src/team-differential';

describe('computeLineDifferential', () => {
  it('returns 0 when subordinate rate matches user rate', () => {
    const out = computeLineDifferential({
      user_team_rate: '0.03',
      max_team_rate: '0.15',
      line: {
        line_root_wallet_address: '0xabc',
        line_effective_performance: '100000',
        subordinate_team_rate: '0.03',
      },
    });
    expect(out.differential_rate).toBe('0');
    expect(out.raw_reward_amount).toBe('0');
  });

  it('computes differential × effective performance', () => {
    const out = computeLineDifferential({
      user_team_rate: '0.03',
      max_team_rate: '0.15',
      line: {
        line_root_wallet_address: '0xabc',
        line_effective_performance: '5000',
        subordinate_team_rate: '0.01',
      },
    });
    // 0.03 - 0.01 = 0.02, 5000 * 0.02 = 100
    expect(out.differential_rate).toBe('0.02');
    expect(out.raw_reward_amount).toBe('100');
  });

  it('returns 0 when line effective performance is zero', () => {
    const out = computeLineDifferential({
      user_team_rate: '0.03',
      max_team_rate: '0.15',
      line: {
        line_root_wallet_address: '0xabc',
        line_effective_performance: '0',
        subordinate_team_rate: '0',
      },
    });
    expect(out.raw_reward_amount).toBe('0');
  });

  it('returns 0 (not negative) when subordinate rate exceeds user rate', () => {
    // Shouldn't happen in practice, but a config bug must not
    // produce a debit.
    const out = computeLineDifferential({
      user_team_rate: '0.01',
      max_team_rate: '0.15',
      line: {
        line_root_wallet_address: '0xabc',
        line_effective_performance: '5000',
        subordinate_team_rate: '0.03',
      },
    });
    expect(out.differential_rate).toBe('0');
    expect(out.raw_reward_amount).toBe('0');
  });
});
