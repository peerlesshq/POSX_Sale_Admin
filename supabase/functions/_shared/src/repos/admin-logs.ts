/**
 * `admin_logs` repo — data access only.
 *
 * Every privileged admin action MUST write an audit entry here. The
 * service layer decides what constitutes "privileged"; this repo
 * just writes what it is given.
 */
import type { Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface AdminLogRow {
  id: Uuid;
  admin_user_id: Uuid | null;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminLogInsertInput {
  admin_user_id?: Uuid | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  detail?: Record<string, unknown> | null;
  ip_address?: string | null;
}

export async function insertAdminLog(
  db: DbClient,
  input: AdminLogInsertInput,
): Promise<AdminLogRow> {
  return db.queryRequired<AdminLogRow>(
    `insert into admin_logs (
        admin_user_id, action, target_type, target_id, detail, ip_address
      ) values ($1, $2, $3, $4, $5::jsonb, $6)
      returning *`,
    [
      input.admin_user_id ?? null,
      input.action,
      input.target_type,
      input.target_id ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
      input.ip_address ?? null,
    ],
  );
}
