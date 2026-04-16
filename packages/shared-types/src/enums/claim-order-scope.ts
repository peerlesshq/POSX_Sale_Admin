/**
 * Claim order scope.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §14.4
 *   - 03_database_schema_spec.md §10.7
 *   - 04_api_spec.md §11.1
 *
 * The primary user flow is `claim_all`. `claim_by_type` is a secondary
 * flow supported only when `claim_rules.claim_policy.allow_claim_by_type`
 * resolves to true.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ClaimOrderScope = {
  ClaimAll: 'claim_all',
  ClaimByType: 'claim_by_type',
} as const;

export type ClaimOrderScope =
  (typeof ClaimOrderScope)[keyof typeof ClaimOrderScope];

export const CLAIM_ORDER_SCOPE_VALUES = [
  ClaimOrderScope.ClaimAll,
  ClaimOrderScope.ClaimByType,
] as const satisfies ReadonlyArray<ClaimOrderScope>;

export const isClaimOrderScope = createEnumGuard(CLAIM_ORDER_SCOPE_VALUES);
