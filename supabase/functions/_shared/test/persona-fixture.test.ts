/**
 * Smoke tests for persona fixture helpers.
 *
 * The persona fixture is only seeded in local/staging. The
 * `isProductionLike` guard is the second line of defence (the first
 * being the PHASE6_PERSONAS env flag). This test locks its behaviour
 * so we don't accidentally loosen it in a refactor.
 */
import { describe, expect, it } from 'vitest';

import { PERSONA_FIXTURES, PERSONA_WALLETS } from '../../../../supabase/seed/data/personas';
import { isProductionLike } from '../../../../supabase/seed/persona-fixture';

describe('isProductionLike', () => {
  it('returns false for undefined', () => {
    expect(isProductionLike(undefined)).toBe(false);
  });

  it('returns false for a local docker URL', () => {
    expect(isProductionLike('postgres://postgres:pw@localhost:54322/postgres')).toBe(false);
    expect(isProductionLike('postgresql://postgres:pw@127.0.0.1:5432/postgres')).toBe(false);
  });

  it('returns true when URL contains the word production', () => {
    expect(isProductionLike('postgres://user:pw@production-db.example.com:5432/posx')).toBe(true);
    expect(isProductionLike('postgres://user:pw@prod-db.internal/posx')).toBe(true);
  });

  it('returns true for supabase.co hosts', () => {
    expect(
      isProductionLike('postgres://postgres:pw@db.zxyzxyz.supabase.co:5432/postgres'),
    ).toBe(true);
  });
});

describe('PERSONA_FIXTURES', () => {
  it('contains exactly the 8 Phase 6 personas', () => {
    expect(PERSONA_FIXTURES).toHaveLength(8);
    const keys = PERSONA_FIXTURES.map((p) => p.key);
    expect(keys).toEqual([
      'ELITE_LEADER',
      'ADVANCED_USER',
      'BASIC_USER',
      'NEW_USER',
      'BURN_USER',
      'RESTRICTED_PURCHASE_USER',
      'RESTRICTED_CLAIM_USER',
      'SUSPENDED_USER',
    ]);
  });

  it('wallet addresses are unique and lowercase', () => {
    const wallets = PERSONA_FIXTURES.map((p) => p.wallet);
    expect(new Set(wallets).size).toBe(wallets.length);
    for (const w of wallets) {
      expect(w).toBe(w.toLowerCase());
      expect(w.startsWith('0x')).toBe(true);
      expect(w).toHaveLength(42);
    }
  });

  it('PERSONA_WALLETS matches the fixture wallets', () => {
    expect(PERSONA_WALLETS.ELITE_LEADER).toBe(PERSONA_FIXTURES[0]!.wallet);
    expect(PERSONA_WALLETS.SUSPENDED_USER).toBe(PERSONA_FIXTURES[7]!.wallet);
  });

  it('NEW_USER has no purchase history', () => {
    const newUser = PERSONA_FIXTURES.find((p) => p.key === 'NEW_USER');
    expect(newUser?.cumulativeDeposit).toBe('0');
    expect(newUser?.firstPurchaseAt).toBeNull();
  });

  it('BURN_USER holds less than it deposited — burn path trigger', () => {
    const burnUser = PERSONA_FIXTURES.find((p) => p.key === 'BURN_USER');
    expect(burnUser).toBeDefined();
    expect(Number(burnUser!.holdingValueUsdt)).toBeLessThan(
      Number(burnUser!.cumulativeDeposit),
    );
  });

  it('restricted statuses are represented', () => {
    const statuses = PERSONA_FIXTURES.map((p) => p.status);
    expect(statuses).toContain('restricted_purchase');
    expect(statuses).toContain('restricted_claim');
    expect(statuses).toContain('suspended');
  });
});
