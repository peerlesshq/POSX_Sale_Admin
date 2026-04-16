/**
 * ClaimBroadcastAdapter interface.
 *
 * Phase 1 assumption #14: the payout mechanism is intentionally
 * abstracted so Phase 5 / Phase 6 can slot in a real on-chain
 * contract call without touching claim services.
 *
 * Constraint 6 of Phase 2 (reiterated in Phase 4): the
 * `MockClaimBroadcaster` is allowed only in local development.
 * Staging / production must preserve `queued` and `broadcasted`
 * intermediate states even when the payout is simulated.
 */
import type {
  AmountString,
  TxHash,
  Uuid,
  WalletAddress,
} from '@posx/shared-types';

export interface BroadcastInput {
  readonly claimOrderId: Uuid;
  readonly wallet: WalletAddress;
  readonly amount: AmountString;
}

export type BroadcastOutcome =
  | { readonly kind: 'submitted'; readonly txHash: TxHash }
  | { readonly kind: 'failed'; readonly reason: string };

export interface BroadcastConfirmation {
  readonly confirmed: boolean;
  readonly failureReason?: string;
}

/**
 * A broadcast adapter owns ALL chain-side communication for claim
 * payouts. It exposes only two operations:
 *   - `submit` to kick off the chain tx (or simulate it)
 *   - `checkConfirmation` to poll whether the tx is final
 */
export interface ClaimBroadcastAdapter {
  readonly name: string;
  readonly preserveIntermediateStates: boolean;

  submit(input: BroadcastInput): Promise<BroadcastOutcome>;
  checkConfirmation(txHash: TxHash): Promise<BroadcastConfirmation>;
}
