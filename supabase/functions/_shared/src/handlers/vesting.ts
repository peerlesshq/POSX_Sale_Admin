/**
 * GET /api/v1/vesting handler.
 */
import type { WalletAddress } from '@posx/shared-types';
import { buildPaginationMeta, normalizePagination } from '@posx/shared-utils';

import { findUserVestingSummary } from '../repos/summaries';
import { listVestingLotsByWallet } from '../repos/vesting-lots';

import { success, type HandlerContext, type HandlerSuccess } from './types';

export async function handleGetVesting(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: { page?: number; page_size?: number },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, offset, limit } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const allLots = await listVestingLotsByWallet(ctx.db, wallet);
  const pageLots = allLots.slice(offset, offset + limit);
  const summary = await findUserVestingSummary(ctx.db, wallet);

  return success(ctx, {
    summary: {
      total_locked: summary?.total_locked ?? '0',
      total_released: summary?.total_released ?? '0',
      total_withdrawable: summary?.total_withdrawable ?? '0',
      total_withdrawn: summary?.total_withdrawn ?? '0',
    },
    lots: pageLots.map((l) => ({
      vesting_lot_id: l.id,
      purchase_id: l.purchase_id,
      total_locked: l.total_locked,
      start_time: l.start_time,
      lock_days: l.lock_days,
      release_days: l.release_days,
      released_amount: l.released_amount,
      withdrawable_amount: l.withdrawable_amount,
      withdrawn_amount: l.withdrawn_amount,
      status: l.status,
    })),
    pagination: buildPaginationMeta(page, pageSize, allLots.length),
  });
}
