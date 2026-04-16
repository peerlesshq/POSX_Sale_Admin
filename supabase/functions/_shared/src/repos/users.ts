/**
 * `users` repo — data access only.
 *
 * No business rule or permission logic lives here. Status checks,
 * capability gating, and tier resolution happen in domain-rules or in
 * the service layer that consumes this repo.
 */
import type { UserStatus, WalletAddress } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface UserRow {
  wallet_address: WalletAddress;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  first_seen_at: string | null;
  first_authenticated_at: string | null;
  first_purchase_at: string | null;
  last_login_at: string | null;
  last_active_at: string | null;
  status_changed_at: string | null;
  status_reason: string | null;
  status_note: string | null;
}

export interface UserInsertInput {
  wallet_address: WalletAddress;
  status?: UserStatus;
  first_seen_at?: string | null;
  first_authenticated_at?: string | null;
  first_purchase_at?: string | null;
}

export async function insertUser(
  db: DbClient,
  input: UserInsertInput,
): Promise<UserRow> {
  return db.queryRequired<UserRow>(
    `insert into users (
        wallet_address, status, first_seen_at,
        first_authenticated_at, first_purchase_at
      ) values ($1, coalesce($2, 'active'), $3, $4, $5)
      returning *`,
    [
      input.wallet_address,
      input.status ?? null,
      input.first_seen_at ?? null,
      input.first_authenticated_at ?? null,
      input.first_purchase_at ?? null,
    ],
  );
}

export async function upsertUser(
  db: DbClient,
  input: UserInsertInput,
): Promise<UserRow> {
  return db.queryRequired<UserRow>(
    `insert into users (
        wallet_address, status, first_seen_at,
        first_authenticated_at, first_purchase_at
      ) values ($1, coalesce($2, 'active'), $3, $4, $5)
      on conflict (wallet_address) do update
        set status = excluded.status,
            first_seen_at = coalesce(users.first_seen_at, excluded.first_seen_at),
            first_authenticated_at = coalesce(users.first_authenticated_at, excluded.first_authenticated_at),
            first_purchase_at = coalesce(users.first_purchase_at, excluded.first_purchase_at)
      returning *`,
    [
      input.wallet_address,
      input.status ?? null,
      input.first_seen_at ?? null,
      input.first_authenticated_at ?? null,
      input.first_purchase_at ?? null,
    ],
  );
}

export async function findUserByWallet(
  db: DbClient,
  wallet: WalletAddress,
): Promise<UserRow | null> {
  return db.queryOne<UserRow>(
    `select * from users where wallet_address = $1`,
    [wallet],
  );
}

export async function listUsers(
  db: DbClient,
  options: { limit?: number; offset?: number } = {},
): Promise<UserRow[]> {
  return db.query<UserRow>(
    `select * from users order by created_at desc limit $1 offset $2`,
    [options.limit ?? 50, options.offset ?? 0],
  );
}

export interface UpdateUserStatusInput {
  wallet_address: WalletAddress;
  status: UserStatus;
  status_reason: string;
  status_note?: string | null;
  status_changed_at: string;
}

export async function updateUserStatus(
  db: DbClient,
  input: UpdateUserStatusInput,
): Promise<UserRow> {
  return db.queryRequired<UserRow>(
    `update users
        set status = $2,
            status_reason = $3,
            status_note = $4,
            status_changed_at = $5
      where wallet_address = $1
      returning *`,
    [
      input.wallet_address,
      input.status,
      input.status_reason,
      input.status_note ?? null,
      input.status_changed_at,
    ],
  );
}
