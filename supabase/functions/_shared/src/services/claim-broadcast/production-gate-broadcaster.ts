/**
 * `ProductionGateClaimBroadcaster` — BE-56/58 safety gate.
 *
 * There is currently NO real on-chain broadcaster wired against the
 * contract. Both the mock and staging adapters produce deterministic
 * SHA-256 fake tx hashes that look real but move no tokens. Shipping
 * the staging adapter to production would mean every user who signs
 * a claim gets a plausible-looking but completely fake confirmation.
 *
 * Until the real `ProductionClaimBroadcaster` (wired against an RPC
 * endpoint plus a cron-scheduled `ClaimFinalizationService.finalize`)
 * lands, this adapter is the only thing that is allowed to run in
 * production. It refuses to submit anything, surfaces a clear error
 * code to the frontend, and cannot be confused with success.
 *
 * Constraint: the transition from `pending_signature → queued` should
 * still fire via `ClaimSigningService` BEFORE `submit` is called, so
 * the user's signed message gets persisted and the order row reflects
 * that a sign attempt happened. Returning `failed` here means the
 * signing service will transition `queued → failed` with our reason,
 * which is the correct observable state for "the platform is not
 * paying out claims right now".
 */
import type {
  BroadcastConfirmation,
  BroadcastInput,
  BroadcastOutcome,
  ClaimBroadcastAdapter,
} from './adapter';

export class ProductionGateClaimBroadcaster implements ClaimBroadcastAdapter {
  readonly name = 'production-gate-claim-broadcaster';
  /**
   * Even though we never actually broadcast, we report as if we do
   * preserve intermediate states. That way the settlement/finalization
   * loop does not short-circuit the `queued → broadcasted → confirmed`
   * ladder — we simply never leave `queued`.
   */
  readonly preserveIntermediateStates = true;

  async submit(_input: BroadcastInput): Promise<BroadcastOutcome> {
    return {
      kind: 'failed',
      reason:
        'claim broadcast is disabled in production until the real on-chain adapter is wired',
    };
  }

  async checkConfirmation(_txHash: string): Promise<BroadcastConfirmation> {
    return {
      confirmed: false,
      failureReason:
        'claim broadcast is disabled in production until the real on-chain adapter is wired',
    };
  }
}
