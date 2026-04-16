/**
 * `admin_users` repo — data access only.
 *
 * Password hashing happens in the AdminAuthService (Phase 4). This
 * repo stores whatever `password_hash` string the caller provides.
 */
import type { AdminRole, AdminStatus, Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface AdminUserRow {
  id: Uuid;
  email: string;
  password_hash: string;
  role: AdminRole;
  name: string;
  status: AdminStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserInsertInput {
  email: string;
  password_hash: string;
  role: AdminRole;
  name: string;
  status?: AdminStatus;
}

export async function insertAdminUser(
  db: DbClient,
  input: AdminUserInsertInput,
): Promise<AdminUserRow> {
  return db.queryRequired<AdminUserRow>(
    `insert into admin_users (email, password_hash, role, name, status)
      values ($1, $2, $3, $4, coalesce($5, 'active'))
      returning *`,
    [input.email, input.password_hash, input.role, input.name, input.status ?? null],
  );
}

export async function findAdminUserByEmail(
  db: DbClient,
  email: string,
): Promise<AdminUserRow | null> {
  return db.queryOne<AdminUserRow>(
    `select * from admin_users where email = $1`,
    [email],
  );
}

export async function findAdminUserById(
  db: DbClient,
  id: Uuid,
): Promise<AdminUserRow | null> {
  return db.queryOne<AdminUserRow>(
    `select * from admin_users where id = $1`,
    [id],
  );
}

export async function listAdminUsers(db: DbClient): Promise<AdminUserRow[]> {
  return db.query<AdminUserRow>(
    `select * from admin_users order by created_at asc`,
  );
}
