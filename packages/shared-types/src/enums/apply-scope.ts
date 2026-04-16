/**
 * Config apply scope.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §11.4
 *   - 03_database_schema_spec.md §12.1
 *   - 09_config_center_spec.md §6
 *
 * Recommended `apply_scope` by config type (09 §6.1–6.4):
 *   - `all_users`           → display content, general UI config
 *   - `new_users_only`      → onboarding/policy variants
 *   - `new_orders_only`     → minimum purchase amount, vesting params
 *   - `next_settlement_day` → tier thresholds, team ladders, equal-level
 *                             rules, burn rules (most reward config)
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ApplyScope = {
  AllUsers: 'all_users',
  NewUsersOnly: 'new_users_only',
  NewOrdersOnly: 'new_orders_only',
  NextSettlementDay: 'next_settlement_day',
} as const;

export type ApplyScope = (typeof ApplyScope)[keyof typeof ApplyScope];

export const APPLY_SCOPE_VALUES = [
  ApplyScope.AllUsers,
  ApplyScope.NewUsersOnly,
  ApplyScope.NewOrdersOnly,
  ApplyScope.NextSettlementDay,
] as const satisfies ReadonlyArray<ApplyScope>;

export const isApplyScope = createEnumGuard(APPLY_SCOPE_VALUES);
