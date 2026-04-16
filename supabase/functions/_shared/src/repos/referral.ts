/**
 * Referral bindings + closure repo — data access only.
 *
 * No cycle detection, no self-reference checks, no "is this a first
 * purchase" logic. Those rules belong in Phase 4's
 * `ReferralBindingService`. This repo only writes whatever rows it
 * is told to write.
 */
import type { BindingSource, WalletAddress } from '@posx/shared-types';

import type { DbClient } from '../db';

// ---------- referral_bindings ----------

export interface ReferralBindingRow {
  child_wallet_address: WalletAddress;
  parent_wallet_address: WalletAddress;
  binding_source: BindingSource;
  binding_tx_hash: string | null;
  bound_at: string;
  is_locked: boolean;
  created_at: string;
}

export interface ReferralBindingInsertInput {
  child_wallet_address: WalletAddress;
  parent_wallet_address: WalletAddress;
  binding_source: BindingSource;
  binding_tx_hash?: string | null;
  bound_at: string;
  is_locked?: boolean;
}

export async function insertReferralBinding(
  db: DbClient,
  input: ReferralBindingInsertInput,
): Promise<ReferralBindingRow> {
  return db.queryRequired<ReferralBindingRow>(
    `insert into referral_bindings (
        child_wallet_address, parent_wallet_address, binding_source,
        binding_tx_hash, bound_at, is_locked
      ) values ($1, $2, $3, $4, $5, coalesce($6, true))
      returning *`,
    [
      input.child_wallet_address,
      input.parent_wallet_address,
      input.binding_source,
      input.binding_tx_hash ?? null,
      input.bound_at,
      input.is_locked ?? null,
    ],
  );
}

export async function findReferralBindingByChild(
  db: DbClient,
  child: WalletAddress,
): Promise<ReferralBindingRow | null> {
  return db.queryOne<ReferralBindingRow>(
    `select * from referral_bindings where child_wallet_address = $1`,
    [child],
  );
}

// ---------- referral_closure ----------

export interface ReferralClosureRow {
  ancestor_wallet_address: WalletAddress;
  descendant_wallet_address: WalletAddress;
  depth: number;
  created_at: string;
}

export interface ReferralClosureInsertInput {
  ancestor_wallet_address: WalletAddress;
  descendant_wallet_address: WalletAddress;
  depth: number;
}

export async function insertReferralClosureRow(
  db: DbClient,
  input: ReferralClosureInsertInput,
): Promise<ReferralClosureRow> {
  return db.queryRequired<ReferralClosureRow>(
    `insert into referral_closure (
        ancestor_wallet_address, descendant_wallet_address, depth
      ) values ($1, $2, $3)
      on conflict (ancestor_wallet_address, descendant_wallet_address) do update
        set depth = excluded.depth
      returning *`,
    [input.ancestor_wallet_address, input.descendant_wallet_address, input.depth],
  );
}

export async function listDirectSubordinates(
  db: DbClient,
  ancestor: WalletAddress,
): Promise<ReferralClosureRow[]> {
  return db.query<ReferralClosureRow>(
    `select * from referral_closure
       where ancestor_wallet_address = $1 and depth = 1
       order by descendant_wallet_address`,
    [ancestor],
  );
}

export async function listDescendantsInDepthRange(
  db: DbClient,
  ancestor: WalletAddress,
  depthStart: number,
  depthEnd: number,
): Promise<ReferralClosureRow[]> {
  return db.query<ReferralClosureRow>(
    `select * from referral_closure
       where ancestor_wallet_address = $1
         and depth between $2 and $3
       order by depth asc, descendant_wallet_address asc`,
    [ancestor, depthStart, depthEnd],
  );
}

export async function listAncestorsByDescendant(
  db: DbClient,
  descendant: WalletAddress,
): Promise<ReferralClosureRow[]> {
  return db.query<ReferralClosureRow>(
    `select * from referral_closure
       where descendant_wallet_address = $1
       order by depth asc`,
    [descendant],
  );
}
