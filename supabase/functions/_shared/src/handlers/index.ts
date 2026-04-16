/**
 * Phase 4.5 handler surface — full backend API.
 *
 * User-side handler groups:
 *   - auth
 *   - public-config
 *   - user (profile + dashboard)
 *   - purchase
 *   - vesting
 *   - reward
 *   - claim
 *   - team
 *   - invite
 *
 * Admin-side handler groups (all in `./admin.ts` to keep the file
 * count manageable):
 *   - admin auth
 *   - admin dashboard
 *   - admin users (list / detail / tree / status)
 *   - admin rewards (direct, burns)
 *   - admin config (list, create, history)
 *   - admin settlement (trigger, list, recompute preview, recompute apply)
 *   - admin system (chain-sync, jobs, health, logs)
 *   - admin accounts
 */
export * from './types';
export * from './auth';
export * from './public-config';
export * from './user';
export * from './purchase';
export * from './vesting';
export * from './reward';
export * from './claim';
export * from './team';
export * from './invite';
export * from './admin';
