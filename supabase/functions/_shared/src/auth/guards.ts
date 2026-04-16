/**
 * Auth guards.
 *
 * Source of truth: 08_auth_and_permissions_spec.md §18, §23.
 *
 * Every protected handler must invoke one of these helpers BEFORE
 * running any business logic. Guards:
 *   - validate the session token
 *   - verify resource ownership (for by-id user routes)
 *   - verify admin role against a minimum rank
 */
import {
  ADMIN_ROLE_RANK,
  type AdminRole,
  type WalletAddress,
} from '@posx/shared-types';

import { AppError } from '../errors';

import type { AdminAuthService, ValidatedAdminSession } from './admin-auth-service';
import type { UserSessionService, ValidatedUserSession } from './user-session-service';

export interface UserGuardContext {
  readonly sessions: UserSessionService;
}

export interface AdminGuardContext {
  readonly adminAuth: AdminAuthService;
}

function extractBearer(authorizationHeader: string | null | undefined): string {
  if (!authorizationHeader) {
    throw new AppError('UNAUTHORIZED', 'missing Authorization header');
  }
  const match = /^Bearer\s+(.+)$/.exec(authorizationHeader);
  if (!match || !match[1]) {
    throw new AppError('UNAUTHORIZED', 'malformed Authorization header');
  }
  return match[1];
}

export async function requireUserSession(
  ctx: UserGuardContext,
  authorizationHeader: string | null | undefined,
): Promise<ValidatedUserSession> {
  const token = extractBearer(authorizationHeader);
  return ctx.sessions.validate(token);
}

export async function requireAdminSession(
  ctx: AdminGuardContext,
  authorizationHeader: string | null | undefined,
): Promise<ValidatedAdminSession> {
  const token = extractBearer(authorizationHeader);
  return ctx.adminAuth.validate(token);
}

/**
 * Enforce minimum admin role rank (viewer < operator < super_admin).
 * Throws `ADMIN_ROLE_REQUIRED` on failure.
 */
export function requireAdminRole(
  actor: ValidatedAdminSession,
  minRole: AdminRole,
): void {
  if (ADMIN_ROLE_RANK[actor.role] < ADMIN_ROLE_RANK[minRole]) {
    throw new AppError(
      'ADMIN_ROLE_REQUIRED',
      `role ${actor.role} cannot perform this action (requires ${minRole} or higher)`,
    );
  }
}

/**
 * Enforce resource ownership for by-id user routes (08 §16.2). The
 * session's wallet is the ONLY trusted source — route params are
 * never trusted.
 */
export function assertUserOwnsResource(
  session: ValidatedUserSession,
  resourceWallet: WalletAddress,
): void {
  if (session.wallet.toLowerCase() !== resourceWallet.toLowerCase()) {
    throw new AppError('FORBIDDEN', 'resource does not belong to authenticated wallet');
  }
}
