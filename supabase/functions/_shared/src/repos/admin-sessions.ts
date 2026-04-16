/**
 * `admin_sessions` repo — data access only.
 */
import type { IsoTimestamp, Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface AdminSessionRow {
  id: Uuid;
  admin_user_id: Uuid;
  session_token_hash: string;
  issued_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  revoked_at: IsoTimestamp | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: IsoTimestamp;
}

export interface AdminSessionInsertInput {
  admin_user_id: Uuid;
  session_token_hash: string;
  issued_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  ip_address?: string | null;
  user_agent?: string | null;
}

export async function insertAdminSession(
  db: DbClient,
  input: AdminSessionInsertInput,
): Promise<AdminSessionRow> {
  return db.queryRequired<AdminSessionRow>(
    `insert into admin_sessions (
        admin_user_id, session_token_hash, issued_at, expires_at,
        ip_address, user_agent
      ) values ($1, $2, $3, $4, $5, $6)
      returning *`,
    [
      input.admin_user_id,
      input.session_token_hash,
      input.issued_at,
      input.expires_at,
      input.ip_address ?? null,
      input.user_agent ?? null,
    ],
  );
}

export async function findAdminSessionByTokenHash(
  db: DbClient,
  tokenHash: string,
): Promise<AdminSessionRow | null> {
  return db.queryOne<AdminSessionRow>(
    `select * from admin_sessions where session_token_hash = $1`,
    [tokenHash],
  );
}

export async function revokeAdminSession(
  db: DbClient,
  tokenHash: string,
  revokedAt: IsoTimestamp,
): Promise<void> {
  await db.query(
    `update admin_sessions
        set revoked_at = $2
      where session_token_hash = $1 and revoked_at is null`,
    [tokenHash, revokedAt],
  );
}
