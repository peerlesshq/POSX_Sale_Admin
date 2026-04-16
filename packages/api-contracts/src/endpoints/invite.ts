/**
 * Invite endpoint contracts (user-side).
 *
 * Source of truth: 04_api_spec.md §12.4, §12.5.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- GET /invite ----

export const InviteOverviewDataSchema = z.object({
  invite_unlocked: z.boolean(),
  unlock_threshold: AmountStringSchema,
  current_cumulative_deposit: AmountStringSchema,
  invite_link: z.string().url(),
  referral_code: z.string(),
  referral_count: z.number().int().nonnegative(),
  referral_stats: z.object({
    total_referral_deposit: AmountStringSchema,
    active_referral_count: z.number().int().nonnegative(),
  }),
});
export const GetInviteOverviewResponseSchema = successEnvelope(InviteOverviewDataSchema);

// ---- GET /invite/referrals ----

export const InviteReferralItemSchema = z.object({
  wallet_address_masked: z.string(),
  bound_at: IsoTimestampSchema,
  cumulative_deposit: AmountStringSchema,
  current_tier: z.string().nullable(),
  status: z.string(),
});
export const ListInviteReferralsQuerySchema = PaginationQuerySchema;
export const ListInviteReferralsResponseSchema = successEnvelope(
  paginatedPayload(InviteReferralItemSchema),
);
