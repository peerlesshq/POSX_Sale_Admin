/**
 * Reversal + adjustment fixture — Phase 4 constraint 6.
 *
 * Minimal path: one confirmed purchase is reversed by a super admin,
 * a `purchase_reversals` row is created, `purchases.is_reversed` is
 * flipped to true, and a matching `adjustment_records` debit row
 * offsets the wallet's unclaimed balance.
 *
 * This exercises:
 *   - PurchaseReversalService transaction semantics
 *   - AdjustmentService.create (debit direction)
 *   - Audit log coverage for a super-admin-only action
 *   - The "reversed purchase excluded from cumulative deposit"
 *     reporting rule (11 §20.1)
 *
 * Isolation: this fixture uses its own wallets so it cannot
 * accidentally interfere with the main end-to-end happy-path or the
 * burn fixture.
 */
import type { WalletAddress } from '@posx/shared-types';

export const REVERSAL_WALLETS = {
  W_REVERSAL_BUYER: '0xaffe000000000000000000000000000000000001' as WalletAddress,
};

export const REVERSAL_FIXTURE = {
  wallet: REVERSAL_WALLETS.W_REVERSAL_BUYER,
  purchase: {
    amountUsdt: '5000',
    purchaseAt: '2026-04-05T08:00:00.000Z',
    blockNumber: 20_000_200,
    txHash: '0xaffe100000000000000000000000000000000000000000000000000000000001',
  },
  reversal: {
    reason: 'duplicate payment reconciliation',
    reversalType: 'duplicate_payment' as const,
    effectiveAt: '2026-04-09T00:00:00.000Z',
    notes: 'Phase 4 seed fixture — exercises reversal + adjustment path',
  },
  /**
   * Debit offset to clawback a previously paid off-chain reward.
   * Kept small (10 USDT) because the main end-to-end dataset never
   * paid this buyer any off-chain reward; the adjustment exists
   * purely so the ledger shape is realistic.
   */
  offsetAmount: '10' as const,
} as const;
