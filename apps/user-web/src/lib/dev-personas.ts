/**
 * Developer persona catalog for user-web.
 *
 * These personas drive two things at once:
 *   1. The dev auth bypass: clicking a persona on the login screen
 *      writes a fake session directly to localStorage.
 *   2. The mock API: when VITE_USE_MOCK_API=true, the mock client uses
 *      the current session's wallet as the lookup key for canned data.
 *
 * The persona wallets intentionally match the addresses used by the
 * expanded seed fixture so a developer running the real API with the
 * seeded DB gets the SAME behaviour as the mock.
 *
 * IMPORTANT: This file must NEVER be imported behind a production
 * build. The env gate in `env.ts` prevents the picker from rendering,
 * but a careless import chain could still leak it. Keep imports of
 * this module inside code paths guarded by `enableDevAuthBypass`.
 */

export type PersonaKey =
  | 'elite_leader'
  | 'advanced_user'
  | 'basic_user'
  | 'new_user'
  | 'burn_user'
  | 'restricted_purchase_user'
  | 'restricted_claim_user'
  | 'suspended_user';

export interface DevPersona {
  readonly key: PersonaKey;
  readonly walletAddress: string;
  readonly label: string;
  readonly description: string;
  readonly userStatus:
    | 'active'
    | 'restricted_purchase'
    | 'restricted_claim'
    | 'suspended'
    | 'blacklisted';
  readonly tier: 'elite' | 'advanced' | 'basic' | null;
  readonly cumulativeDeposit: string;
  readonly holdingValueUsdt: string;
  readonly directReferralCount: number;
}

export const DEV_PERSONAS: readonly DevPersona[] = [
  {
    key: 'elite_leader',
    walletAddress: '0xdeadbeef00000000000000000000000000000001',
    label: 'Elite Leader',
    description: 'High-tier team leader. Receives team + equal-level rewards. Full claim access.',
    userStatus: 'active',
    tier: 'elite',
    cumulativeDeposit: '325000',
    holdingValueUsdt: '325000',
    directReferralCount: 4,
  },
  {
    key: 'advanced_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000002',
    label: 'Advanced User',
    description: 'Mid-tier user with team performance but no equal-level qualification.',
    userStatus: 'active',
    tier: 'advanced',
    cumulativeDeposit: '80000',
    holdingValueUsdt: '80000',
    directReferralCount: 2,
  },
  {
    key: 'basic_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000003',
    label: 'Basic User',
    description: 'Entry tier with at least one direct referral.',
    userStatus: 'active',
    tier: 'basic',
    cumulativeDeposit: '5000',
    holdingValueUsdt: '5000',
    directReferralCount: 1,
  },
  {
    key: 'new_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000004',
    label: 'New User',
    description: 'Just signed up. No purchases, no referrals, invite locked.',
    userStatus: 'active',
    tier: null,
    cumulativeDeposit: '0',
    holdingValueUsdt: '0',
    directReferralCount: 0,
  },
  {
    key: 'burn_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000005',
    label: 'Burn User',
    description: 'Holding below burn threshold. Rewards burn partially on each settlement.',
    userStatus: 'active',
    tier: 'advanced',
    cumulativeDeposit: '25000',
    holdingValueUsdt: '8000',
    directReferralCount: 3,
  },
  {
    key: 'restricted_purchase_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000006',
    label: 'Restricted Purchase',
    description: 'Account flagged — can view and claim but cannot purchase.',
    userStatus: 'restricted_purchase',
    tier: 'basic',
    cumulativeDeposit: '3000',
    holdingValueUsdt: '3000',
    directReferralCount: 0,
  },
  {
    key: 'restricted_claim_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000007',
    label: 'Restricted Claim',
    description: 'Account flagged — can view and purchase but cannot claim.',
    userStatus: 'restricted_claim',
    tier: 'advanced',
    cumulativeDeposit: '40000',
    holdingValueUsdt: '40000',
    directReferralCount: 1,
  },
  {
    key: 'suspended_user',
    walletAddress: '0xdeadbeef00000000000000000000000000000008',
    label: 'Suspended',
    description: 'All operations blocked pending review.',
    userStatus: 'suspended',
    tier: 'basic',
    cumulativeDeposit: '2000',
    holdingValueUsdt: '2000',
    directReferralCount: 0,
  },
];

export function findPersona(key: PersonaKey): DevPersona | undefined {
  return DEV_PERSONAS.find((p) => p.key === key);
}

export function findPersonaByWallet(wallet: string): DevPersona | undefined {
  return DEV_PERSONAS.find((p) => p.walletAddress.toLowerCase() === wallet.toLowerCase());
}

/**
 * Synthesize a session row for the given persona. The session token
 * has a `dev-` prefix so a backend that receives it by mistake can
 * reject it loudly.
 */
export function buildDevSession(persona: DevPersona): {
  token: string;
  wallet: string;
  expiresAt: string;
  userStatus: string;
} {
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    token: `dev-${persona.key}-${Date.now().toString(36)}`,
    wallet: persona.walletAddress,
    expiresAt: exp,
    userStatus: persona.userStatus,
  };
}
