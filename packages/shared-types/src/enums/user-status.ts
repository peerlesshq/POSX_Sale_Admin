/**
 * User operational status.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §13
 *   - 03_database_schema_spec.md §7.1
 *   - 07_state_machines_and_exception_flows.md §5
 *
 * Stored as constrained text (not PG enum) so value additions stay
 * migration-friendly. Business modules must use these constants.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const UserStatus = {
  Active: 'active',
  RestrictedPurchase: 'restricted_purchase',
  RestrictedClaim: 'restricted_claim',
  Suspended: 'suspended',
  Blacklisted: 'blacklisted',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const USER_STATUS_VALUES = [
  UserStatus.Active,
  UserStatus.RestrictedPurchase,
  UserStatus.RestrictedClaim,
  UserStatus.Suspended,
  UserStatus.Blacklisted,
] as const satisfies ReadonlyArray<UserStatus>;

export const isUserStatus = createEnumGuard(USER_STATUS_VALUES);
