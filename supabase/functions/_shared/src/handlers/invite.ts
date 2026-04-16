/**
 * Invite handlers.
 */
import type { WalletAddress } from '@posx/shared-types';
import { amountGte, buildPaginationMeta, maskWalletAddress, normalizePagination } from '@posx/shared-utils';

import { sumConfirmedDeposit } from '../repos/purchases';

import { success, type HandlerContext, type HandlerSuccess } from './types';

const UNLOCK_THRESHOLD = '1000';

export async function handleGetInvite(
  ctx: HandlerContext,
  wallet: WalletAddress,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const deposit = await sumConfirmedDeposit(ctx.db, wallet);
  const unlocked = amountGte(deposit, UNLOCK_THRESHOLD);

  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from referral_closure
      where ancestor_wallet_address = $1 and depth = 1`,
    [wallet],
  );

  const statsRow = await ctx.db.queryOne<{ total_deposit: string; active: number }>(
    `select coalesce(sum(p.usdt_amount),0)::text as total_deposit,
            coalesce(count(distinct case when u.status = 'active' then u.wallet_address end),0)::int as active
       from referral_closure rc
       join users u on u.wallet_address = rc.descendant_wallet_address
       left join purchases p on p.wallet_address = u.wallet_address and p.is_reversed = false
      where rc.ancestor_wallet_address = $1 and rc.depth = 1`,
    [wallet],
  );

  // Referral code: derived deterministically from the wallet so the
  // link is stable without a separate table. Frontend-only concern.
  const referralCode = wallet.slice(-8);

  return success(ctx, {
    invite_unlocked: unlocked,
    unlock_threshold: UNLOCK_THRESHOLD,
    current_cumulative_deposit: deposit,
    invite_link: `https://posx.example/?r=${referralCode}`,
    referral_code: referralCode,
    referral_count: countRow?.total ?? 0,
    referral_stats: {
      total_referral_deposit: statsRow?.total_deposit ?? '0',
      active_referral_count: statsRow?.active ?? 0,
    },
  });
}

export async function handleListInviteReferrals(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: { page?: number; page_size?: number },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    child: string;
    bound_at: string;
    cumulative_deposit: string;
    status: string;
  }>(
    `select u.wallet_address as child,
            rb.bound_at,
            coalesce((select sum(usdt_amount) from purchases
                        where wallet_address = u.wallet_address and is_reversed = false),0)::text as cumulative_deposit,
            u.status
       from referral_bindings rb
       join users u on u.wallet_address = rb.child_wallet_address
      where rb.parent_wallet_address = $1
      order by rb.bound_at desc
      limit $2 offset $3`,
    [wallet, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from referral_bindings where parent_wallet_address = $1`,
    [wallet],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      wallet_address_masked: maskWalletAddress(r.child),
      bound_at: r.bound_at,
      cumulative_deposit: r.cumulative_deposit,
      current_tier: null,
      status: r.status,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}
