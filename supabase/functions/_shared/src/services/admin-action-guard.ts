/**
 * AdminActionGuardService — pre-flight checks for privileged admin
 * actions.
 *
 * Source of truth: 08_auth_and_permissions_spec.md §14, §21.
 *
 * All high-risk admin flows (recompute apply, reversal approval,
 * severe user status transitions, admin account management) must
 * call the relevant assertion here so that role requirements,
 * reason presence, and audit coverage all live in one place.
 */
import {
  ADMIN_ROLE_RANK,
  AdminRole,
  type UserStatus,
} from '@posx/shared-types';

import { AppError } from '../errors';

import type { ValidatedAdminSession } from '../auth/admin-auth-service';

export class AdminActionGuardService {
  assertMinRole(actor: ValidatedAdminSession, minRole: AdminRole): void {
    if (ADMIN_ROLE_RANK[actor.role] < ADMIN_ROLE_RANK[minRole]) {
      throw new AppError(
        'ADMIN_ROLE_REQUIRED',
        `role ${actor.role} cannot perform this action (requires ${minRole} or higher)`,
      );
    }
  }

  assertSuperAdmin(actor: ValidatedAdminSession): void {
    this.assertMinRole(actor, AdminRole.SuperAdmin);
  }

  assertCanChangeUserStatus(
    actor: ValidatedAdminSession,
    target: UserStatus,
    reason: string,
  ): void {
    if (!reason || !reason.trim()) {
      throw new AppError('INVALID_REQUEST', 'reason is required');
    }
    // Per 08 §14.1: `suspended` and `blacklisted` are super-admin
    // only. `restricted_*` and restore-to-`active` are operator+.
    if (target === 'suspended' || target === 'blacklisted') {
      this.assertSuperAdmin(actor);
      return;
    }
    this.assertMinRole(actor, AdminRole.Operator);
  }

  assertCanCreateConfigVersion(
    actor: ValidatedAdminSession,
    reason?: string,
  ): void {
    this.assertMinRole(actor, AdminRole.Operator);
    if (reason !== undefined && !reason.trim()) {
      throw new AppError('INVALID_REQUEST', 'reason cannot be empty');
    }
  }

  assertCanTriggerSettlement(
    actor: ValidatedAdminSession,
    reason: string,
  ): void {
    this.assertMinRole(actor, AdminRole.Operator);
    if (!reason || !reason.trim()) {
      throw new AppError('INVALID_REQUEST', 'reason is required');
    }
  }

  assertCanRunRecomputePreview(
    actor: ValidatedAdminSession,
    reason: string,
  ): void {
    this.assertMinRole(actor, AdminRole.Operator);
    if (!reason || !reason.trim()) {
      throw new AppError('INVALID_REQUEST', 'reason is required');
    }
  }

  assertCanApplyRecompute(
    actor: ValidatedAdminSession,
    reason: string,
  ): void {
    this.assertSuperAdmin(actor);
    if (!reason || !reason.trim()) {
      throw new AppError(
        'RECOMPUTE_APPLY_FORBIDDEN',
        'recompute apply requires a reason',
      );
    }
  }

  assertCanManageAdminAccounts(actor: ValidatedAdminSession): void {
    this.assertSuperAdmin(actor);
  }
}
