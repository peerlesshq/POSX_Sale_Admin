/**
 * Purchase order status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §9.1
 *   - 07_state_machines_and_exception_flows.md §9
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const PurchaseOrderStatus = {
  Created: 'created',
  ApprovalPending: 'approval_pending',
  ApprovalDone: 'approval_done',
  PurchasePending: 'purchase_pending',
  Confirmed: 'confirmed',
  Failed: 'failed',
  Reversed: 'reversed',
  Cancelled: 'cancelled',
} as const;

export type PurchaseOrderStatus =
  (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const PURCHASE_ORDER_STATUS_VALUES = [
  PurchaseOrderStatus.Created,
  PurchaseOrderStatus.ApprovalPending,
  PurchaseOrderStatus.ApprovalDone,
  PurchaseOrderStatus.PurchasePending,
  PurchaseOrderStatus.Confirmed,
  PurchaseOrderStatus.Failed,
  PurchaseOrderStatus.Reversed,
  PurchaseOrderStatus.Cancelled,
] as const satisfies ReadonlyArray<PurchaseOrderStatus>;

export const isPurchaseOrderStatus = createEnumGuard(PURCHASE_ORDER_STATUS_VALUES);

/**
 * Terminal purchase order states — once entered, no further normal
 * progression occurs (07 §9.3). Recovery may still link a purchase fact
 * to a previously failed order via a validated recovery record.
 */
export const PURCHASE_ORDER_TERMINAL_STATES = [
  PurchaseOrderStatus.Confirmed,
  PurchaseOrderStatus.Failed,
  PurchaseOrderStatus.Reversed,
  PurchaseOrderStatus.Cancelled,
] as const satisfies ReadonlyArray<PurchaseOrderStatus>;
