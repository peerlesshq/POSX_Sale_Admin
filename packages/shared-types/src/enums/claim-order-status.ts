/**
 * Claim order status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §10.7
 *   - 07_state_machines_and_exception_flows.md §17
 *
 * Transition summary (07 §17.2):
 *   pending_signature -> queued | cancelled | failed
 *   queued            -> broadcasted | failed
 *   broadcasted       -> confirmed | failed
 *
 * Snapshot locking: while the order is in `pending_signature`, `queued`,
 * or `broadcasted`, all linked claimable snapshots are locked via
 * `claim_order_id`. Locks release on terminal non-confirmed states.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ClaimOrderStatus = {
  PendingSignature: 'pending_signature',
  Queued: 'queued',
  Broadcasted: 'broadcasted',
  Confirmed: 'confirmed',
  Failed: 'failed',
  Cancelled: 'cancelled',
} as const;

export type ClaimOrderStatus =
  (typeof ClaimOrderStatus)[keyof typeof ClaimOrderStatus];

export const CLAIM_ORDER_STATUS_VALUES = [
  ClaimOrderStatus.PendingSignature,
  ClaimOrderStatus.Queued,
  ClaimOrderStatus.Broadcasted,
  ClaimOrderStatus.Confirmed,
  ClaimOrderStatus.Failed,
  ClaimOrderStatus.Cancelled,
] as const satisfies ReadonlyArray<ClaimOrderStatus>;

export const isClaimOrderStatus = createEnumGuard(CLAIM_ORDER_STATUS_VALUES);

/**
 * Terminal claim order states (07 §17.3).
 */
export const CLAIM_ORDER_TERMINAL_STATES = [
  ClaimOrderStatus.Confirmed,
  ClaimOrderStatus.Failed,
  ClaimOrderStatus.Cancelled,
] as const satisfies ReadonlyArray<ClaimOrderStatus>;

/**
 * States during which linked snapshots remain locked (07 §17.4).
 */
export const CLAIM_ORDER_LOCKING_STATES = [
  ClaimOrderStatus.PendingSignature,
  ClaimOrderStatus.Queued,
  ClaimOrderStatus.Broadcasted,
] as const satisfies ReadonlyArray<ClaimOrderStatus>;
