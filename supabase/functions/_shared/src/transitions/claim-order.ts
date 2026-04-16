/**
 * Claim order transition helper.
 *
 * Constraint 2: all `claim_orders.status` changes happen here. The
 * helper also releases snapshot locks when a claim terminates in a
 * non-confirmed state (cancelled / failed), so callers don't forget
 * to unlock.
 */
import {
  ClaimOrderStatus,
  type Uuid,
  type TxHash,
} from '@posx/shared-types';
import { assertClaimOrderTransition } from '@posx/domain-rules';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import { type AuditLogInput, withAuditTx } from '../observability/audit-log';
import {
  type ClaimOrderRow,
  updateClaimOrderStatus,
} from '../repos/claim-orders';
import { releaseTeamRewardLock } from '../repos/team-rewards';

export interface ClaimOrderTransitionInput {
  readonly order: ClaimOrderRow;
  readonly toStatus: ClaimOrderStatus;
  readonly timestamps?: {
    signed_at?: string | null;
    signed_message?: string | null;
    queued_at?: string | null;
    broadcasted_at?: string | null;
    broadcast_tx_hash?: TxHash | null;
    confirmed_at?: string | null;
    failed_at?: string | null;
    failure_reason?: string | null;
  };
  /** BE-22 — optional audit context. */
  readonly audit?: AuditLogInput | null;
}

export async function transitionClaimOrder(
  db: DbClient,
  input: ClaimOrderTransitionInput,
): Promise<ClaimOrderRow> {
  const { order, toStatus } = input;
  if (order.status === toStatus) return order;
  assertClaimOrderTransition(order.status, toStatus);

  const doTransition = async (conn: DbClient): Promise<ClaimOrderRow> => {
    const next = await updateClaimOrderStatus(conn, order.id, toStatus, input.timestamps ?? {});
    if (toStatus === ClaimOrderStatus.Cancelled || toStatus === ClaimOrderStatus.Failed) {
      await releaseTeamRewardLock(conn, order.id);
    }
    return next;
  };

  if (input.audit) {
    return withAuditTx(db, input.audit, doTransition);
  }
  return doTransition(db);
}

export async function requireClaimOrder(
  _db: DbClient,
  id: Uuid,
  existingRow: ClaimOrderRow | null,
): Promise<ClaimOrderRow> {
  if (existingRow && existingRow.id === id) return existingRow;
  throw new AppError('NOT_FOUND', `claim_order ${id} not found`);
}
