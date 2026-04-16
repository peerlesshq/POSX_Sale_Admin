/**
 * Normalized claim policy input.
 *
 * Source of truth: 01 §14 and 09 §9.9 (`claim_rules.claim_policy`).
 */
import type { AmountString, ClaimOrderScope } from '@posx/shared-types';

export interface ClaimPolicy {
  readonly min_claim_amount: AmountString;
  readonly claim_scope_default: ClaimOrderScope;
  readonly allow_claim_by_type: boolean;
  readonly pending_signature_ttl_minutes: number;
}
