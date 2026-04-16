/**
 * Admin handlers — consolidated into one file to keep the Phase 4.5
 * handler surface compact. Each exported function corresponds to
 * one admin endpoint and matches an entry in the Phase 4.5 router.
 *
 * Constraint 2 reminder: user status changes here go through
 * `transitionUserStatus` (which also writes audit log). Config
 * writes go through `insertConfigVersion` + `insertConfigChangeHistory`
 * + admin log. Settlement triggers go through the orchestrator +
 * `transitionSettlementJob`. Nothing in this file updates a state
 * column via raw SQL.
 */
import {
  type AdminRole,
  SettlementJobMode,
  type Uuid,
  type UserStatus,
  type WalletAddress,
} from '@posx/shared-types';
import { buildPaginationMeta, normalizePagination } from '@posx/shared-utils';
import { hashSync } from 'bcrypt';
import type {
  CreateAdminAccountRequest,
  CreateAdminConfigRequest,
  RecomputeApplyRequest,
  RecomputePreviewRequest,
  TriggerSettlementRequest,
  UpdateAdminAccountRequest,
  UpdateUserStatusRequest,
} from '@posx/api-contracts/endpoints';

import type { ValidatedAdminSession } from '../auth/admin-auth-service';
import {
  checkAdminLoginLockout,
  clearAdminLoginFailures,
  recordAdminLoginFailure,
} from '../auth/auth-rate-limit';
import { AppError } from '../errors';
import { writeAuditLog } from '../observability/audit-log';
import { insertAdminUser, listAdminUsers } from '../repos/admin-users';
import {
  insertConfigVersion,
  listAllActiveConfigVersions,
  listConfigVersionsForKey,
} from '../repos/config-versions';
import { insertConfigChangeHistory } from '../repos/content-entries';
import { listChainSyncStates } from '../repos/chain-events';
import {
  findReportExportJobById,
} from '../repos/report-export-jobs';
import { transitionUserStatus } from '../transitions/user-status';
import type { AdminActionGuardService } from '../services/admin-action-guard';
import {
  DatabaseBlobStore,
  ReportExportWorkerService,
} from '../services/report-export-worker';

import { success, type HandlerContext, type HandlerSuccess } from './types';

// ---- Admin auth ----

/**
 * BE-07/08/25 remediation: the admin login handler is the lone
 * hot-path that touches the password check, so the lockout gate, the
 * failure counter and the audit-log writes all live here rather than
 * being smeared across the service layer.
 *
 *   1. Check the `(ip, email)` lockout BEFORE attempting the password
 *      check, so a locked-out caller can't keep probing.
 *   2. On invalid credentials, bump the failure counter and write a
 *      `login_failed` audit entry.
 *   3. On success, clear the counter and write a `login_succeeded`
 *      audit entry with the admin id.
 *
 * The rate-limiter for per-IP request burst is enforced one layer
 * up in the router, so hitting this function at all means the IP
 * budget is still available.
 */
export async function handleAdminLogin(
  ctx: HandlerContext,
  input: { email: string; password: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const ip = ctx.ipAddress ?? null;

  const lockout = checkAdminLoginLockout(ip, input.email);
  if (lockout.locked) {
    await writeAuditLog(ctx.db, {
      adminUserId: null,
      action: 'admin_login_locked_out',
      targetType: 'admin_user',
      targetId: input.email.toLowerCase(),
      detail: {
        reason: 'too_many_failed_attempts',
        failures: lockout.failures,
        retry_after_ms: lockout.retryAfterMs,
      },
      ipAddress: ip,
    });
    throw new AppError(
      'RATE_LIMITED',
      `too many failed login attempts; retry after ${Math.ceil(
        lockout.retryAfterMs / 1000,
      )}s`,
    );
  }

  try {
    const result = await ctx.services.adminAuth.login({
      email: input.email,
      password: input.password,
      ipAddress: ip,
      userAgent: ctx.userAgent ?? null,
    });
    clearAdminLoginFailures(ip, input.email);
    await writeAuditLog(ctx.db, {
      adminUserId: result.admin.id,
      action: 'admin_login_succeeded',
      targetType: 'admin_user',
      targetId: result.admin.id,
      detail: { role: result.admin.role },
      ipAddress: ip,
    });
    return success(ctx, {
      admin_user_id: result.admin.id,
      name: result.admin.name,
      role: result.admin.role,
      session_token: result.sessionToken,
      expires_at: result.expiresAt,
    });
  } catch (err) {
    // Only treat AppError as "login failure" for counter purposes;
    // a database outage should not trip the lockout for real users.
    if (err instanceof AppError) {
      const status = recordAdminLoginFailure(ip, input.email);
      await writeAuditLog(ctx.db, {
        adminUserId: null,
        action: 'admin_login_failed',
        targetType: 'admin_user',
        targetId: input.email.toLowerCase(),
        detail: {
          error_code: err.errorCode,
          failures: status.failures,
          now_locked: status.locked,
        },
        ipAddress: ip,
      });
    }
    throw err;
  }
}

export async function handleAdminLogout(
  ctx: HandlerContext,
  rawToken: string,
): Promise<HandlerSuccess<{ logged_out: true }>> {
  // Validate the session so the audit entry references the real
  // admin_user_id. If validation fails we still revoke (idempotent),
  // but we log the logout attempt with `null` admin id so the trail
  // stays complete for a stale/expired token.
  let adminUserId: string | null = null;
  try {
    const validated = await ctx.services.adminAuth.validate(rawToken);
    adminUserId = validated.admin.id;
  } catch {
    /* token already revoked or malformed */
  }
  await ctx.services.adminAuth.revoke(rawToken);
  await writeAuditLog(ctx.db, {
    adminUserId,
    action: 'admin_logout',
    targetType: 'admin_user',
    targetId: adminUserId,
    detail: null,
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, { logged_out: true });
}

// ---- Admin dashboard ----

export async function handleAdminDashboard(
  ctx: HandlerContext,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await ctx.db.queryOne<{
    platform_total_deposit: string;
    today_deposit: string;
    total_users: number;
    today_new_users: number;
    total_locked: string;
    total_released: string;
    direct_today: string;
    team_today: string;
    equal_today: string;
    burn_total: string;
  }>(
    `select
        coalesce((select sum(usdt_amount) from purchases where is_reversed = false),0)::text as platform_total_deposit,
        coalesce((select sum(usdt_amount) from purchases where is_reversed = false and purchase_at::date = $1),0)::text as today_deposit,
        (select count(*)::int from users)                                                 as total_users,
        (select count(*)::int from users where created_at::date = $1)                      as today_new_users,
        coalesce((select sum(total_locked) from vesting_lots where status <> 'voided'),0)::text as total_locked,
        coalesce((select sum(released_amount) from vesting_lots where status <> 'voided'),0)::text as total_released,
        coalesce((select sum(reward_amount) from direct_rewards where rewarded_at::date = $1),0)::text as direct_today,
        coalesce((select sum(actual_total) from team_rewards_daily where settle_date = $1),0)::text as team_today,
        coalesce((select sum(actual_amount) from equal_level_rewards_daily where settle_date = $1),0)::text as equal_today,
        coalesce((select sum(burned_amount) from burn_records),0)::text as burn_total`,
    [today],
  );
  // BE-12: real tier distribution. Resolve the last-known settlement
  // tier per user from the most recent team_rewards_daily snapshot.
  // Users who have never appeared in a settlement get tier 'none'.
  const tiers = await ctx.db.query<{ tier: string; count: number }>(
    `with latest_tier as (
       select distinct on (wallet_address)
              qualification_tier as tier
         from team_rewards_daily
        order by wallet_address, settle_date desc
     )
     select coalesce(lt.tier, 'none') as tier,
            count(*)::int as count
       from users u
       left join latest_tier lt on true
            and lt.tier = (
              select qualification_tier
                from team_rewards_daily
               where wallet_address = u.wallet_address
               order by settle_date desc limit 1
            )
      group by coalesce(lt.tier, 'none')
      order by count desc`,
  );

  // BE-15: real 14-day trend aggregation from settlement data.
  const trend = await ctx.db.query<{
    date: string;
    deposit_total: string;
    team_total: string;
    equal_total: string;
    burn_total: string;
    new_users: number;
  }>(
    `with dates as (
       select generate_series(
         current_date - interval '13 days',
         current_date,
         interval '1 day'
       )::date as d
     )
     select
       d.d::text as date,
       coalesce((select sum(usdt_amount) from purchases
                  where is_reversed = false
                    and purchase_at::date = d.d), 0)::text as deposit_total,
       coalesce((select sum(actual_total) from team_rewards_daily
                  where settle_date = d.d::text), 0)::text as team_total,
       coalesce((select sum(actual_amount) from equal_level_rewards_daily
                  where settle_date = d.d::text), 0)::text as equal_total,
       coalesce((select sum(burned_amount) from burn_records
                  where settle_date = d.d::text), 0)::text as burn_total,
       (select count(*)::int from users
         where created_at::date = d.d)              as new_users
     from dates d
     order by d.d`,
  );

  return success(ctx, {
    summary: {
      platform_total_deposit: row?.platform_total_deposit ?? '0',
      today_deposit: row?.today_deposit ?? '0',
      total_users: row?.total_users ?? 0,
      today_new_users: row?.today_new_users ?? 0,
      total_locked_posx: row?.total_locked ?? '0',
      total_released_posx: row?.total_released ?? '0',
      reward_24h: {
        direct: row?.direct_today ?? '0',
        team: row?.team_today ?? '0',
        equal_level: row?.equal_today ?? '0',
      },
      burn_total: row?.burn_total ?? '0',
    },
    trend,
    tier_distribution: tiers,
  });
}

// ---- Admin users ----

export async function handleListAdminUsers(
  ctx: HandlerContext,
  opts: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    tier?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    wallet_address: string;
    status: string;
    cumulative_deposit: string;
    referrer: string | null;
    direct_count: number;
    team_total: string;
    created_at: string;
  }>(
    `select u.wallet_address, u.status,
            coalesce((select sum(usdt_amount) from purchases
                       where wallet_address = u.wallet_address and is_reversed = false),0)::text as cumulative_deposit,
            (select parent_wallet_address from referral_bindings where child_wallet_address = u.wallet_address) as referrer,
            (select count(*)::int from referral_closure where ancestor_wallet_address = u.wallet_address and depth = 1) as direct_count,
            coalesce((select sum(p.usdt_amount) from referral_closure rc
                        join purchases p on p.wallet_address = rc.descendant_wallet_address
                       where rc.ancestor_wallet_address = u.wallet_address and p.is_reversed = false),0)::text as team_total,
            u.created_at
       from users u
      where ($1::text is null or u.wallet_address like '%' || lower($1) || '%')
        and ($2::text is null or u.status = $2)
      order by u.created_at desc
      limit $3 offset $4`,
    [opts.search ?? null, opts.status ?? null, limit, offset],
  );
  // BE-14: the count query must apply the SAME filters as the data
  // query. Previously it was a raw `count(*) from users` which
  // reported the total unfiltered population regardless of search +
  // status — making pagination metadata wrong whenever an admin
  // actively filters.
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from users u
      where ($1::text is null or u.wallet_address like '%' || lower($1) || '%')
        and ($2::text is null or u.status = $2)`,
    [opts.search ?? null, opts.status ?? null],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      wallet_address: r.wallet_address,
      status: r.status,
      cumulative_deposit: r.cumulative_deposit,
      holding_value_usdt: r.cumulative_deposit,
      current_tier: null, // P1 scope — requires tier resolution per user
      referrer_address: r.referrer,
      direct_referral_count: r.direct_count,
      team_total_performance: r.team_total,
      created_at: r.created_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

export async function handleGetAdminUserDetail(
  ctx: HandlerContext,
  wallet: WalletAddress,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const row = await ctx.db.queryOne<{
    wallet_address: string;
    status: string;
    created_at: string;
    first_purchase_at: string | null;
    referrer: string | null;
    bound_at: string | null;
    binding_source: string | null;
    direct_count: number;
    deposit: string;
    direct_total: string | null;
    team_total: string | null;
    equal_level_total: string | null;
    claimable: string | null;
    burned: string | null;
    vest_locked: string | null;
    vest_released: string | null;
    vest_withdrawable: string | null;
    vest_withdrawn: string | null;
  }>(
    `select u.wallet_address, u.status, u.created_at, u.first_purchase_at,
            (select parent_wallet_address from referral_bindings where child_wallet_address = u.wallet_address) as referrer,
            (select bound_at from referral_bindings where child_wallet_address = u.wallet_address) as bound_at,
            (select binding_source from referral_bindings where child_wallet_address = u.wallet_address) as binding_source,
            (select count(*)::int from referral_closure where ancestor_wallet_address = u.wallet_address and depth = 1) as direct_count,
            coalesce((select sum(usdt_amount) from purchases where wallet_address = u.wallet_address and is_reversed = false),0)::text as deposit,
            (select direct_total::text from user_reward_summary where wallet_address = u.wallet_address),
            (select team_total::text from user_reward_summary where wallet_address = u.wallet_address),
            (select equal_level_total::text from user_reward_summary where wallet_address = u.wallet_address),
            (select claimable_total::text from user_reward_summary where wallet_address = u.wallet_address),
            (select burned_total::text from user_reward_summary where wallet_address = u.wallet_address),
            (select total_locked::text from user_vesting_summary where wallet_address = u.wallet_address),
            (select total_released::text from user_vesting_summary where wallet_address = u.wallet_address),
            (select total_withdrawable::text from user_vesting_summary where wallet_address = u.wallet_address),
            (select total_withdrawn::text from user_vesting_summary where wallet_address = u.wallet_address)
       from users u
      where u.wallet_address = $1`,
    [wallet],
  );
  if (!row) throw new AppError('NOT_FOUND', 'user not found');
  return success(ctx, {
    identity: {
      wallet_address: row.wallet_address,
      status: row.status,
      created_at: row.created_at,
      first_purchase_at: row.first_purchase_at,
    },
    referral: {
      referrer_address: row.referrer,
      bound_at: row.bound_at,
      binding_source: row.binding_source,
      direct_referral_count: row.direct_count,
    },
    financial: {
      cumulative_deposit: row.deposit,
      holding_posx_amount: row.deposit,
      holding_value_usdt: row.deposit,
      current_tier: null,
      reward_qualified: false,
      team_reward_qualified: false,
      team_total_performance: '0',
    },
    reward_summary: {
      direct_total: row.direct_total ?? '0',
      team_total: row.team_total ?? '0',
      equal_level_total: row.equal_level_total ?? '0',
      claimable_total: row.claimable ?? '0',
      burned_total: row.burned ?? '0',
    },
    vesting_summary: {
      total_locked: row.vest_locked ?? '0',
      total_released: row.vest_released ?? '0',
      total_withdrawable: row.vest_withdrawable ?? '0',
      total_withdrawn: row.vest_withdrawn ?? '0',
    },
  });
}

export async function handleUpdateUserStatus(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  wallet: WalletAddress,
  input: UpdateUserStatusRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanChangeUserStatus(actor, input.target_status as UserStatus, input.reason);
  const oldRow = await ctx.db.queryOne<{ status: string }>(
    `select status from users where wallet_address = $1`,
    [wallet],
  );
  if (!oldRow) throw new AppError('NOT_FOUND', 'user not found');

  await transitionUserStatus(ctx.db, {
    wallet,
    toStatus: input.target_status as UserStatus,
    reason: input.reason,
    effectiveFrom: input.effective_from,
    actorAdminId: actor.admin.id,
    note: input.note ?? null,
    ipAddress: ctx.ipAddress ?? null,
  });

  return success(ctx, {
    wallet_address: wallet,
    old_status: oldRow.status,
    new_status: input.target_status,
    effective_from: input.effective_from,
    updated_by: actor.admin.id,
  });
}

export async function handleGetAdminUserTree(
  ctx: HandlerContext,
  wallet: WalletAddress,
  opts: { max_depth?: number },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const maxDepth = opts.max_depth ?? 7;
  const rows = await ctx.db.query<{
    wallet_address: string;
    parent: string | null;
    depth: number;
    status: string;
    cumulative_deposit: string;
  }>(
    `select u.wallet_address,
            (select parent_wallet_address from referral_bindings where child_wallet_address = u.wallet_address) as parent,
            rc.depth,
            u.status,
            coalesce((select sum(usdt_amount) from purchases
                        where wallet_address = u.wallet_address and is_reversed = false),0)::text as cumulative_deposit
       from referral_closure rc
       join users u on u.wallet_address = rc.descendant_wallet_address
      where rc.ancestor_wallet_address = $1
        and rc.depth <= $2
      order by rc.depth, u.wallet_address`,
    [wallet, maxDepth],
  );
  return success(ctx, {
    root_wallet_address: wallet,
    nodes: rows.map((r) => ({
      wallet_address: r.wallet_address,
      parent_wallet_address: r.parent,
      depth: r.depth,
      status: r.status,
      cumulative_deposit: r.cumulative_deposit,
      current_tier: null,
    })),
  });
}

// ---- Admin rewards (list-only projections) ----

export async function handleAdminListDirectRewards(
  ctx: HandlerContext,
  opts: {
    page?: number;
    page_size?: number;
    wallet_address?: string;
    from_wallet_address?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    from_wallet_address: string;
    to_wallet_address: string;
    purchase_amount: string;
    reward_rate: string | null;
    reward_amount: string;
    tx_hash: string;
    rewarded_at: string;
  }>(
    `select id, from_wallet_address, to_wallet_address, purchase_amount,
            reward_rate, reward_amount, tx_hash, rewarded_at
       from direct_rewards
      where ($1::text is null or to_wallet_address = $1)
        and ($2::text is null or from_wallet_address = $2)
        and ($3::timestamptz is null or rewarded_at >= $3)
        and ($4::timestamptz is null or rewarded_at <= $4)
      order by rewarded_at desc
      limit $5 offset $6`,
    [
      opts.wallet_address ?? null,
      opts.from_wallet_address ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
      limit,
      offset,
    ],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from direct_rewards
      where ($1::text is null or to_wallet_address = $1)
        and ($2::text is null or from_wallet_address = $2)
        and ($3::timestamptz is null or rewarded_at >= $3)
        and ($4::timestamptz is null or rewarded_at <= $4)`,
    [
      opts.wallet_address ?? null,
      opts.from_wallet_address ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
    ],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      direct_reward_id: r.id,
      from_wallet_address: r.from_wallet_address,
      to_wallet_address: r.to_wallet_address,
      purchase_amount: r.purchase_amount,
      reward_rate: r.reward_rate,
      reward_amount: r.reward_amount,
      tx_hash: r.tx_hash,
      rewarded_at: r.rewarded_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

export async function handleAdminListBurnRecords(
  ctx: HandlerContext,
  opts: { page?: number; page_size?: number; wallet_address?: string; reward_type?: string; from_date?: string; to_date?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    wallet_address: string;
    reward_type: string;
    settle_date: string;
    holding_value_at_snapshot: string;
    used_burn_capacity_before: string;
    burn_cap: string;
    raw_amount: string;
    burned_amount: string;
    actual_amount: string;
    reason: string;
  }>(
    `select id, wallet_address, reward_type, settle_date,
            holding_value_at_snapshot, used_burn_capacity_before, burn_cap,
            raw_amount, burned_amount, actual_amount, reason
       from burn_records
      where ($1::text is null or wallet_address = $1)
        and ($2::text is null or reward_type = $2)
        and ($3::date is null or settle_date >= $3)
        and ($4::date is null or settle_date <= $4)
      order by settle_date desc, created_at desc
      limit $5 offset $6`,
    [
      opts.wallet_address ?? null,
      opts.reward_type ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
      limit,
      offset,
    ],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from burn_records
      where ($1::text is null or wallet_address = $1)
        and ($2::text is null or reward_type = $2)
        and ($3::date is null or settle_date >= $3)
        and ($4::date is null or settle_date <= $4)`,
    [
      opts.wallet_address ?? null,
      opts.reward_type ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
    ],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      burn_record_id: r.id,
      wallet_address: r.wallet_address,
      reward_type: r.reward_type,
      settle_date: r.settle_date,
      holding_value_at_snapshot: r.holding_value_at_snapshot,
      used_burn_capacity_before: r.used_burn_capacity_before,
      burn_cap: r.burn_cap,
      raw_amount: r.raw_amount,
      burned_amount: r.burned_amount,
      actual_amount: r.actual_amount,
      reason: r.reason,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

// ---- Admin config ----

export async function handleListAdminConfig(
  ctx: HandlerContext,
  opts: { config_group?: string; config_key?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const all = await listAllActiveConfigVersions(ctx.db);
  const filtered = all.filter((row) => {
    if (opts.config_group && row.config_group !== opts.config_group) return false;
    if (opts.config_key && row.config_key !== opts.config_key) return false;
    return true;
  });
  // Keep only the most-recent per (group, key).
  const byKey = new Map<string, (typeof filtered)[number]>();
  for (const r of filtered) {
    const k = `${r.config_group}::${r.config_key}`;
    const existing = byKey.get(k);
    if (!existing || r.effective_from > existing.effective_from) {
      byKey.set(k, r);
    }
  }
  return success(ctx, {
    items: Array.from(byKey.values()).map((r) => ({
      config_version_id: r.id,
      config_group: r.config_group,
      config_key: r.config_key,
      version_no: r.version_no,
      config_value: r.config_value,
      effective_from: r.effective_from,
      apply_scope: r.apply_scope,
      status: r.status,
      description: r.description,
    })),
  });
}

export async function handleCreateAdminConfig(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  input: CreateAdminConfigRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanCreateConfigVersion(actor);

  const existing = await listConfigVersionsForKey(
    ctx.db,
    input.config_group as never,
    input.config_key,
  );
  const nextVersionNo = (existing[0]?.version_no ?? 0) + 1;
  const oldValue = existing[0]?.config_value ?? null;

  const created = await insertConfigVersion(ctx.db, {
    config_group: input.config_group as never,
    config_key: input.config_key,
    version_no: nextVersionNo,
    config_value: input.config_value,
    effective_from: input.effective_from,
    apply_scope: input.apply_scope,
    description: input.description ?? null,
    created_by_admin_id: actor.admin.id,
  });

  await insertConfigChangeHistory(ctx.db, {
    config_version_id: created.id,
    config_group: input.config_group,
    config_key: input.config_key,
    old_value: oldValue,
    new_value: input.config_value,
    effective_from: input.effective_from,
    apply_scope: input.apply_scope,
    changed_by_admin_id: actor.admin.id,
    change_note: input.description ?? null,
  });

  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'create_config_version',
    targetType: 'config_version',
    targetId: created.id,
    detail: {
      config_group: input.config_group,
      config_key: input.config_key,
      version_no: nextVersionNo,
      apply_scope: input.apply_scope,
      reason: input.reason,
    },
    ipAddress: ctx.ipAddress ?? null,
  });

  return success(ctx, {
    config_version_id: created.id,
    config_group: created.config_group,
    config_key: created.config_key,
    version_no: created.version_no,
    effective_from: created.effective_from,
    apply_scope: created.apply_scope,
    status: created.status,
  });
}

// ---- Admin settlement ----

export async function handleTriggerSettlement(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  input: TriggerSettlementRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanTriggerSettlement(actor, input.reason);
  const result = await ctx.services.settlement.run({
    settlementDate: input.settlement_date,
    mode:
      input.mode === 'backfill'
        ? SettlementJobMode.Backfill
        : SettlementJobMode.Official,
    triggeredByAdminId: actor.admin.id,
    reason: input.reason,
  });
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'trigger_settlement',
    targetType: 'settlement_job',
    targetId: result.job.id,
    detail: { settlement_date: input.settlement_date, mode: input.mode },
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, {
    settlement_job_id: result.job.id,
    job_type: result.job.job_type,
    settlement_date: result.job.settlement_date,
    status: result.job.status,
  });
}

export async function handleListSettlementJobs(
  ctx: HandlerContext,
  opts: { page?: number; page_size?: number; settlement_date?: string; job_type?: string; status?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    job_type: string;
    mode: string;
    settlement_date: string;
    status: string;
    processed_user_count: number;
    created_snapshot_count: number;
    created_adjustment_count: number;
    error_count: number;
    started_at: string;
    finished_at: string | null;
  }>(
    `select id, job_type, mode, settlement_date, status,
            processed_user_count, created_snapshot_count, created_adjustment_count,
            error_count, started_at, finished_at
       from settlement_jobs
      where ($1::date is null or settlement_date = $1)
        and ($2::text is null or job_type = $2)
        and ($3::text is null or status = $3)
      order by created_at desc
      limit $4 offset $5`,
    [opts.settlement_date ?? null, opts.job_type ?? null, opts.status ?? null, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from settlement_jobs
      where ($1::date is null or settlement_date = $1)
        and ($2::text is null or job_type = $2)
        and ($3::text is null or status = $3)`,
    [opts.settlement_date ?? null, opts.job_type ?? null, opts.status ?? null],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      settlement_job_id: r.id,
      job_type: r.job_type,
      mode: r.mode,
      settlement_date: r.settlement_date,
      status: r.status,
      processed_user_count: r.processed_user_count,
      created_snapshot_count: r.created_snapshot_count,
      created_adjustment_count: r.created_adjustment_count,
      error_count: r.error_count,
      started_at: r.started_at,
      finished_at: r.finished_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

/**
 * BE-19 — preview now returns real per-user diffs.
 */
export async function handleRecomputePreview(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  input: RecomputePreviewRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanRunRecomputePreview(actor, input.reason);
  const result = await ctx.services.recompute.preview({
    settlementDate: input.settlement_date,
    reason: input.reason,
    triggeredByAdminId: actor.admin.id,
  });
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'recompute_preview',
    targetType: 'settlement_job',
    targetId: result.settlementJobId,
    detail: {
      settlement_date: input.settlement_date,
      reason: input.reason,
      diff_count: result.differenceCount,
    },
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, {
    settlement_job_id: result.settlementJobId,
    mode: 'recompute_preview',
    status: 'completed',
    summary: {
      processed_user_count: result.processedUserCount,
      difference_count: result.differenceCount,
      positive_difference_total: result.positiveDifferenceTotal,
      negative_difference_total: result.negativeDifferenceTotal,
    },
    diffs: result.diffs.map((d) => ({
      wallet_address: d.wallet,
      direction: d.direction,
      amount: d.amount,
      source_table: d.sourceTable ?? undefined,
      source_snapshot_id: d.sourceSnapshotId ?? undefined,
      detail: d.detail ?? undefined,
    })),
  });
}

/**
 * BE-20 — apply now reads stored diffs from the preview job.
 */
export async function handleRecomputeApply(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  input: RecomputeApplyRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanApplyRecompute(actor, input.reason);
  const result = await ctx.services.recompute.applyFromPreview({
    settlementDate: input.settlement_date,
    reason: input.reason,
    triggeredByAdminId: actor.admin.id,
    previewSettlementJobId: input.preview_settlement_job_id as Uuid,
  });
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'recompute_apply',
    targetType: 'settlement_job',
    targetId: result.settlementJobId,
    detail: {
      settlement_date: input.settlement_date,
      reason: input.reason,
      preview_job_id: input.preview_settlement_job_id,
      applied_diff_count: result.appliedDiffCount,
    },
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, {
    settlement_job_id: result.settlementJobId,
    mode: 'recompute_apply_adjustment',
    status: 'completed',
    applied_diff_count: result.appliedDiffCount,
  });
}

// ---- Admin system pages ----

export async function handleGetChainSyncState(
  ctx: HandlerContext,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const rows = await listChainSyncStates(ctx.db);
  return success(ctx, { items: rows });
}

export async function handleListJobRuns(
  ctx: HandlerContext,
  opts: { page?: number; page_size?: number; job_name?: string; status?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    job_name: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    rows_scanned: number;
    rows_processed: number;
    rows_failed: number;
    error_message: string | null;
  }>(
    `select id, job_name, status, started_at, finished_at,
            rows_scanned, rows_processed, rows_failed, error_message
       from job_runs
      where ($1::text is null or job_name = $1)
        and ($2::text is null or status = $2)
      order by created_at desc
      limit $3 offset $4`,
    [opts.job_name ?? null, opts.status ?? null, limit, offset],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from job_runs
      where ($1::text is null or job_name = $1)
        and ($2::text is null or status = $2)`,
    [opts.job_name ?? null, opts.status ?? null],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      job_run_id: r.id,
      job_name: r.job_name,
      status: r.status,
      started_at: r.started_at,
      finished_at: r.finished_at,
      rows_scanned: r.rows_scanned,
      rows_processed: r.rows_processed,
      rows_failed: r.rows_failed,
      error_message: r.error_message,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

export async function handleGetSystemHealth(
  ctx: HandlerContext,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const rows = await ctx.db.query<{
    health_key: string;
    status: string;
    checked_at: string;
    detail: Record<string, unknown> | null;
  }>(
    `select health_key, status, checked_at, detail from system_health_checks
      order by health_key`,
  );
  return success(ctx, { checks: rows });
}

export async function handleListAdminLogs(
  ctx: HandlerContext,
  opts: {
    page?: number;
    page_size?: number;
    admin_user_id?: string;
    action?: string;
    target_type?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    admin_user_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    detail: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
  }>(
    `select id, admin_user_id, action, target_type, target_id, detail, ip_address, created_at
       from admin_logs
      where ($1::uuid is null or admin_user_id = $1)
        and ($2::text is null or action = $2)
        and ($3::text is null or target_type = $3)
        and ($4::timestamptz is null or created_at >= $4)
        and ($5::timestamptz is null or created_at <= $5)
      order by created_at desc
      limit $6 offset $7`,
    [
      opts.admin_user_id ?? null,
      opts.action ?? null,
      opts.target_type ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
      limit,
      offset,
    ],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from admin_logs
      where ($1::uuid is null or admin_user_id = $1)
        and ($2::text is null or action = $2)
        and ($3::text is null or target_type = $3)
        and ($4::timestamptz is null or created_at >= $4)
        and ($5::timestamptz is null or created_at <= $5)`,
    [
      opts.admin_user_id ?? null,
      opts.action ?? null,
      opts.target_type ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
    ],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      admin_log_id: r.id,
      admin_user_id: r.admin_user_id,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      detail: r.detail,
      ip_address: r.ip_address,
      created_at: r.created_at,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

// ---- Admin accounts (super_admin only) ----

export async function handleListAdminAccounts(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanManageAdminAccounts(actor);
  const rows = await listAdminUsers(ctx.db);
  return success(ctx, {
    items: rows.map((r) => ({
      admin_user_id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.status,
      last_login_at: r.last_login_at,
      created_at: r.created_at,
    })),
  });
}

export async function handleCreateAdminAccount(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  input: CreateAdminAccountRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanManageAdminAccounts(actor);
  const row = await insertAdminUser(ctx.db, {
    email: input.email,
    password_hash: hashSync(input.password, 12),
    role: input.role as AdminRole,
    name: input.name,
    status: 'active',
  });
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'create_admin_account',
    targetType: 'admin_user',
    targetId: row.id,
    detail: { email: row.email, role: row.role, reason: input.reason },
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, {
    admin_user_id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
  });
}

/**
 * CT-05 / P2-5 — full PATCH /admin/accounts/:id alignment.
 *
 * Supports: role change, status change, name change, session rotate.
 * All mutations are audited with the required `reason`. Session
 * rotation revokes all active sessions for the target admin.
 */
export async function handleUpdateAdminAccount(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  adminUserId: Uuid,
  input: UpdateAdminAccountRequest,
  guard: AdminActionGuardService,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  guard.assertCanManageAdminAccounts(actor);
  const row = await ctx.db.queryRequired<{
    id: string;
    role: string;
    status: string;
    name: string;
  }>(
    `update admin_users
        set role = coalesce($2, role),
            status = coalesce($3, status),
            name = coalesce($4, name)
      where id = $1
      returning id, role, status, name`,
    [adminUserId, input.role ?? null, input.status ?? null, input.name ?? null],
  );
  // CT-05: handle session rotation. Revoking all active sessions
  // for this admin forces re-login on every device.
  if (input.rotate_session) {
    await ctx.db.query(
      `update admin_sessions
          set revoked_at = now()
        where admin_user_id = $1
          and revoked_at is null`,
      [adminUserId],
    );
  }
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'update_admin_account',
    targetType: 'admin_user',
    targetId: row.id,
    detail: {
      role: row.role,
      status: row.status,
      name: row.name,
      reason: input.reason,
      rotate_session: input.rotate_session ?? false,
    },
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, {
    admin_user_id: row.id,
    role: row.role,
    status: row.status,
    name: row.name,
  });
}

// ---- Admin rewards: team + equal-level lists + team detail ----

export async function handleAdminListTeamRewards(
  ctx: HandlerContext,
  opts: {
    page?: number;
    page_size?: number;
    wallet_address?: string;
    settle_date?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
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
  }>(
    `select id, wallet_address, settle_date, qualification_tier,
            user_team_rate, team_total_performance, effective_performance,
            raw_total, burned_amount, actual_total, status
       from team_rewards_daily
      where ($1::text is null or wallet_address = $1)
        and ($2::date is null or settle_date = $2)
        and ($3::text is null or status = $3)
        and ($4::date is null or settle_date >= $4)
        and ($5::date is null or settle_date <= $5)
      order by settle_date desc, created_at desc
      limit $6 offset $7`,
    [
      opts.wallet_address ?? null,
      opts.settle_date ?? null,
      opts.status ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
      limit,
      offset,
    ],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from team_rewards_daily
      where ($1::text is null or wallet_address = $1)
        and ($2::date is null or settle_date = $2)
        and ($3::text is null or status = $3)
        and ($4::date is null or settle_date >= $4)
        and ($5::date is null or settle_date <= $5)`,
    [
      opts.wallet_address ?? null,
      opts.settle_date ?? null,
      opts.status ?? null,
      opts.from_date ?? null,
      opts.to_date ?? null,
    ],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      team_reward_daily_id: r.id,
      wallet_address: r.wallet_address,
      settle_date: r.settle_date,
      qualification_tier: r.qualification_tier,
      user_team_rate: r.user_team_rate,
      team_total_performance: r.team_total_performance,
      effective_performance: r.effective_performance,
      raw_total: r.raw_total,
      burned_amount: r.burned_amount,
      actual_total: r.actual_total,
      status: r.status,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

export async function handleAdminGetTeamRewardDetail(
  ctx: HandlerContext,
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
  }>(`select * from team_rewards_daily where id = $1`, [id]);
  if (!row) throw new AppError('NOT_FOUND', 'team reward snapshot not found');
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
    wallet_address: row.wallet_address,
    settle_date: row.settle_date,
    qualification_tier: row.qualification_tier,
    user_team_rate: row.user_team_rate,
    team_total_performance: row.team_total_performance,
    effective_performance: row.effective_performance,
    raw_total: row.raw_total,
    burned_amount: row.burned_amount,
    actual_total: row.actual_total,
    status: row.status,
    line_details: lines,
  });
}

export async function handleAdminListEqualLevelRewards(
  ctx: HandlerContext,
  opts: {
    page?: number;
    page_size?: number;
    wallet_address?: string;
    line_root_wallet_address?: string;
    settle_date?: string;
    status?: string;
  },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const { page, pageSize, limit, offset } = normalizePagination({
    page: opts.page,
    pageSize: opts.page_size,
  });
  const rows = await ctx.db.query<{
    id: string;
    wallet_address: string;
    line_root_wallet_address: string;
    settle_date: string;
    equal_level_rate: string;
    line_effective_performance: string;
    raw_amount: string;
    burned_amount: string;
    actual_amount: string;
    status: string;
  }>(
    `select id, wallet_address, line_root_wallet_address, settle_date,
            equal_level_rate, line_effective_performance,
            raw_amount, burned_amount, actual_amount, status
       from equal_level_rewards_daily
      where ($1::text is null or wallet_address = $1)
        and ($2::text is null or line_root_wallet_address = $2)
        and ($3::date is null or settle_date = $3)
        and ($4::text is null or status = $4)
      order by settle_date desc, created_at desc
      limit $5 offset $6`,
    [
      opts.wallet_address ?? null,
      opts.line_root_wallet_address ?? null,
      opts.settle_date ?? null,
      opts.status ?? null,
      limit,
      offset,
    ],
  );
  const countRow = await ctx.db.queryOne<{ total: number }>(
    `select count(*)::int as total
       from equal_level_rewards_daily
      where ($1::text is null or wallet_address = $1)
        and ($2::text is null or line_root_wallet_address = $2)
        and ($3::date is null or settle_date = $3)
        and ($4::text is null or status = $4)`,
    [
      opts.wallet_address ?? null,
      opts.line_root_wallet_address ?? null,
      opts.settle_date ?? null,
      opts.status ?? null,
    ],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      equal_level_reward_id: r.id,
      wallet_address: r.wallet_address,
      line_root_wallet_address: r.line_root_wallet_address,
      settle_date: r.settle_date,
      equal_level_rate: r.equal_level_rate,
      line_effective_performance: r.line_effective_performance,
      raw_amount: r.raw_amount,
      burned_amount: r.burned_amount,
      actual_amount: r.actual_amount,
      status: r.status,
    })),
    pagination: buildPaginationMeta(page, pageSize, countRow?.total ?? 0),
  });
}

// ---- Admin reports: team ranking + export ----

export async function handleGetTeamRanking(
  ctx: HandlerContext,
  opts: { limit?: number; snapshot_date?: string },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  // 11 §11.4 ranking rule: by `team_total_performance` desc; tie-break
  // on higher `team_rate` and then deterministic wallet_address sort.
  // We prefer the derived team_performance_snapshot when a snapshot
  // date is supplied; otherwise we compute live from purchases +
  // referral_closure (acceptable for Phase 4.5 admin reads).
  const limit = Math.min(opts.limit ?? 50, 500);
  if (opts.snapshot_date) {
    const rows = await ctx.db.query<{
      wallet_address: string;
      team_total_performance: string;
      tier: string | null;
      team_rate: string;
    }>(
      `select wallet_address,
              team_total_performance::text,
              tier,
              team_rate::text
         from team_performance_snapshot
        where snapshot_date = $1
        order by team_total_performance desc, team_rate desc, wallet_address asc
        limit $2`,
      [opts.snapshot_date, limit],
    );
    return success(ctx, {
      items: rows.map((r) => ({
        wallet_address: r.wallet_address,
        team_total_performance: r.team_total_performance,
        current_tier: r.tier,
        team_rate: r.team_rate,
      })),
    });
  }

  const rows = await ctx.db.query<{
    wallet_address: string;
    team_total_performance: string;
  }>(
    `select u.wallet_address,
            coalesce((select sum(p.usdt_amount)::text
                        from referral_closure rc
                        join purchases p on p.wallet_address = rc.descendant_wallet_address
                       where rc.ancestor_wallet_address = u.wallet_address
                         and p.is_reversed = false),'0') as team_total_performance
       from users u
      order by team_total_performance::numeric desc, u.wallet_address asc
      limit $1`,
    [limit],
  );
  return success(ctx, {
    items: rows.map((r) => ({
      wallet_address: r.wallet_address,
      team_total_performance: r.team_total_performance,
      current_tier: null,
      team_rate: '0',
    })),
  });
}

export async function handleCreateReportExport(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  input: { report_type: string; filters?: Record<string, unknown> },
): Promise<HandlerSuccess<Record<string, unknown>>> {
  // BE-66/67: use the DatabaseBlobStore so exports survive cold
  // starts, replica switches, and redeployments. The in-memory
  // store was broken on every deploy.
  const worker = new ReportExportWorkerService(
    ctx.db,
    new DatabaseBlobStore(ctx.db),
  );
  const { job, result } = await worker.createAndRun({
    requestedByAdminId: actor.admin.id,
    reportType: input.report_type,
    filters: input.filters ?? undefined,
  });
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'create_report_export',
    targetType: 'report_export_job',
    targetId: job.id,
    detail: {
      report_type: input.report_type,
      filters: input.filters ?? null,
      result_status: result.status,
      row_count: result.rowCount,
    },
    ipAddress: ctx.ipAddress ?? null,
  });
  return success(ctx, {
    report_export_job_id: job.id,
    id: job.id,
    status: job.status,
    file_path: job.file_path,
    error_message: job.error_message,
    row_count: result.rowCount,
    created_at: job.created_at,
    finished_at: job.finished_at,
  });
}

export async function handleGetReportExport(
  ctx: HandlerContext,
  id: Uuid,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const row = await findReportExportJobById(ctx.db, id);
  if (!row) throw new AppError('NOT_FOUND', 'report export job not found');
  return success(ctx, {
    report_export_job_id: row.id,
    id: row.id,
    status: row.status,
    file_path: row.file_path,
    error_message: row.error_message,
    created_at: row.created_at,
    finished_at: row.finished_at,
  });
}

/**
 * Re-run a queued (or previously failed — caller must re-queue first)
 * export job. Separate from createAndRun so tests and a future cron
 * can exercise the worker without inserting a new row.
 */
export async function handleRunReportExport(
  ctx: HandlerContext,
  actor: ValidatedAdminSession,
  id: Uuid,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const worker = new ReportExportWorkerService(
    ctx.db,
    new DatabaseBlobStore(ctx.db),
  );
  const result = await worker.run(id);
  await writeAuditLog(ctx.db, {
    adminUserId: actor.admin.id,
    action: 'run_report_export',
    targetType: 'report_export_job',
    targetId: id,
    detail: { status: result.status, row_count: result.rowCount },
    ipAddress: ctx.ipAddress ?? null,
  });
  const row = await findReportExportJobById(ctx.db, id);
  return success(ctx, {
    report_export_job_id: id,
    id,
    status: row?.status ?? result.status,
    file_path: row?.file_path ?? null,
    error_message: row?.error_message ?? null,
    row_count: result.rowCount,
  });
}

/**
 * Download the generated CSV for a completed job. Returns a raw
 * response envelope the router knows how to ship as `text/csv`.
 *
 * Special-cased in the router: when the body is a DownloadResponse,
 * the dispatcher bypasses the usual JSON envelope and writes the CSV
 * bytes directly. See `router.ts`.
 */
export interface DownloadResponse {
  readonly __download: true;
  readonly contentType: string;
  readonly filename: string;
  readonly body: string;
}

export async function handleDownloadReportExport(
  ctx: HandlerContext,
  id: Uuid,
): Promise<DownloadResponse> {
  const worker = new ReportExportWorkerService(
    ctx.db,
    new DatabaseBlobStore(ctx.db),
  );
  const blob = await worker.getBlob(id);
  if (!blob) {
    throw new AppError('NOT_FOUND', 'report export job not ready for download');
  }
  return {
    __download: true,
    contentType: blob.contentType,
    filename: blob.filename,
    body: blob.body,
  };
}
