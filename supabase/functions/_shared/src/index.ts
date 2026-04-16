/**
 * @posx/backend-core — public API.
 *
 * Phase 3 exports:
 *   - ./db          DbClient interface + PostgresJsClient adapter
 *   - ./repos       data-access-only repositories
 *   - ./rebuilders  derived-summary rebuild functions
 *
 * Phase 4 additions:
 *   - ./errors      AppError + error_code envelope helpers
 *   - ./observability  request id, structured logger, audit writer
 *   - ./crypto      hash + random + wallet signature verification
 *   - ./auth        session / nonce / admin auth / guards
 *   - ./services    business orchestration (config-resolver-db,
 *                   holding, user-access-policy, referral binding,
 *                   tier, team, purchase, chain event processor,
 *                   burn, settlement, claim, adjustment, recompute)
 *   - ./transitions explicit state transition helpers (constraint 2)
 *   - ./chain       RPC client interface + stub
 *   - ./jobs        scheduled worker wrappers
 *
 * IMPORTANT: repos are data access only — no qualification,
 * permission, burn, settlement, claimability, or config-effectiveness
 * logic inside them. Those belong in @posx/domain-rules (pure compute)
 * or in the services layer.
 */
export * from './db';
export * from './repos';
export * from './rebuilders';
export * from './errors';
export * from './observability';
export * from './crypto';
export * from './auth';
export * from './services';
export * from './transitions';
export * from './chain';
export * from './jobs';
export * from './handlers';
