/**
 * Claim rules normalizer.
 *
 * Source of truth: 09_config_center_spec.md §9.9
 */
import { z } from 'zod';

import { CLAIM_ORDER_SCOPE_VALUES, type ClaimOrderScope } from '@posx/shared-types';
import type { ClaimPolicy } from '@posx/domain-rules';

import { AmountZ } from './common';

const ClaimOrderScopeZ = z.enum(
  CLAIM_ORDER_SCOPE_VALUES as unknown as readonly [ClaimOrderScope, ...ClaimOrderScope[]],
);

export const ClaimPolicySchema = z.object({
  min_claim_amount: AmountZ,
  claim_scope_default: ClaimOrderScopeZ,
  allow_claim_by_type: z.boolean(),
  pending_signature_ttl_minutes: z.number().int().positive(),
});

export function normalizeClaimPolicy(raw: unknown): ClaimPolicy {
  const parsed = ClaimPolicySchema.parse(raw);
  return {
    min_claim_amount: parsed.min_claim_amount,
    claim_scope_default: parsed.claim_scope_default,
    allow_claim_by_type: parsed.allow_claim_by_type,
    pending_signature_ttl_minutes: parsed.pending_signature_ttl_minutes,
  };
}
