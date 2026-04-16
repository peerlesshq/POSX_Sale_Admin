/**
 * Request router for the `api` edge function.
 *
 * Each entry in `ROUTES` binds one (method, path pattern) to:
 *   - an auth mode (public / user / admin)
 *   - an optional request schema (body + query merged into `input`)
 *   - a handler function
 *
 * Path patterns support `:name` parameters. The dispatcher resolves
 * the handler, applies the auth guard, parses the request, and
 * returns the handler's envelope.
 */
import {
  AuthNonceRequestSchema,
  AuthVerifyRequestSchema,
  CreatePurchaseOrderRequestSchema,
  AttachPurchaseTxRequestSchema,
  RecoverPurchaseRequestSchema,
  CreateClaimOrderRequestSchema,
  SignClaimOrderRequestSchema,
  AdminLoginRequestSchema,
  UpdateUserStatusRequestSchema,
  CreateAdminConfigRequestSchema,
  TriggerSettlementRequestSchema,
  RecomputePreviewRequestSchema,
  RecomputeApplyRequestSchema,
  CreateAdminAccountRequestSchema,
  UpdateAdminAccountRequestSchema,
} from '@posx/api-contracts/endpoints';
import {
  AdminActionGuardService,
  AppError,
  DEFAULT_AUTH_RATE_LIMITS,
  rateLimitHit,
  type RateLimitConfig,
  handleAdminDashboard,
  handleAdminGetTeamRewardDetail,
  handleAdminListBurnRecords,
  handleAdminListDirectRewards,
  handleAdminListEqualLevelRewards,
  handleAdminListTeamRewards,
  handleAdminLogin,
  handleAdminLogout,
  handleAttachPurchaseTx,
  handleAuthLogout,
  handleAuthNonce,
  handleAuthVerify,
  handleCreateAdminAccount,
  handleCreateAdminConfig,
  handleCreateClaimOrder,
  handleCreatePurchaseOrder,
  handleCreateReportExport,
  handleDownloadReportExport,
  handleGetAdminUserDetail,
  handleGetAdminUserTree,
  handleGetBurnStatus,
  handleGetChainSyncState,
  handleGetClaimOrder,
  handleGetInvite,
  handleGetPublicConfig,
  handleGetPurchaseOrder,
  handleGetReportExport,
  handleGetRewardOverview,
  handleGetSystemHealth,
  handleGetTeamOverview,
  handleGetTeamRanking,
  handleGetTeamRewardDetail,
  handleGetUserDashboard,
  handleGetUserProfile,
  handleGetVesting,
  handleListAdminAccounts,
  handleListAdminConfig,
  handleListAdminLogs,
  handleListAdminUsers,
  handleListClaimHistory,
  handleListDirectRewards,
  handleListEqualLevelRewards,
  handleListInviteReferrals,
  handleListJobRuns,
  handleListSettlementJobs,
  handleListTeamDailyDetails,
  handleListTeamMembers,
  handleListTeamRewards,
  handleRecomputeApply,
  handleRecomputePreview,
  handleRecoverPurchase,
  handleRunReportExport,
  handleSignClaimOrder,
  handleTriggerSettlement,
  handleUpdateAdminAccount,
  handleUpdateUserStatus,
  requireAdminSession,
  requireUserSession,
  toAppError,
  type HandlerContext,
  type HandlerResult,
  type ValidatedAdminSession,
  type ValidatedUserSession,
} from '@posx/backend-core';
import type { Uuid, WalletAddress } from '@posx/shared-types';

export type AuthMode = 'public' | 'user' | 'admin';

export interface RouteRequest {
  method: string;
  pathname: string;
  query: URLSearchParams;
  body: unknown;
  authorization: string | null;
}

export interface RouteMatch {
  mode: AuthMode;
  params: Record<string, string>;
  invoke(
    ctx: HandlerContext,
    session: ValidatedUserSession | ValidatedAdminSession | null,
  ): Promise<HandlerResult<unknown>>;
}

interface Route {
  method: string;
  pattern: string;
  mode: AuthMode;
  dispatch: (
    ctx: HandlerContext,
    req: RouteRequest,
    params: Record<string, string>,
    session: ValidatedUserSession | ValidatedAdminSession | null,
  ) => Promise<HandlerResult<unknown>>;
}

// -------- helpers ---------

function bearerToken(req: RouteRequest): string {
  if (!req.authorization) {
    throw new AppError('UNAUTHORIZED', 'missing Authorization header');
  }
  const match = /^Bearer\s+(.+)$/.exec(req.authorization);
  if (!match || !match[1]) {
    throw new AppError('UNAUTHORIZED', 'malformed Authorization header');
  }
  return match[1];
}

function asUser(session: ValidatedUserSession | ValidatedAdminSession | null): ValidatedUserSession {
  if (!session || !('wallet' in session)) {
    throw new AppError('UNAUTHORIZED', 'user session required');
  }
  return session;
}

function asAdmin(session: ValidatedUserSession | ValidatedAdminSession | null): ValidatedAdminSession {
  if (!session || !('admin' in session)) {
    throw new AppError('UNAUTHORIZED', 'admin session required');
  }
  return session;
}

function queryAsObject(query: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  query.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * BE-07 helper: throws `RATE_LIMITED` when the caller's per-IP
 * sliding window for `routeKey` is exhausted. Called at the top of
 * every public auth dispatch — keeping the enforcement here (instead
 * of in each handler) means adding a new rate-limited route is a
 * one-line change.
 */
function enforceRateLimit(
  routeKey: string,
  ctx: HandlerContext,
  cfg: RateLimitConfig,
): void {
  const outcome = rateLimitHit(routeKey, ctx.ipAddress ?? null, cfg);
  if (outcome.allowed) return;
  throw new AppError(
    'RATE_LIMITED',
    `too many requests for ${routeKey}; retry in ${Math.ceil(
      outcome.retryAfterMs / 1000,
    )}s`,
  );
}

// -------- the route table ---------

const ROUTES: Route[] = [
  // ---- public ----
  {
    method: 'POST',
    pattern: '/api/v1/auth/nonce',
    mode: 'public',
    dispatch: async (ctx, req) => {
      enforceRateLimit('auth-nonce', ctx, DEFAULT_AUTH_RATE_LIMITS.walletNonce);
      return handleAuthNonce(ctx, AuthNonceRequestSchema.parse(req.body ?? {}));
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/verify',
    mode: 'public',
    dispatch: async (ctx, req) => {
      enforceRateLimit(
        'auth-verify',
        ctx,
        DEFAULT_AUTH_RATE_LIMITS.walletVerify,
      );
      return handleAuthVerify(ctx, AuthVerifyRequestSchema.parse(req.body ?? {}));
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/config/public',
    mode: 'public',
    dispatch: async (ctx) => handleGetPublicConfig(ctx),
  },

  // ---- user auth logout ----
  {
    method: 'POST',
    pattern: '/api/v1/auth/logout',
    mode: 'user',
    dispatch: async (ctx, req) => handleAuthLogout(ctx, bearerToken(req)),
  },

  // ---- user profile + dashboard ----
  {
    method: 'GET',
    pattern: '/api/v1/user/profile',
    mode: 'user',
    dispatch: async (ctx, _req, _params, session) =>
      handleGetUserProfile(ctx, asUser(session).wallet),
  },
  {
    method: 'GET',
    pattern: '/api/v1/user/dashboard',
    mode: 'user',
    dispatch: async (ctx, _req, _params, session) =>
      handleGetUserDashboard(ctx, asUser(session).wallet),
  },

  // ---- purchases ----
  {
    method: 'POST',
    pattern: '/api/v1/purchases/orders',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleCreatePurchaseOrder(
        ctx,
        asUser(session).wallet,
        CreatePurchaseOrderRequestSchema.parse(req.body ?? {}),
      ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/purchases/orders/:id/tx',
    mode: 'user',
    dispatch: async (ctx, req, params, session) =>
      handleAttachPurchaseTx(
        ctx,
        asUser(session).wallet,
        params['id']! as Uuid,
        AttachPurchaseTxRequestSchema.parse(req.body ?? {}),
      ),
  },
  {
    method: 'GET',
    pattern: '/api/v1/purchases/orders/:id',
    mode: 'user',
    dispatch: async (ctx, _req, params, session) =>
      handleGetPurchaseOrder(ctx, asUser(session).wallet, params['id']! as Uuid),
  },
  {
    method: 'POST',
    pattern: '/api/v1/purchases/recover',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleRecoverPurchase(
        ctx,
        asUser(session).wallet,
        RecoverPurchaseRequestSchema.parse(req.body ?? {}),
      ),
  },

  // ---- vesting ----
  {
    method: 'GET',
    pattern: '/api/v1/vesting',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleGetVesting(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },

  // ---- rewards ----
  {
    method: 'GET',
    pattern: '/api/v1/rewards/overview',
    mode: 'user',
    dispatch: async (ctx, _req, _params, session) =>
      handleGetRewardOverview(ctx, asUser(session).wallet),
  },
  {
    method: 'GET',
    pattern: '/api/v1/rewards/direct',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListDirectRewards(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/rewards/team',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListTeamRewards(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/rewards/team/:id',
    mode: 'user',
    dispatch: async (ctx, _req, params, session) =>
      handleGetTeamRewardDetail(ctx, asUser(session).wallet, params['id']! as Uuid),
  },
  {
    method: 'GET',
    pattern: '/api/v1/rewards/equal-level',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListEqualLevelRewards(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/rewards/burn-status',
    mode: 'user',
    dispatch: async (ctx, _req, _params, session) => {
      const wallet = asUser(session).wallet as WalletAddress;
      // Config resolver comes from the context-building layer —
      // but HandlerContext doesn't expose it directly. Build an
      // inline DbConfigResolver here so burn-status never needs
      // its own special context wiring. Phase 5 can consolidate.
      const { DbConfigResolver } = await import('@posx/backend-core');
      const configResolver = new DbConfigResolver(ctx.db);
      // v1 holding value equals cumulative deposit per Phase 1
      // assumption #7.
      const depositRow = await ctx.db.queryOne<{ total: string }>(
        `select coalesce(sum(usdt_amount),0)::text as total
           from purchases where wallet_address = $1 and is_reversed = false`,
        [wallet],
      );
      return handleGetBurnStatus(ctx, wallet, configResolver, depositRow?.total ?? '0');
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/rewards/claims',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListClaimHistory(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },

  // ---- claims ----
  {
    method: 'POST',
    pattern: '/api/v1/claims',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleCreateClaimOrder(
        ctx,
        asUser(session).wallet,
        CreateClaimOrderRequestSchema.parse(req.body ?? {}),
      ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/claims/:id/sign',
    mode: 'user',
    dispatch: async (ctx, req, params, session) => {
      const body = SignClaimOrderRequestSchema.parse(req.body ?? {});
      // BE-35/36/89: read the canonical message from the row. The
      // preparation service wrote it inside the same transaction as
      // the order insert, so an order in `pending_signature` must
      // always have a non-null `signed_message`. If it's null, the
      // order is in an inconsistent state and we must refuse to
      // sign — silently falling back to `''` is what caused every
      // signature in the audit window to verify against an empty
      // message and fail.
      const row = await ctx.db.queryOne<{
        id: string;
        wallet_address: string;
        status: string;
        signed_message: string | null;
      }>(
        `select id, wallet_address, status, signed_message
           from claim_orders
          where id = $1`,
        [params['id']!],
      );
      if (!row) {
        throw new AppError('NOT_FOUND', 'claim order not found');
      }
      if (row.signed_message === null) {
        throw new AppError(
          'CONFLICT',
          'claim order is not ready for signing (no canonical message persisted)',
        );
      }
      return handleSignClaimOrder(
        ctx,
        asUser(session).wallet,
        params['id']! as Uuid,
        body,
        row.signed_message,
      );
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/claims/:id',
    mode: 'user',
    dispatch: async (ctx, _req, params, session) =>
      handleGetClaimOrder(ctx, asUser(session).wallet, params['id']! as Uuid),
  },

  // ---- team ----
  {
    method: 'GET',
    pattern: '/api/v1/team/overview',
    mode: 'user',
    dispatch: async (ctx, _req, _params, session) =>
      handleGetTeamOverview(ctx, asUser(session).wallet),
  },
  {
    method: 'GET',
    pattern: '/api/v1/team/members',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListTeamMembers(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/team/daily-details',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListTeamDailyDetails(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },

  // ---- invite ----
  {
    method: 'GET',
    pattern: '/api/v1/invite',
    mode: 'user',
    dispatch: async (ctx, _req, _params, session) =>
      handleGetInvite(ctx, asUser(session).wallet),
  },
  {
    method: 'GET',
    pattern: '/api/v1/invite/referrals',
    mode: 'user',
    dispatch: async (ctx, req, _params, session) =>
      handleListInviteReferrals(ctx, asUser(session).wallet, queryAsObject(req.query)),
  },

  // ---- admin auth ----
  {
    method: 'POST',
    pattern: '/api/v1/admin/auth/login',
    mode: 'public',
    dispatch: async (ctx, req) => {
      enforceRateLimit(
        'admin-login',
        ctx,
        DEFAULT_AUTH_RATE_LIMITS.adminLogin,
      );
      return handleAdminLogin(
        ctx,
        AdminLoginRequestSchema.parse(req.body ?? {}),
      );
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/auth/logout',
    mode: 'admin',
    dispatch: async (ctx, req) => handleAdminLogout(ctx, bearerToken(req)),
  },

  // ---- admin dashboard ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/dashboard',
    mode: 'admin',
    dispatch: async (ctx) => handleAdminDashboard(ctx),
  },

  // ---- admin users ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/users',
    mode: 'admin',
    dispatch: async (ctx, req) => handleListAdminUsers(ctx, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/users/:wallet',
    mode: 'admin',
    dispatch: async (ctx, _req, params) =>
      handleGetAdminUserDetail(ctx, params['wallet']! as WalletAddress),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/users/:wallet/tree',
    mode: 'admin',
    dispatch: async (ctx, req, params) =>
      handleGetAdminUserTree(ctx, params['wallet']! as WalletAddress, queryAsObject(req.query)),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/users/:wallet/status',
    mode: 'admin',
    dispatch: async (ctx, req, params, session) => {
      const body = UpdateUserStatusRequestSchema.parse(req.body ?? {});
      return handleUpdateUserStatus(
        ctx,
        asAdmin(session),
        params['wallet']! as WalletAddress,
        body,
        new AdminActionGuardService(),
      );
    },
  },

  // ---- admin rewards ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/rewards/direct',
    mode: 'admin',
    dispatch: async (ctx, req) => handleAdminListDirectRewards(ctx, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/rewards/team',
    mode: 'admin',
    dispatch: async (ctx, req) => handleAdminListTeamRewards(ctx, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/rewards/team/:id',
    mode: 'admin',
    dispatch: async (ctx, _req, params) =>
      handleAdminGetTeamRewardDetail(ctx, params['id']! as Uuid),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/rewards/equal-level',
    mode: 'admin',
    dispatch: async (ctx, req) =>
      handleAdminListEqualLevelRewards(ctx, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/rewards/burns',
    mode: 'admin',
    dispatch: async (ctx, req) => handleAdminListBurnRecords(ctx, queryAsObject(req.query)),
  },

  // ---- admin config ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/config',
    mode: 'admin',
    dispatch: async (ctx, req) => handleListAdminConfig(ctx, queryAsObject(req.query)),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/config',
    mode: 'admin',
    dispatch: async (ctx, req, _params, session) =>
      handleCreateAdminConfig(
        ctx,
        asAdmin(session),
        CreateAdminConfigRequestSchema.parse(req.body ?? {}),
        new AdminActionGuardService(),
      ),
  },

  // ---- admin reports ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/reports/rankings/team',
    mode: 'admin',
    dispatch: async (ctx, req) => {
      const query = queryAsObject(req.query);
      return handleGetTeamRanking(ctx, {
        limit: query['limit'] ? Number(query['limit']) : undefined,
        snapshot_date: query['snapshot_date'],
      });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/reports/export',
    mode: 'admin',
    dispatch: async (ctx, req, _params, session) => {
      const body = (req.body ?? {}) as {
        report_type?: string;
        filters?: Record<string, unknown>;
      };
      if (!body.report_type) {
        throw new AppError('INVALID_REQUEST', 'report_type is required');
      }
      return handleCreateReportExport(ctx, asAdmin(session), {
        report_type: body.report_type,
        filters: body.filters,
      });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/reports/export/:id',
    mode: 'admin',
    dispatch: async (ctx, _req, params) =>
      handleGetReportExport(ctx, params['id']! as Uuid),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/reports/export/:id/run',
    mode: 'admin',
    dispatch: async (ctx, _req, params, session) =>
      handleRunReportExport(ctx, asAdmin(session), params['id']! as Uuid),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/reports/export/:id/download',
    mode: 'admin',
    dispatch: async (ctx, _req, params) => {
      // Short-circuit — return a DownloadResponse sentinel. The
      // caller of `dispatchRoute` detects this and writes the CSV
      // body directly instead of wrapping it in the JSON envelope.
      const download = await handleDownloadReportExport(
        ctx,
        params['id']! as Uuid,
      );
      return download as unknown as HandlerResult<unknown>;
    },
  },

  // ---- admin settlement + recompute ----
  {
    method: 'POST',
    pattern: '/api/v1/admin/settlement/trigger',
    mode: 'admin',
    dispatch: async (ctx, req, _params, session) =>
      handleTriggerSettlement(
        ctx,
        asAdmin(session),
        TriggerSettlementRequestSchema.parse(req.body ?? {}),
        new AdminActionGuardService(),
      ),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/settlement/jobs',
    mode: 'admin',
    dispatch: async (ctx, req) => handleListSettlementJobs(ctx, queryAsObject(req.query)),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/recompute/preview',
    mode: 'admin',
    dispatch: async (ctx, req, _params, session) =>
      handleRecomputePreview(
        ctx,
        asAdmin(session),
        RecomputePreviewRequestSchema.parse(req.body ?? {}),
        new AdminActionGuardService(),
      ),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/recompute/apply',
    mode: 'admin',
    dispatch: async (ctx, req, _params, session) =>
      handleRecomputeApply(
        ctx,
        asAdmin(session),
        RecomputeApplyRequestSchema.parse(req.body ?? {}),
        new AdminActionGuardService(),
      ),
  },

  // ---- admin system ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/system/chain-sync',
    mode: 'admin',
    dispatch: async (ctx) => handleGetChainSyncState(ctx),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/system/jobs',
    mode: 'admin',
    dispatch: async (ctx, req) => handleListJobRuns(ctx, queryAsObject(req.query)),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/system/health',
    mode: 'admin',
    dispatch: async (ctx) => handleGetSystemHealth(ctx),
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/logs',
    mode: 'admin',
    dispatch: async (ctx, req) => handleListAdminLogs(ctx, queryAsObject(req.query)),
  },

  // ---- admin accounts ----
  {
    method: 'GET',
    pattern: '/api/v1/admin/accounts',
    mode: 'admin',
    dispatch: async (ctx, _req, _params, session) =>
      handleListAdminAccounts(ctx, asAdmin(session), new AdminActionGuardService()),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/accounts',
    mode: 'admin',
    dispatch: async (ctx, req, _params, session) =>
      handleCreateAdminAccount(
        ctx,
        asAdmin(session),
        CreateAdminAccountRequestSchema.parse(req.body ?? {}),
        new AdminActionGuardService(),
      ),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/accounts/:id',
    mode: 'admin',
    dispatch: async (ctx, req, params, session) =>
      handleUpdateAdminAccount(
        ctx,
        asAdmin(session),
        params['id']! as Uuid,
        UpdateAdminAccountRequestSchema.parse(req.body ?? {}),
        new AdminActionGuardService(),
      ),
  },
];

// -------- pattern matching ---------

function matchPattern(
  pattern: string,
  pathname: string,
): { params: Record<string, string> } | null {
  const pParts = pattern.split('/').filter(Boolean);
  const rParts = pathname.split('/').filter(Boolean);
  if (pParts.length !== rParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i += 1) {
    const p = pParts[i]!;
    const r = rParts[i]!;
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(r);
    } else if (p !== r) {
      return null;
    }
  }
  return { params };
}

export async function dispatchRoute(
  ctx: HandlerContext,
  req: RouteRequest,
): Promise<HandlerResult<unknown>> {
  try {
    for (const route of ROUTES) {
      if (route.method !== req.method) continue;
      const match = matchPattern(route.pattern, req.pathname);
      if (!match) continue;

      let session: ValidatedUserSession | ValidatedAdminSession | null = null;
      if (route.mode === 'user') {
        session = await requireUserSession(
          { sessions: ctx.services.userSessions },
          req.authorization,
        );
      } else if (route.mode === 'admin') {
        session = await requireAdminSession(
          { adminAuth: ctx.services.adminAuth },
          req.authorization,
        );
      }

      return await route.dispatch(ctx, req, match.params, session);
    }
    throw new AppError('NOT_FOUND', `route not found: ${req.method} ${req.pathname}`);
  } catch (err) {
    const appErr = toAppError(err, 'handler failed');
    return appErr.toEnvelope(ctx.requestId);
  }
}

export { ROUTES };
