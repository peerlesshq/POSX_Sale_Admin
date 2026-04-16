/**
 * Phase 6 user persona fixture catalog.
 *
 * Eight personas that represent canonical user-access states: tier
 * levels, burn boundaries, and the three restricted statuses. The
 * wallet addresses MUST match the `DEV_PERSONAS` array in
 * `apps/user-web/src/lib/dev-personas.ts` so a developer running the
 * real API sees the same behaviour as the mock client.
 *
 * Design:
 *   - Personas are planted as standalone users (no referral bindings
 *     between them) so their states never interfere with the minimal
 *     happy-path dataset or the burn/reversal fixtures.
 *   - No extended reward/claim history — just enough for the user-web
 *     pages to render a meaningful dashboard.
 *
 * Rule: these fixtures must only be seeded in local/staging. The
 * seed runner gates this via a PHASE6_PERSONAS=true env flag in the
 * seed entrypoint (see `scripts/seed.ts`).
 */
import type {
  AmountString,
  TierCode,
  TxHash,
  UserStatus,
  WalletAddress,
} from '@posx/shared-types';

export const PERSONA_WALLETS = {
  ELITE_LEADER: '0xdeadbeef00000000000000000000000000000001',
  ADVANCED_USER: '0xdeadbeef00000000000000000000000000000002',
  BASIC_USER: '0xdeadbeef00000000000000000000000000000003',
  NEW_USER: '0xdeadbeef00000000000000000000000000000004',
  BURN_USER: '0xdeadbeef00000000000000000000000000000005',
  RESTRICTED_PURCHASE_USER: '0xdeadbeef00000000000000000000000000000006',
  RESTRICTED_CLAIM_USER: '0xdeadbeef00000000000000000000000000000007',
  SUSPENDED_USER: '0xdeadbeef00000000000000000000000000000008',
} as const satisfies Record<string, WalletAddress>;

export type PersonaKey = keyof typeof PERSONA_WALLETS;

export interface PersonaFixture {
  readonly key: PersonaKey;
  readonly wallet: WalletAddress;
  readonly label: string;
  readonly description: string;
  readonly status: UserStatus;
  readonly tier: TierCode | null;
  /** Cumulative USDT deposited across all confirmed purchases. */
  readonly cumulativeDeposit: AmountString;
  /**
   * Holding value for burn math. Usually equals cumulativeDeposit but
   * the BURN_USER persona holds less than it deposited to trigger the
   * burn path.
   */
  readonly holdingValueUsdt: AmountString;
  readonly createdAt: string;
  readonly firstPurchaseAt: string | null;
  readonly blockNumberBase: number;
  readonly txHashPrefix: TxHash;
}

/** 2026-04-01T00:00:00Z — fixed seed time so runs are deterministic. */
const BASE_CREATED = '2026-04-01T00:00:00.000Z';
const BASE_PURCHASE = '2026-04-02T10:00:00.000Z';

export const PERSONA_FIXTURES: readonly PersonaFixture[] = [
  {
    key: 'ELITE_LEADER',
    wallet: PERSONA_WALLETS.ELITE_LEADER,
    label: 'Elite Leader',
    description: 'High-tier leader with large team performance.',
    status: 'active',
    tier: 'elite',
    cumulativeDeposit: '325000',
    holdingValueUsdt: '325000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_000,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000001',
  },
  {
    key: 'ADVANCED_USER',
    wallet: PERSONA_WALLETS.ADVANCED_USER,
    label: 'Advanced User',
    description: 'Mid-tier user with team performance but not elite.',
    status: 'active',
    tier: 'advanced',
    cumulativeDeposit: '80000',
    holdingValueUsdt: '80000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_001,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000002',
  },
  {
    key: 'BASIC_USER',
    wallet: PERSONA_WALLETS.BASIC_USER,
    label: 'Basic User',
    description: 'Entry tier.',
    status: 'active',
    tier: 'basic',
    cumulativeDeposit: '5000',
    holdingValueUsdt: '5000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_002,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000003',
  },
  {
    key: 'NEW_USER',
    wallet: PERSONA_WALLETS.NEW_USER,
    label: 'New User',
    description: 'Just signed up — no purchases yet, invite locked.',
    status: 'active',
    tier: null,
    cumulativeDeposit: '0',
    holdingValueUsdt: '0',
    createdAt: BASE_CREATED,
    firstPurchaseAt: null,
    blockNumberBase: 20_100_003,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000004',
  },
  {
    key: 'BURN_USER',
    wallet: PERSONA_WALLETS.BURN_USER,
    label: 'Burn User',
    description: 'Deposited 25k, holds only 8k — rewards burn against the deficit.',
    status: 'active',
    tier: 'advanced',
    cumulativeDeposit: '25000',
    holdingValueUsdt: '8000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_004,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000005',
  },
  {
    key: 'RESTRICTED_PURCHASE_USER',
    wallet: PERSONA_WALLETS.RESTRICTED_PURCHASE_USER,
    label: 'Restricted Purchase',
    description: 'Flagged account — claim ok, purchase blocked.',
    status: 'restricted_purchase',
    tier: 'basic',
    cumulativeDeposit: '3000',
    holdingValueUsdt: '3000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_005,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000006',
  },
  {
    key: 'RESTRICTED_CLAIM_USER',
    wallet: PERSONA_WALLETS.RESTRICTED_CLAIM_USER,
    label: 'Restricted Claim',
    description: 'Flagged account — purchase ok, claim blocked.',
    status: 'restricted_claim',
    tier: 'advanced',
    cumulativeDeposit: '40000',
    holdingValueUsdt: '40000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_006,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000007',
  },
  {
    key: 'SUSPENDED_USER',
    wallet: PERSONA_WALLETS.SUSPENDED_USER,
    label: 'Suspended',
    description: 'All operations blocked.',
    status: 'suspended',
    tier: 'basic',
    cumulativeDeposit: '2000',
    holdingValueUsdt: '2000',
    createdAt: BASE_CREATED,
    firstPurchaseAt: BASE_PURCHASE,
    blockNumberBase: 20_100_007,
    txHashPrefix: '0xfeedface00000000000000000000000000000000000000000000000000000008',
  },
];
