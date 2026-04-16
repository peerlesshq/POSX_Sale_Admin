/**
 * Team handlers — overview / members / daily details.
 */
import type { WalletAddress } from '@posx/shared-types';
import { buildPaginationMeta, normalizePagination } from '@posx/shared-utils';
import { maskWalletAddress } from '@posx/shared-utils';

import { success, type HandlerContext, type HandlerSuccess } from './types';

export async function handleGetTeamOverview(
  ctx: HandlerContext,
  wallet: WalletAddress,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const row = await ctx.db.queryOne<{
    team_total: string;
    claimable: string;
    received: string;
    claimed: string;
  }>(
    `select
        coalesce((select sum(p.usdt_amount) from referral_closure rc
                    join purchases p on p.wallet_address = rc.descendant_wallet_address
                   where rc.ancestor_wallet_address = $1 and p.is_reversed = false),0)::text as team_total,
        coalesce((select sum(actual_total) from team_rewards_daily
                   where wallet_address = $1 and status = 'claimable'),0)::text as claimable,
        coalesce((select sum(actual_total) from team_rewards_daily
                   where wallet_address = $1),0)::text as received,
        coalesce((select sum(amount) from claim_records
                   where wallet_address = $1 and status = 'confirmed'),0)::text as claimed`,
    [wallet],
  );

  return success(ctx, {
    team_total_performance: row?.team_total ?? '0',
    today_effective_performance: '0',
    claimable_amount: row?.claimable ?? '0',
    pending_confirmation_amount: '0',
    total_received: row?.received ?? '0',
    total_claimed: row?.claimed ?? '0',
    current_team_rate: '0',
    current_tier: null,
    next_rate_target: null,
  });
}

export async function handleListTeamMembers(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: { page?: number; page_size?: number; level?: number },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, offset, limit } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });

  // Direct members (depth = 1) with detail; deeper levels only
  // surface as aggregates (privacy rule 01 §19.2).
  const membersRows = await ctx.db.query<{
    wallet_address: string;
    joined_at: string;
    cumulative_deposit: string;
    status: string;
    direct_count: number;
  }>(
    `select u.wallet_address,
            rb.bound_at as joined_at,
            coalesce((select sum(usdt_amount) from purchases
                        where wallet_address = u.wallet_address and is_reversed = false),0)::text as cumulative_deposit,
            u.status,
            (select count(*)::int from referral_closure
               where ancestor_wallet_address = u.wallet_address and depth = 1) as direct_count
       from referral_closure rc
       join users u on u.wallet_address = rc.descendant_wallet_address
       join referral_bindings rb on rb.child_wallet_address = u.wallet_address
      where rc.ancestor_wallet_address = $1 and rc.depth = 1
      order by rb.bound_at asc
      limit $2 offset $3`,
    [wallet, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from referral_closure
      where ancestor_wallet_address = $1 and depth = 1`,
    [wallet],
  );

  const aggRows = await ctx.db.query<{
    level: number;
    member_count: number;
    active_count: number;
    new_performance: string;
    cumulative_performance: string;
  }>(
    `select level, member_count, active_count,
            new_performance::text, cumulative_performance::text
       from team_level_aggregate_daily
      where wallet_address = $1
      order by level`,
    [wallet],
  );

  return success(ctx, {
    items: membersRows.map((m) => ({
      wallet_address_masked: maskWalletAddress(m.wallet_address),
      level: 1,
      joined_at: m.joined_at,
      cumulative_deposit: m.cumulative_deposit,
      current_tier: null,
      direct_referral_count: m.direct_count,
      status: m.status,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
    aggregates_by_level: aggRows,
  });
}

export async function handleListTeamDailyDetails(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: { page?: number; page_size?: number; from_date?: string; to_date?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    date: string;
    effective_performance: string;
    team_rate: string;
    team_raw_amount: string;
    equal_level_raw_amount: string;
    burned_amount: string;
    actual_amount: string;
    status: string;
  }>(
    `select trd.settle_date as date,
            trd.effective_performance,
            trd.user_team_rate as team_rate,
            trd.raw_total as team_raw_amount,
            coalesce((select sum(raw_amount) from equal_level_rewards_daily
                       where wallet_address = $1 and settle_date = trd.settle_date),0)::text as equal_level_raw_amount,
            trd.burned_amount,
            (trd.actual_total::numeric + coalesce((select sum(actual_amount) from equal_level_rewards_daily
                       where wallet_address = $1 and settle_date = trd.settle_date),0))::text as actual_amount,
            'settled'::text as status
       from team_rewards_daily trd
      where trd.wallet_address = $1
        and ($2::date is null or trd.settle_date >= $2)
        and ($3::date is null or trd.settle_date <= $3)
      order by trd.settle_date desc
      limit $4 offset $5`,
    [wallet, opts.from_date ?? null, opts.to_date ?? null, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from team_rewards_daily where wallet_address = $1`,
    [wallet],
  );
  return success(ctx, {
    items: rows,
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}
