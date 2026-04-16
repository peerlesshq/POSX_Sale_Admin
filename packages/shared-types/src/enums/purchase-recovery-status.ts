/**
 * Purchase recovery status — used when a chain-confirmed purchase was
 * missed by normal sync linkage and the user submits the tx hash for
 * recovery.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §9.3
 *   - 07_state_machines_and_exception_flows.md §10
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const PurchaseRecoveryStatus = {
  Requested: 'requested',
  Resolved: 'resolved',
  Failed: 'failed',
  Duplicate: 'duplicate',
} as const;

export type PurchaseRecoveryStatus =
  (typeof PurchaseRecoveryStatus)[keyof typeof PurchaseRecoveryStatus];

export const PURCHASE_RECOVERY_STATUS_VALUES = [
  PurchaseRecoveryStatus.Requested,
  PurchaseRecoveryStatus.Resolved,
  PurchaseRecoveryStatus.Failed,
  PurchaseRecoveryStatus.Duplicate,
] as const satisfies ReadonlyArray<PurchaseRecoveryStatus>;

export const isPurchaseRecoveryStatus = createEnumGuard(
  PURCHASE_RECOVERY_STATUS_VALUES,
);
