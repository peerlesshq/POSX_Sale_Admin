/**
 * ReferralBindingService.
 *
 * Source of truth: 01_business_rules_spec.md §10, 02 §14,
 * 07_state_machines_and_exception_flows.md §12.
 *
 * - Binding occurs only on first successful purchase (01 §10.1).
 * - Self-referral and cycles are rejected (01 §10.4).
 * - Binding is immutable after insertion (01 §10.5).
 * - Closure rows are created in the same transaction as the binding.
 */
import type {
  BindingSource,
  TxHash,
  WalletAddress,
} from '@posx/shared-types';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findReferralBindingByChild,
  insertReferralBinding,
  insertReferralClosureRow,
  listAncestorsByDescendant,
} from '../repos/referral';

export interface BindReferralInput {
  readonly childWallet: WalletAddress;
  readonly parentWallet: WalletAddress;
  readonly source: BindingSource;
  readonly bindingTxHash?: TxHash | null;
  readonly boundAt: string;
}

export class ReferralBindingService {
  constructor(private readonly db: DbClient) {}

  /**
   * Idempotent: if the child already has a binding, return without
   * re-inserting. Otherwise validate, insert the binding row, and
   * expand the closure by walking up through the parent's own
   * ancestor chain.
   */
  async bindOnFirstPurchase(input: BindReferralInput): Promise<void> {
    // 01 §10.4 condition 1: child must not already be bound.
    const existing = await findReferralBindingByChild(this.db, input.childWallet);
    if (existing) {
      // 01 §10.6: later attempts are silently ignored.
      return;
    }

    // 01 §10.4 condition 4: self-referral rejected.
    if (input.childWallet.toLowerCase() === input.parentWallet.toLowerCase()) {
      throw new AppError('SELF_REFERRAL_NOT_ALLOWED', 'cannot refer self');
    }

    // 01 §10.4 condition 5: prevent cycles. A cycle exists iff the
    // parent's ancestor chain already contains the child wallet.
    const parentAncestors = await listAncestorsByDescendant(
      this.db,
      input.parentWallet,
    );
    for (const row of parentAncestors) {
      if (row.ancestor_wallet_address.toLowerCase() === input.childWallet.toLowerCase()) {
        throw new AppError(
          'REFERRAL_CYCLE_NOT_ALLOWED',
          'referral binding would create a cycle',
        );
      }
    }

    await this.db.transaction(async (tx) => {
      await insertReferralBinding(tx, {
        child_wallet_address: input.childWallet,
        parent_wallet_address: input.parentWallet,
        binding_source: input.source,
        binding_tx_hash: input.bindingTxHash ?? null,
        bound_at: input.boundAt,
        is_locked: true,
      });

      // Closure expansion: depth-1 is (parent -> child). Then for
      // each ancestor of the parent, extend depth + 1.
      await insertReferralClosureRow(tx, {
        ancestor_wallet_address: input.parentWallet,
        descendant_wallet_address: input.childWallet,
        depth: 1,
      });
      for (const ancestor of parentAncestors) {
        await insertReferralClosureRow(tx, {
          ancestor_wallet_address: ancestor.ancestor_wallet_address,
          descendant_wallet_address: input.childWallet,
          depth: ancestor.depth + 1,
        });
      }
    });
  }
}
