/**
 * Purchase order state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §9
 */
import {
  PurchaseOrderStatus,
  type PurchaseOrderStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [PurchaseOrderStatus.Created]: [
    PurchaseOrderStatus.ApprovalPending,
    PurchaseOrderStatus.ApprovalDone,
    PurchaseOrderStatus.PurchasePending,
    PurchaseOrderStatus.Failed,
    PurchaseOrderStatus.Cancelled,
  ],
  [PurchaseOrderStatus.ApprovalPending]: [
    PurchaseOrderStatus.ApprovalDone,
    PurchaseOrderStatus.PurchasePending,
    PurchaseOrderStatus.Failed,
    PurchaseOrderStatus.Cancelled,
  ],
  [PurchaseOrderStatus.ApprovalDone]: [
    PurchaseOrderStatus.PurchasePending,
    PurchaseOrderStatus.Failed,
    PurchaseOrderStatus.Cancelled,
  ],
  [PurchaseOrderStatus.PurchasePending]: [
    PurchaseOrderStatus.Confirmed,
    PurchaseOrderStatus.Failed,
    // cancelled only if purchase never truly existed on chain (07 §9.2)
    PurchaseOrderStatus.Cancelled,
  ],
  [PurchaseOrderStatus.Confirmed]: [
    // post-confirmation exception path only
    PurchaseOrderStatus.Reversed,
  ],
  [PurchaseOrderStatus.Failed]: [
    // Only via validated recovery linkage (07 §9.5). We allow the
    // transition here; higher-level services are responsible for
    // proving recovery validity.
    PurchaseOrderStatus.Confirmed,
  ],
  [PurchaseOrderStatus.Cancelled]: [
    // Same caveat as Failed → Confirmed.
    PurchaseOrderStatus.Confirmed,
  ],
  [PurchaseOrderStatus.Reversed]: [],
};

export function canTransitionPurchaseOrder(
  from: Status,
  to: Status,
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertPurchaseOrderTransition(from: Status, to: Status): void {
  if (!canTransitionPurchaseOrder(from, to)) {
    throw new Error(`Forbidden purchase_order transition: ${from} -> ${to}`);
  }
}
