/**
 * Purchase order transition helper.
 *
 * Constraint 2 of Phase 4: every status change for
 * `purchase_orders` goes through this helper. Services and handlers
 * must not write `status =` directly.
 *
 * The helper:
 *   1. loads the current row (idempotent retry safe)
 *   2. asserts the transition via the domain-rules state guard
 *   3. updates the row via the repo
 *   4. returns the updated row
 */
import type { PurchaseOrderStatus, Uuid } from '@posx/shared-types';
import { assertPurchaseOrderTransition } from '@posx/domain-rules';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import { type AuditLogInput, withAuditTx } from '../observability/audit-log';
import {
  findPurchaseOrderById,
  type PurchaseOrderRow,
  updatePurchaseOrderStatus,
} from '../repos/purchases';

export interface PurchaseOrderTransitionInput {
  readonly orderId: Uuid;
  readonly toStatus: PurchaseOrderStatus;
  readonly confirmedAt?: string | null;
  /**
   * BE-22 — optional audit context. When provided the transition
   * write and the audit-log insert happen inside one transaction.
   */
  readonly audit?: AuditLogInput | null;
}

export async function transitionPurchaseOrder(
  db: DbClient,
  input: PurchaseOrderTransitionInput,
): Promise<PurchaseOrderRow> {
  const current = await findPurchaseOrderById(db, input.orderId);
  if (!current) {
    throw new AppError('PURCHASE_NOT_FOUND', `purchase_order ${input.orderId} not found`);
  }
  if (current.status === input.toStatus) {
    return current; // idempotent no-op
  }
  assertPurchaseOrderTransition(current.status, input.toStatus);

  const doUpdate = (conn: DbClient) =>
    updatePurchaseOrderStatus(
      conn,
      input.orderId,
      input.toStatus,
      input.confirmedAt ?? null,
    );

  if (input.audit) {
    return withAuditTx(db, input.audit, doUpdate);
  }
  return doUpdate(db);
}
