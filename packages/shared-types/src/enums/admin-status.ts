/**
 * Admin account status.
 *
 * Source of truth: 03_database_schema_spec.md §7.4
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const AdminStatus = {
  Active: 'active',
  Disabled: 'disabled',
} as const;

export type AdminStatus = (typeof AdminStatus)[keyof typeof AdminStatus];

export const ADMIN_STATUS_VALUES = [
  AdminStatus.Active,
  AdminStatus.Disabled,
] as const satisfies ReadonlyArray<AdminStatus>;

export const isAdminStatus = createEnumGuard(ADMIN_STATUS_VALUES);
