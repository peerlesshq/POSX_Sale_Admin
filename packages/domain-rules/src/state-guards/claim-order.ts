/**
 * Claim order state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §17
 *
 * Notes:
 *   - `pending_signature → failed` is allowed only when the signature
 *     validation process explicitly records failure terminally
 *     (07 §17.2). The guard permits it; service code is responsible
 *     for deciding when it's appropriate to use this path rather than
 *     transitioning to `cancelled`.
 *   - `broadcasted` is never rebroadcast from the guard's perspective.
 *     Retry logic for broadcast failure must create a new claim order
 *     rather than re-entering `queued` from `broadcasted`.
 */
import {
  ClaimOrderStatus,
  type ClaimOrderStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [ClaimOrderStatus.PendingSignature]: [
    ClaimOrderStatus.Queued,
    ClaimOrderStatus.Cancelled,
    ClaimOrderStatus.Failed,
  ],
  [ClaimOrderStatus.Queued]: [
    ClaimOrderStatus.Broadcasted,
    ClaimOrderStatus.Failed,
  ],
  [ClaimOrderStatus.Broadcasted]: [
    ClaimOrderStatus.Confirmed,
    ClaimOrderStatus.Failed,
  ],
  [ClaimOrderStatus.Confirmed]: [],
  [ClaimOrderStatus.Failed]: [],
  [ClaimOrderStatus.Cancelled]: [],
};

export function canTransitionClaimOrder(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertClaimOrderTransition(from: Status, to: Status): void {
  if (!canTransitionClaimOrder(from, to)) {
    throw new Error(`Forbidden claim_order transition: ${from} -> ${to}`);
  }
}
