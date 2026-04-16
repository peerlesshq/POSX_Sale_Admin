/**
 * Reward handlers — list + detail + burn status + claim history.
 *
 * Reads are intentionally thin SELECT + envelope transformations.
 * Any logic that touches burn eligibility goes through `BurnService`.
 */
import { BurnRewardType, type Uuid, type WalletAddress } from '@posx/shared-types';
import { ConfigGroup, normalizeBurnPolicy } from '@posx/config';
import type { ConfigResolver } from '@posx/config';

import {
  buildPaginationMeta,
  maxAmount,
  normalizePagination,
  subAmount,
} from '@posx/shared-utils';

import { AppError } from '../errors';
import { BurnService } from '../services/burn-service';
import { success, type HandlerContext, type HandlerSuccess } from './types';

interface PageOpts {
  page?: number;
  page_size?: number;
}

export async function handleGetRewardOverview(
  ctx: HandlerContext,
  wallet: WalletAddress,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const row = await ctx.db.queryOne<{
    direct_total: string;
    team_total: string;
    equal_level_total: string;
    adjustment_credit_total: string;
    claimable_total: string;
    burned_total: string;
  }>(
    `select coalesce(direct_total,'0')::text as direct_total,
            coalesce(team_total,'0')::text as team_total,
            coalesce(equal_level_total,'0')::text as equal_level_total,
            coalesce(adjustment_credit_total,'0')::text as adjustment_credit_total,
            coalesce(claimable_total,'0')::text as claimable_total,
            coalesce(burned_total,'0')::text as burned_total
       from user_reward_summary where wallet_address = $1`,
    [wallet],
  );

  return success(ctx, {
    claimable: {
      team_claimable: row?.team_total ?? '0',
      equal_level_claimable: row?.equal_level_total ?? '0',
      adjustment_credit_claimable: row?.adjustment_credit_total ?? '0',
      total_claimable: row?.claimable_total ?? '0',
    },
    totals: {
      direct_total: row?.direct_total ?? '0',
      team_total: row?.team_total ?? '0',
      equal_level_total: row?.equal_level_total ?? '0',
      burned_total: row?.burned_total ?? '0',
    },
  });
}

export async function handleListDirectRewards(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: PageOpts & { from_date?: string; to_date?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    from_wallet_address: string;
    purchase_amount: string;
    reward_rate: string | null;
    reward_amount: string;
    tx_hash: string;
    rewarded_at: string;
  }>(
    `select id, from_wallet_address, purchase_amount, reward_rate,
            reward_amount, tx_hash, rewarded_at
       from direct_rewards
      where to_wallet_address = $1
        and ($2::timestamptz is null or rewarded_at >= $2)
        and ($3::timestamptz is null or rewarded_at <= $3)
      order by rewarded_at desc
      limit $4 offset $5`,
    [wallet, opts.from_date ?? null, opts.to_date ?? null, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from direct_rewards
      where to_wallet_address = $1
        and ($2::timestamptz is null or rewarded_at >= $2)
        and ($3::timestamptz is null or rewarded_at <= $3)`,
    [wallet, opts.from_date ?? null, opts.to_date ?? null],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      direct_reward_id: r.id,
      from_wallet_address: r.from_wallet_address,
      purchase_amount: r.purchase_amount,
      reward_rate: r.reward_rate,
      reward_amount: r.reward_amount,
      tx_hash: r.tx_hash,
      rewarded_at: r.rewarded_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

export async function handleListTeamRewards(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: PageOpts & { status?: string; from_date?: string; to_date?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    settle_date: string;
    qualification_tier: string;
    user_team_rate: string;
    team_total_performance: string;
    effective_performance: string;
    raw_total: string;
    burned_amount: string;
    actual_total: string;
    status: string;
    claim_order_id: string | null;
    created_at: string;
  }>(
    `select id, settle_date, qualification_tier, user_team_rate,
            team_total_performance, effective_performance, raw_total,
            burned_amount, actual_total, status, claim_order_id, created_at
       from team_rewards_daily
      where wallet_address = $1
        and ($2::text is null or status = $2)
        and ($3::date is null or settle_date >= $3)
        and ($4::date is null or settle_date <= $4)
      order by settle_date desc, created_at desc
      limit $5 offset $6`,
    [
      wallet,
      opts.status ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
      limit,
      offset,
    ],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from team_rewards_daily
      where wallet_address = $1
        and ($2::text is null or status = $2)
        and ($3::date is null or settle_date >= $3)
        and ($4::date is null or settle_date <= $4)`,
    [wallet, opts.status ?? null, opts.from_date ?? null, opts.to_date ?? null],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      team_reward_daily_id: r.id,
      settle_date: r.settle_date,
      qualification_tier: r.qualification_tier,
      user_team_rate: r.user_team_rate,
      team_total_performance: r.team_total_performance,
      effective_performance: r.effective_performance,
      raw_total: r.raw_total,
      burned_amount: r.burned_amount,
      actual_total: r.actual_total,
      status: r.status,
      claim_order_id: r.claim_order_id,
      created_at: r.created_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

export async function handleGetTeamRewardDetail(
  ctx: HandlerContext,
  wallet: WalletAddress,
  id: Uuid,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const row = await ctx.db.queryOne<{
    id: string;
    wallet_address: string;
    settle_date: string;
    qualification_tier: string;
    user_team_rate: string;
    team_total_performance: string;
    effective_performance: string;
    raw_total: string;
    burned_amount: string;
    actual_total: string;
    status: string;
    claim_order_id: string | null;
    created_at: string;
  }>(`select * from team_rewards_daily where id = $1`, [id]);
  if (!row) throw new AppError('NOT_FOUND', 'team reward snapshot not found');
  if (row.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
    throw new AppError('FORBIDDEN', 'team reward snapshot belongs to another wallet');
  }
  const lines = await ctx.db.query<{
    line_root_wallet_address: string;
    line_effective_performance: string;
    subordinate_team_rate: string;
    differential_rate: string;
    raw_reward_amount: string;
    equal_level_replaced: boolean;
  }>(
    `select line_root_wallet_address, line_effective_performance,
            subordinate_team_rate, differential_rate, raw_reward_amount,
            equal_level_replaced
       from team_reward_line_details
      where team_reward_daily_id = $1
      order by line_root_wallet_address`,
    [id],
  );
  return success(ctx, {
    team_reward_daily_id: row.id,
    settle_date: row.settle_date,
    qualification_tier: row.qualification_tier,
    user_team_rate: row.user_team_rate,
    team_total_performance: row.team_total_performance,
    effective_performance: row.effective_performance,
    raw_total: row.raw_total,
    burned_amount: row.burned_amount,
    actual_total: row.actual_total,
    status: row.status,
    claim_order_id: row.claim_order_id,
    created_at: row.created_at,
    line_details: lines,
  });
}

export async function handleListEqualLevelRewards(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: PageOpts & { status?: string; from_date?: string; to_date?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    settle_date: string;
    line_root_wallet_address: string;
    equal_level_rate: string;
    subordinate_team_total_performance: string;
    line_effective_performance: string;
    raw_amount: string;
    burned_amount: string;
    actual_amount: string;
    status: string;
    created_at: string;
  }>(
    `select id, settle_date, line_root_wallet_address, equal_level_rate,
            subordinate_team_total_performance, line_effective_performance,
            raw_amount, burned_amount, actual_amount, status, created_at
       from equal_level_rewards_daily
      where wallet_address = $1
        and ($2::text is null or status = $2)
        and ($3::date is null or settle_date >= $3)
        and ($4::date is null or settle_date <= $4)
      order by settle_date desc, created_at desc
      limit $5 offset $6`,
    [wallet, opts.status ?? null, opts.from_date ?? null, opts.to_date ?? null, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from equal_level_rewards_daily
      where wallet_address = $1`,
    [wallet],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      equal_level_reward_id: r.id,
      settle_date: r.settle_date,
      line_root_wallet_address: r.line_root_wallet_address,
      equal_level_rate: r.equal_level_rate,
      subordinate_team_total_performance: r.subordinate_team_total_performance,
      line_effective_performance: r.line_effective_performance,
      raw_amount: r.raw_amount,
      burned_amount: r.burned_amount,
      actual_amount: r.actual_amount,
      status: r.status,
      created_at: r.created_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

/**
 * GET /rewards/burn-status — goes through BurnService so every
 * burn-related number comes from the same place as settlement.
 *
 * Phase 4.5 burn historical fix: the `usedBurnCapacityBefore`
 * returned here matches what the settlement orchestrator sees on
 * its next run for the same wallet.
 */
export async function handleGetBurnStatus(
  ctx: HandlerContext,
  wallet: WalletAddress,
  config: ConfigResolver,
  holdingValueUsdt: string,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const burnRow = await config.resolve({
    group: ConfigGroup.BurnRules,
    key: 'burn_policy',
    context: { evaluationTime: new Date().toISOString() },
  });
  if (!burnRow) {
    throw new AppError('INTERNAL_ERROR', 'burn_rules.burn_policy missing');
  }
  const policy = normalizeBurnPolicy(burnRow.config_value);
  const burn = new BurnService(ctx.db);
  const usedBefore = await burn.fetchUsedBurnCapacity(wallet);

  const probe = burn.compute({
    rewardType: BurnRewardType.Team,
    rawAmount: '0',
    holdingValueUsdt,
    usedBurnCapacityBefore: usedBefore,
    policy,
  });
  const enabled = probe.burn_enabled;

  const burnedTotalRow = await ctx.db.queryOne<{ total: string }>(
    `select coalesce(sum(burned_amount),0)::text as total
       from burn_records where wallet_address = $1`,
    [wallet],
  );

  const remaining = enabled
    ? maxAmount(subAmount(holdingValueUsdt, usedBefore), '0')
    : null;

  return success(ctx, {
    burn_enabled: enabled,
    holding_value_usdt: holdingValueUsdt,
    burn_disable_threshold: policy.burn_disable_threshold,
    burn_cap: enabled ? holdingValueUsdt : null,
    used_burn_capacity: enabled ? usedBefore : null,
    remaining_burn_capacity: remaining,
    burned_total: burnedTotalRow?.total ?? '0',
  });
}

export async function handleListClaimHistory(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: PageOpts & { status?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    claim_order_id: string;
    amount: string;
    tx_hash: string | null;
    status: string;
    recorded_at: string;
  }>(
    `select id, claim_order_id, amount, tx_hash, status, recorded_at
       from claim_records
      where wallet_address = $1
        and ($2::text is null or status = $2)
      order by recorded_at desc
      limit $3 offset $4`,
    [wallet, opts.status ?? null, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total from claim_records
      where wallet_address = $1
        and ($2::text is null or status = $2)`,
    [wallet, opts.status ?? null],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      claim_record_id: r.id,
      claim_order_id: r.claim_order_id,
      amount: r.amount,
      tx_hash: r.tx_hash,
      status: r.status,
      recorded_at: r.recorded_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

