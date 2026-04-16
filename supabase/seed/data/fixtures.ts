/**
 * Minimal end-to-end dataset fixtures.
 *
 * Timeline:
 *   - 2026-03-15 W_ROOT purchases 200 000 USDT
 *   - 2026-03-20 W_A    purchases 150 000 USDT → referral W_A→W_ROOT
 *   - 2026-03-25 W_B    purchases 150 000 USDT → referral W_B→W_A
 *   - 2026-03-27 W_C    purchases  20 000 USDT → referral W_C→W_A
 *   - 2026-03-30 W_D    purchases   5 000 USDT → referral W_D→W_C
 *
 * Direct rewards (rates from the default tier table, 01 §4.4):
 *   - W_A → paid on their own purchase, direct reward to W_ROOT at
 *     15% of 150 000 = 22 500 USDT
 *   - W_B → to W_A at 15% of 150 000 = 22 500 USDT
 *   - W_C → to W_A at 15% of 20 000 = 3 000 USDT
 *     (W_A is elite at that point — see team_rate math in seed/settlement)
 *   - W_D → to W_C at 10% of 5 000 = 500 USDT (W_C is advanced)
 *
 * Settlement day: 2026-04-12 (UTC).
 *   Team-performance aggregates on the settlement day:
 *     W_D  : 0
 *     W_C  : 5 000
 *     W_B  : 0
 *     W_A  : 150 000 + 20 000 + 5 000 = 175 000
 *     W_ROOT: 150 000 + 150 000 + 20 000 + 5 000 = 325 000
 *
 *   Team rates (elite / elite / elite / advanced):
 *     W_ROOT (elite, 325 000)  → 0.03 (100 001–500 000 elite bracket)
 *     W_A    (elite, 175 000)  → 0.03 (same bracket)
 *     W_B    (elite, 0)        → 0.00 (no bracket match)
 *     W_C    (advanced, 5 000) → 0.01 (advanced 1–100 000 bracket)
 *
 *   Settlement for W_ROOT:
 *     Line: W_A
 *       line_effective_performance (depth 2–7 from ROOT):
 *         W_B at depth 2: 150 000
 *         W_C at depth 2:  20 000
 *         W_D at depth 3:   5 000
 *         total         = 175 000
 *       U_rate = 0.03, S_rate = 0.03 → differential = 0
 *       equal-level check: subordinate (W_A) team_performance
 *         (175 000) ≥ 100 000 threshold → applies
 *       equal-level raw = 175 000 × 0.03 = 5 250
 *     W_ROOT holding 200 000 > 10 000 → no burn
 *     → W_ROOT receives 5 250 USDT equal-level reward
 *
 *   Settlement for W_A:
 *     Line 1: W_B → no descendants → raw 0
 *     Line 2: W_C → W_D at depth 2 → effective perf 5 000
 *       U_rate 0.03 – S_rate 0.01 = 0.02
 *       raw = 5 000 × 0.02 = 100
 *     Total team reward raw = 100
 *     W_A holding 150 000 > 10 000 → no burn
 *     → W_A receives 100 USDT team reward
 *
 *   W_B, W_C, W_D → no team reward (0 effective performance)
 *
 *   Claim: W_A claims their 100 USDT team reward → confirmed.
 */
import type {
  AmountString,
  RateString,
  TierCode,
  TxHash,
  WalletAddress,
} from '@posx/shared-types';

import { SEED_WALLETS } from './wallets';

export const SETTLEMENT_DATE = '2026-04-12';
export const SETTLEMENT_STARTED_AT = '2026-04-13T00:10:00.000Z';
export const SETTLEMENT_FINISHED_AT = '2026-04-13T00:12:30.000Z';

export const CHAIN_ID = 1;
export const CONTRACT_ADDRESS_MAIN: WalletAddress =
  '0x0000000000000000000000000000000000000001';

export const TOKEN_PRICE: AmountString = '0.0618';

export interface SeedUserFixture {
  wallet: WalletAddress;
  tier: TierCode;
  cumulative_deposit: AmountString;
  holding_value_usdt: AmountString;
  purchase_at: string;
  block_number: number;
  purchase_tx_hash: TxHash;
  team_rate_on_settlement: RateString;
  /** Parent in the referral tree, or null for the root wallet. */
  parent_wallet: WalletAddress | null;
}

/**
 * One row per seed user. Deposit == holding is intentional for the
 * minimal dataset (no withdrawals). The HoldingService-derived value
 * in Phase 4+ will match this because `sum(total_locked - withdrawn)`
 * reduces to `total_locked` when nothing has been withdrawn.
 */
export const SEED_USERS: ReadonlyArray<SeedUserFixture> = [
  {
    wallet: SEED_WALLETS.W_ROOT,
    tier: 'elite',
    cumulative_deposit: '200000',
    holding_value_usdt: '200000',
    purchase_at: '2026-03-15T10:00:00.000Z',
    block_number: 20_000_001,
    purchase_tx_hash:
      '0xbbbb000000000000000000000000000000000000000000000000000000000001',
    team_rate_on_settlement: '0.03',
    parent_wallet: null,
  },
  {
    wallet: SEED_WALLETS.W_A,
    tier: 'elite',
    cumulative_deposit: '150000',
    holding_value_usdt: '150000',
    purchase_at: '2026-03-20T10:00:00.000Z',
    block_number: 20_000_010,
    purchase_tx_hash:
      '0xbbbb000000000000000000000000000000000000000000000000000000000002',
    team_rate_on_settlement: '0.03',
    parent_wallet: SEED_WALLETS.W_ROOT,
  },
  {
    wallet: SEED_WALLETS.W_B,
    tier: 'elite',
    cumulative_deposit: '150000',
    holding_value_usdt: '150000',
    purchase_at: '2026-03-25T10:00:00.000Z',
    block_number: 20_000_020,
    purchase_tx_hash:
      '0xbbbb000000000000000000000000000000000000000000000000000000000003',
    team_rate_on_settlement: '0', // no team performance → no bracket
    parent_wallet: SEED_WALLETS.W_A,
  },
  {
    wallet: SEED_WALLETS.W_C,
    tier: 'advanced',
    cumulative_deposit: '20000',
    holding_value_usdt: '20000',
    purchase_at: '2026-03-27T10:00:00.000Z',
    block_number: 20_000_030,
    purchase_tx_hash:
      '0xbbbb000000000000000000000000000000000000000000000000000000000004',
    team_rate_on_settlement: '0.01',
    parent_wallet: SEED_WALLETS.W_A,
  },
  {
    wallet: SEED_WALLETS.W_D,
    tier: 'basic',
    cumulative_deposit: '5000',
    holding_value_usdt: '5000',
    purchase_at: '2026-03-30T10:00:00.000Z',
    block_number: 20_000_040,
    purchase_tx_hash:
      '0xbbbb000000000000000000000000000000000000000000000000000000000005',
    team_rate_on_settlement: '0',
    parent_wallet: SEED_WALLETS.W_C,
  },
];
