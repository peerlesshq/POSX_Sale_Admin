/**
 * Admin audit log helper.
 *
 * Every privileged admin action funnels through this helper so the
 * audit trail stays complete. Services must not insert into
 * `admin_logs` via the repo directly — go through `writeAuditLog`.
 */
import type { Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';
import { insertAdminLog } from '../repos/admin-logs';

export interface AuditLogInput {
  adminUserId: Uuid | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function writeAuditLog(
  db: DbClient,
  input: AuditLogInput,
): Promise<void> {
  await insertAdminLog(db, {
    admin_user_id: input.adminUserId ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    detail: input.detail ?? null,
    ip_address: input.ipAddress ?? null,
  });
}

/**
 * BE-22 / BE-79 — transactional audit helper.
 *
 * Wraps a state-mutating callback AND the paired audit-log write
 * inside a single `db.transaction()`. If EITHER the mutation or the
 * audit insert throws, both roll back — the state column never
 * advances without a matching audit trail, and a failed audit insert
 * never leaves the state column stale.
 *
 * Usage pattern:
 *
 * ```ts
 * const updated = await withAuditTx(db, auditInput, async (tx) => {
 *   return updateUserStatus(tx, { ... });
 * });
 * ```
 *
 * The helper returns whatever `fn(tx)` returned so the caller can
 * chain off the updated row.
 */
export async function withAuditTx<T>(
  db: DbClient,
  audit: AuditLogInput,
  fn: (tx: DbClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await fn(tx);
    await writeAuditLog(tx, audit);
    return result;
  });
}
