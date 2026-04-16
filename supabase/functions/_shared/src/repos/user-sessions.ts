/**
 * `user_sessions` repo — data access only.
 *
 * Session token HASHes are stored here, never raw tokens (08 §5.5).
 * Hashing is done by the service layer before insert/lookup.
 */
import type { IsoTimestamp, Uuid, WalletAddress } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface UserSessionRow {
  id: Uuid;
  wallet_address: WalletAddress;
  session_token_hash: string;
  issued_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  revoked_at: IsoTimestamp | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: IsoTimestamp;
}

export interface UserSessionInsertInput {
  wallet_address: WalletAddress;
  session_token_hash: string;
  issued_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  ip_address?: string | null;
  user_agent?: string | null;
}

export async function insertUserSession(
  db: DbClient,
  input: UserSessionInsertInput,
): Promise<UserSessionRow> {
  return db.queryRequired<UserSessionRow>(
    `insert into user_sessions (
        wallet_address, session_token_hash, issued_at, expires_at,
        ip_address, user_agent
      ) values ($1, $2, $3, $4, $5, $6)
      returning *`,
    [
      input.wallet_address,
      input.session_token_hash,
      input.issued_at,
      input.expires_at,
      input.ip_address ?? null,
      input.user_agent ?? null,
    ],
  );
}

export async function findUserSessionByTokenHash(
  db: DbClient,
  tokenHash: string,
): Promise<UserSessionRow | null> {
  return db.queryOne<UserSessionRow>(
    `select * from user_sessions where session_token_hash = $1`,
    [tokenHash],
  );
}

export async function revokeUserSession(
  db: DbClient,
  tokenHash: string,
  revokedAt: IsoTimestamp,
): Promise<void> {
  await db.query(
    `update user_sessions
        set revoked_at = $2
      where session_token_hash = $1 and revoked_at is null`,
    [tokenHash, revokedAt],
  );
}
