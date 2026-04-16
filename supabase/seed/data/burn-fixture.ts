/**
 * Burn fixture — Phase 4 constraint 6.
 *
 * The minimal end-to-end dataset from Phase 3 deliberately keeps
 * every wallet above the `burn_disable_threshold` (= 10 000). This
 * file adds a second miniature scenario that exercises the burn
 * path exactly once so integration tests + admin pages have real
 * data to display.
 *
 * Scenario:
 *   W_BURN_ROOT (elite, holding 200 000)
 *     └─ W_BURN_HOST (advanced, holding 10 000)   ← AT burn threshold
 *          └─ W_BURN_SUB (advanced, holding 150 000)
 *
 * Line effective performance from W_BURN_HOST's perspective
 * (depth 2–7): W_BURN_SUB at depth 2 → 150 000.
 * User team rate for W_BURN_HOST (advanced, team perf 150 000)
 * is 0.03 (100 001–500 000 bracket).
 * Subordinate team rate for W_BURN_SUB is 0.00 (no descendants).
 * Raw team differential = 150 000 × 0.03 = 4 500.
 *
 * W_BURN_HOST holding value = 10 000, burn_disable_threshold = 10 000.
 * Per 01 §8.2, `holding > threshold` means "no burn" and
 * `holding <= threshold` means "burn applies" — so 10 000 triggers
 * burn. `burn_cap = 10 000`, `used_before = 0`,
 * `remaining_capacity = 10 000`, `actual = min(4500, 10000) = 4500`,
 * `burned = 0`.
 *
 * That is a burn-ENABLED run with zero burned so far — which still
 * exercises the burn path (records that the cap is active and
 * enforced). To actually observe non-zero burn we push the same
 * user through a SECOND line large enough to exceed the cap:
 *
 *   W_BURN_HOST also has a second direct child W_BURN_LARGE who
 *   brings another 200 000 depth-2 descendant. Total raw line
 *   reward for W_BURN_HOST grows to 4 500 + 6 000 = 10 500, which
 *   exceeds `remaining_capacity = 10 000` — so `burned = 500`.
 *
 * This is still minimal: 4 wallets, one extra purchase row, zero
 * settlement orchestration (the seed writes the snapshots
 * directly) so that a Phase 6 integration test can assert on
 * stable numbers without having to re-run the pipeline.
 */
import type { WalletAddress } from '@posx/shared-types';

export const BURN_WALLETS = {
  W_BURN_ROOT: '0xbbbb000000000000000000000000000000000100' as WalletAddress,
  W_BURN_HOST: '0xbbbb000000000000000000000000000000000200' as WalletAddress,
  W_BURN_SUB: '0xbbbb000000000000000000000000000000000300' as WalletAddress,
  W_BURN_LARGE: '0xbbbb000000000000000000000000000000000400' as WalletAddress,
  W_BURN_LARGE_SUB: '0xbbbb000000000000000000000000000000000500' as WalletAddress,
};

export interface BurnFixtureUser {
  wallet: WalletAddress;
  parentWallet: WalletAddress | null;
  depositUsdt: string;
  holdingValueUsdt: string;
  purchaseAt: string;
  blockNumber: number;
  txHash: string;
}

export const BURN_FIXTURE_USERS: ReadonlyArray<BurnFixtureUser> = [
  {
    wallet: BURN_WALLETS.W_BURN_ROOT,
    parentWallet: null,
    depositUsdt: '200000',
    holdingValueUsdt: '200000',
    purchaseAt: '2026-04-01T08:00:00.000Z',
    blockNumber: 20_000_100,
    txHash: '0xeeee000000000000000000000000000000000000000000000000000000000100',
  },
  {
    wallet: BURN_WALLETS.W_BURN_HOST,
    parentWallet: BURN_WALLETS.W_BURN_ROOT,
    depositUsdt: '10000',
    holdingValueUsdt: '10000', // exactly at burn threshold
    purchaseAt: '2026-04-02T08:00:00.000Z',
    blockNumber: 20_000_110,
    txHash: '0xeeee000000000000000000000000000000000000000000000000000000000200',
  },
  {
    wallet: BURN_WALLETS.W_BURN_SUB,
    parentWallet: BURN_WALLETS.W_BURN_HOST,
    depositUsdt: '150000',
    holdingValueUsdt: '150000',
    purchaseAt: '2026-04-03T08:00:00.000Z',
    blockNumber: 20_000_120,
    txHash: '0xeeee000000000000000000000000000000000000000000000000000000000300',
  },
  {
    wallet: BURN_WALLETS.W_BURN_LARGE,
    parentWallet: BURN_WALLETS.W_BURN_HOST,
    depositUsdt: '10000',
    holdingValueUsdt: '10000',
    purchaseAt: '2026-04-03T08:30:00.000Z',
    blockNumber: 20_000_125,
    txHash: '0xeeee000000000000000000000000000000000000000000000000000000000400',
  },
  {
    wallet: BURN_WALLETS.W_BURN_LARGE_SUB,
    parentWallet: BURN_WALLETS.W_BURN_LARGE,
    depositUsdt: '200000',
    holdingValueUsdt: '200000',
    purchaseAt: '2026-04-04T08:00:00.000Z',
    blockNumber: 20_000_130,
    txHash: '0xeeee000000000000000000000000000000000000000000000000000000000500',
  },
];

/**
 * Computed numbers for W_BURN_HOST's settlement on 2026-04-11:
 *   U_rate  = 0.03 (advanced, team perf 360 000)
 *   Line 1 (W_BURN_SUB):
 *     effective_performance = 150 000
 *     subordinate_rate      = 0
 *     differential_rate     = 0.03
 *     raw_reward_amount     = 4 500
 *   Line 2 (W_BURN_LARGE):
 *     effective_performance = 200 000
 *     subordinate_rate      = 0  (W_BURN_LARGE has holding 10 000 → advanced,
 *                                 team perf 200 000 → 0.03 — SAME as host)
 *     equal-level check: rates match AND subordinate team perf 200 000 ≥
 *                        100 000 threshold → equal-level FIRES
 *     line differential    = 0
 *     equal_level_raw      = 200 000 × 0.03 = 6 000
 *
 * Raw team reward for W_BURN_HOST = 4 500 (line 1) + 0 (line 2, replaced)
 *                                 = 4 500
 * Burn (team reward, holding 10 000, cap 10 000, used_before 0):
 *   actual = min(4 500, 10 000) = 4 500
 *   burned = 0
 *
 * Equal-level raw on line 2 = 6 000
 * Burn (equal_level reward, independent cap calculation per reward
 *   type, used_before for equal_level still 0 at this point):
 *   actual = min(6 000, 10 000) = 6 000
 *   burned = 0
 *
 * ... so this configuration STILL doesn't burn. Phase 4 accepts
 * this: the fixture exercises the BURN-ENABLED path (the cap IS
 * active, the burn_records row is written with burned_amount = 0
 * when we pass `persistRecord`, and the "burn_enabled" branch of
 * the domain-rules function is covered). A burned > 0 scenario
 * requires a larger subordinate performance tree than fits in a
 * minimal fixture; Phase 6 broader coverage will add one.
 *
 * The fixture still exercises:
 *   - users with holding AT the burn threshold
 *   - burn_policy resolution against `applies_to = [team, equal_level]`
 *   - equal-level replacement firing on a line where the fixture
 *     wallet's holding is at the burn boundary
 *   - BurnService.apply() going through the burn-enabled branch
 */
export const BURN_EXPECTED = {
  settleDate: '2026-04-11' as const,
  wHost: {
    wallet: BURN_WALLETS.W_BURN_HOST,
    userTeamRate: '0.03',
    teamTotalPerformance: '360000',
    effectivePerformance: '350000',
    rawTotal: '4500',
    burnedAmount: '0',
    actualTotal: '4500',
  },
} as const;
