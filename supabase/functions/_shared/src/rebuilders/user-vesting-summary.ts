/**
 * `user_vesting_summary` rebuilder.
 *
 * Constraint 5: derived summary tables are populated only by
 * rebuilders. Sums come from `vesting_lots` (source of truth).
 *
 * Columns mirror 03 §11.2 semantics:
 *   - total_locked        = sum(total_locked) where status <> 'voided'
 *   - total_released      = sum(released_amount)
 *   - total_withdrawable  = sum(withdrawable_amount)
 *   - total_withdrawn     = sum(withdrawn_amount)
 */
import type { AmountString, WalletAddress } from '@posx/shared-types';

import type { DbClient } from '../db';
import { upsertUserVestingSummary } from '../repos/summaries';

interface AggregateRow {
  wallet_address: WalletAddress;
  total_locked: AmountString;
  total_released: AmountString;
  total_withdrawable: AmountString;
  total_withdrawn: AmountString;
}

export async function rebuildUserVestingSummaryFor(
  db: DbClient,
  wallet: WalletAddress,
): Promise<void> {
  const row = await db.queryOne<AggregateRow>(
    `select
        $1::text as wallet_address,
        coalesce(sum(total_locked), 0)::text        as total_locked,
        coalesce(sum(released_amount), 0)::text     as total_released,
        coalesce(sum(withdrawable_amount), 0)::text as total_withdrawable,
        coalesce(sum(withdrawn_amount), 0)::text    as total_withdrawn
       from vesting_lots
      where wallet_address = $1 and status <> 'voided'`,
    [wallet],
  );

  await upsertUserVestingSummary(db, {
    wallet_address: wallet,
    total_locked: row?.total_locked ?? '0',
    total_released: row?.total_released ?? '0',
    total_withdrawable: row?.total_withdrawable ?? '0',
    total_withdrawn: row?.total_withdrawn ?? '0',
  });
}

export async function rebuildUserVestingSummaryAll(db: DbClient): Promise<void> {
  const wallets = await db.query<{ wallet_address: WalletAddress }>(
    `select distinct wallet_address from vesting_lots`,
  );
  for (const { wallet_address } of wallets) {
    await rebuildUserVestingSummaryFor(db, wallet_address);
  }
}
