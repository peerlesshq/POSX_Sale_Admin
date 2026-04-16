/**
 * Deterministic wallet aliases used by the minimal end-to-end
 * dataset. These addresses are NOT checksummed (lowercase only,
 * matching the DB persistence rule in 03 §5.1).
 *
 * Tree layout (01 §6, §7 illustrative scenario):
 *
 *   W_ROOT   elite    deposit 200000   holding 200000
 *     ├─ W_A          elite    deposit 150000   holding 150000
 *     │    ├─ W_B     elite    deposit 150000   holding 150000
 *     │    └─ W_C     advanced deposit  20000   holding  20000
 *     │         └─ W_D basic   deposit   5000   holding   5000
 *     └─ (no second root child in the minimal set)
 */
import type { WalletAddress } from '@posx/shared-types';

export const SEED_WALLETS = {
  W_ROOT: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001',
  W_A: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0002',
  W_B: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0003',
  W_C: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0004',
  W_D: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0005',
} as const satisfies Record<string, WalletAddress>;

export type SeedWalletAlias = keyof typeof SEED_WALLETS;

export const SEED_WALLET_ORDER: ReadonlyArray<SeedWalletAlias> = [
  'W_ROOT',
  'W_A',
  'W_B',
  'W_C',
  'W_D',
];
