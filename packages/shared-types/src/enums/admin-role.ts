/**
 * Admin role.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §7.4
 *   - 08_auth_and_permissions_spec.md §12
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const AdminRole = {
  SuperAdmin: 'super_admin',
  Operator: 'operator',
  Viewer: 'viewer',
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const ADMIN_ROLE_VALUES = [
  AdminRole.SuperAdmin,
  AdminRole.Operator,
  AdminRole.Viewer,
] as const satisfies ReadonlyArray<AdminRole>;

export const isAdminRole = createEnumGuard(ADMIN_ROLE_VALUES);

/**
 * Rank used for "minimum role" checks in permission helpers.
 * Higher number = more privileges.
 */
export const ADMIN_ROLE_RANK: Readonly<Record<AdminRole, number>> = {
  [AdminRole.Viewer]: 1,
  [AdminRole.Operator]: 2,
  [AdminRole.SuperAdmin]: 3,
};
