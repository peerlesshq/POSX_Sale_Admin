/**
 * `auth_nonces` repo — data access only.
 *
 * Single-use wallet login nonces (08 §5.3, 07 §6). This repo never
 * decides whether a nonce is *valid* for a given auth attempt — it
 * only inserts rows and marks them used / reads them back. Validity
 * (nonce fresh, not used, not expired, wallet matches) is checked in
 * `WalletVerifyService` (Phase 4 services).
 */
import type { IsoTimestamp, WalletAddress } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface AuthNonceRow {
  id: number;
  wallet_address: WalletAddress;
  nonce: string;
  expires_at: IsoTimestamp;
  used_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
}

export interface AuthNonceInsertInput {
  wallet_address: WalletAddress;
  nonce: string;
  expires_at: IsoTimestamp;
}

export async function insertAuthNonce(
  db: DbClient,
  input: AuthNonceInsertInput,
): Promise<AuthNonceRow> {
  return db.queryRequired<AuthNonceRow>(
    `insert into auth_nonces (wallet_address, nonce, expires_at)
      values ($1, $2, $3)
      returning *`,
    [input.wallet_address, input.nonce, input.expires_at],
  );
}

export async function findAuthNonceByValue(
  db: DbClient,
  nonce: string,
): Promise<AuthNonceRow | null> {
  return db.queryOne<AuthNonceRow>(
    `select * from auth_nonces where nonce = $1`,
    [nonce],
  );
}

export async function markAuthNonceUsed(
  db: DbClient,
  nonce: string,
  usedAt: IsoTimestamp,
): Promise<AuthNonceRow | null> {
  return db.queryOne<AuthNonceRow>(
    `update auth_nonces
        set used_at = $2
      where nonce = $1 and used_at is null
      returning *`,
    [nonce, usedAt],
  );
}

export async function deleteExpiredAuthNonces(
  db: DbClient,
  olderThanIso: IsoTimestamp,
): Promise<number> {
  const rows = await db.query<{ id: number }>(
    `delete from auth_nonces
       where expires_at < $1
       returning id`,
    [olderThanIso],
  );
  return rows.length;
}
