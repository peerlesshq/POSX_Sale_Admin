/**
 * User status transition helper.
 *
 * Constraint 2: `users.status` changes happen only here. Every
 * transition also writes an audit log entry automatically — admin
 * services never write to `admin_logs` and `users.status` in two
 * separate places.
 */
import type {
  Uuid,
  UserStatus,
  WalletAddress,
} from '@posx/shared-types';
import { assertUserStatusTransition } from '@posx/domain-rules';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import { withAuditTx } from '../observability/audit-log';
import {
  findUserByWallet,
  type UserRow,
  updateUserStatus,
} from '../repos/users';

export interface UserStatusTransitionInput {
  readonly wallet: WalletAddress;
  readonly toStatus: UserStatus;
  readonly reason: string;
  readonly effectiveFrom: string;
  readonly actorAdminId: Uuid | null;
  readonly note?: string | null;
  readonly ipAddress?: string | null;
}

/**
 * BE-22: the status update and the audit-log insert are now wrapped
 * in a single `withAuditTx` call. Before Pass 2, these were two
 * sequential awaits on the bare `db` connection — if the audit
 * insert threw, the status column had already advanced but there
 * was no audit record explaining why.
 */
export async function transitionUserStatus(
  db: DbClient,
  input: UserStatusTransitionInput,
): Promise<UserRow> {
  if (!input.reason || !input.reason.trim()) {
    throw new AppError('INVALID_REQUEST', 'status transition requires a reason');
  }

  const current = await findUserByWallet(db, input.wallet);
  if (!current) {
    throw new AppError('NOT_FOUND', `user ${input.wallet} not found`);
  }
  if (current.status === input.toStatus) return current;

  assertUserStatusTransition(current.status, input.toStatus);

  return withAuditTx(
    db,
    {
      adminUserId: input.actorAdminId,
      action: 'update_user_status',
      targetType: 'user',
      targetId: input.wallet,
      detail: {
        old_status: current.status,
        new_status: input.toStatus,
        reason: input.reason,
        note: input.note ?? null,
        effective_from: input.effectiveFrom,
      },
      ipAddress: input.ipAddress ?? null,
    },
    async (tx) =>
      updateUserStatus(tx, {
        wallet_address: input.wallet,
        status: input.toStatus,
        status_reason: input.reason,
        status_note: input.note ?? null,
        status_changed_at: input.effectiveFrom,
      }),
  );
}
