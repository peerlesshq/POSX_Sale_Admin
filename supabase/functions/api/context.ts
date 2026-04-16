/**
 * Builds a `HandlerContext` from the DB + env for every request.
 *
 * Instantiates services at module scope where that is safe
 * (stateless services), and per-request where state (like the
 * broadcaster staging queue) is tied to request lifecycle.
 */
import { loadServerEnv } from '@posx/config';
import {
  AdminAuthService,
  ClaimFinalizationService,
  ClaimPreparationService,
  ClaimSigningService,
  DbConfigResolver,
  MockClaimBroadcaster,
  NonceService,
  PostgresJsClient,
  ProductionGateClaimBroadcaster,
  PurchaseFactService,
  PurchaseOrderService,
  PurchaseRecoveryService,
  RecomputeService,
  ReferralBindingService,
  SettlementOrchestrator,
  StagingClaimBroadcaster,
  TeamAggregateService,
  UserAccessPolicyService,
  UserSessionService,
  VestingDerivedHoldingService,
  WalletVerifyService,
  createLogger,
  generateRequestId,
  AdjustmentService,
  BurnService,
  type ClaimBroadcastAdapter,
  type Logger,
  type HandlerContext,
  type HandlerServices,
} from '@posx/backend-core';

let cachedClient: PostgresJsClient | null = null;
let envValidated = false;

function getDbClient(): PostgresJsClient {
  if (cachedClient) return cachedClient;
  const env = loadServerEnv(
    (typeof process !== 'undefined' && process.env ? process.env : {}) as Record<
      string,
      string | undefined
    >,
  );
  cachedClient = new PostgresJsClient({ connectionString: env.SUPABASE_DB_URL });
  return cachedClient;
}

function pickBroadcaster(appEnv: 'local' | 'staging' | 'production'): ClaimBroadcastAdapter {
  if (appEnv === 'local') {
    return new MockClaimBroadcaster({ appEnv });
  }
  if (appEnv === 'staging') {
    // Staging exercises the `queued → broadcasted → confirmed` ladder
    // with a simulated tx hash so the UX paths can be smoke-tested
    // end-to-end without touching the chain.
    return new StagingClaimBroadcaster();
  }
  // BE-56/58 safety gate: production MUST NOT use the staging or
  // mock broadcaster. Both produce deterministic SHA-256 fake tx
  // hashes that look real but move zero tokens. Until a genuine
  // on-chain adapter is wired, the gate broadcaster refuses every
  // submit with a clear error code so no user is ever handed a fake
  // confirmation. A real `ProductionClaimBroadcaster` replaces this
  // line when the RPC wiring + finalization cron land.
  return new ProductionGateClaimBroadcaster();
}

export interface BuildContextInput {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export function buildHandlerContext(input: BuildContextInput): HandlerContext {
  if (!envValidated) {
    const bootEnv = loadServerEnv(
      (typeof process !== 'undefined' && process.env ? process.env : {}) as Record<
        string,
        string | undefined
      >,
    );
    console.info(`[POSX] Environment: ${bootEnv.APP_ENV}`);
    console.info(`[POSX] Supabase URL: ${bootEnv.SUPABASE_URL}`);
    console.info(`[POSX] Claim broadcaster: ${pickBroadcaster(bootEnv.APP_ENV).name}`);
    if (bootEnv.APP_ENV === 'production') {
      console.info('[POSX] Production mode — all safety gates active');
    }
    envValidated = true;
  }

  const env = loadServerEnv(
    (typeof process !== 'undefined' && process.env ? process.env : {}) as Record<
      string,
      string | undefined
    >,
  );
  const db = getDbClient();
  const requestId = generateRequestId();
  const logger: Logger = createLogger({
    level: env.LOG_LEVEL,
    bindings: { request_id: requestId },
  });

  const configResolver = new DbConfigResolver(db);
  const holdingService = new VestingDerivedHoldingService(
    db,
    async () => {
      const row = await configResolver.resolve({
        group: 'pricing' as never,
        key: 'token_price',
        context: { evaluationTime: new Date().toISOString() },
      });
      const value = row?.config_value as { token_price?: string } | undefined;
      return value?.token_price ?? '0';
    },
  );
  const teamAggregates = new TeamAggregateService(db);
  const burn = new BurnService(db);
  const userAccess = new UserAccessPolicyService(db);
  const referralBinding = new ReferralBindingService(db);
  const purchaseFact = new PurchaseFactService(db, configResolver, referralBinding);
  const purchaseOrder = new PurchaseOrderService(db, userAccess, configResolver);
  const purchaseRecovery = new PurchaseRecoveryService(db);
  const nonces = new NonceService(db, { ttlMinutes: env.NONCE_TTL_MINUTES });
  const walletVerify = new WalletVerifyService(db, nonces, {
    sessionTtlHours: env.USER_SESSION_TTL_HOURS,
  });
  const userSessions = new UserSessionService(db);
  const adminAuth = new AdminAuthService(db, {
    sessionTtlHours: env.ADMIN_SESSION_TTL_HOURS,
  });
  const broadcaster = pickBroadcaster(env.APP_ENV);
  const claimPrep = new ClaimPreparationService(db, userAccess, configResolver);
  const claimSigning = new ClaimSigningService(db, broadcaster);
  const claimFinalization = new ClaimFinalizationService(db, broadcaster);
  const adjustments = new AdjustmentService(db);
  const settlement = new SettlementOrchestrator(
    db,
    configResolver,
    teamAggregates,
    holdingService,
    burn,
  );
  const recompute = new RecomputeService(db, adjustments);

  const services: HandlerServices = {
    userSessions,
    adminAuth,
    nonces,
    walletVerify,
    purchaseOrder,
    purchaseFact,
    purchaseRecovery,
    claimPrep,
    claimSigning,
    claimFinalization,
    settlement,
    recompute,
    adjustments,
    userAccess,
  };

  return {
    db,
    services,
    logger,
    requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };
}
