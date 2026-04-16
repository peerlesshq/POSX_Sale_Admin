/**
 * Team endpoint contracts (user-side).
 *
 * Source of truth: 04_api_spec.md §12.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  RateStringSchema,
  UtcDateSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  DateRangeQuerySchema,
  PaginationMetaSchema,
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- GET /team/overview ----

export const TeamOverviewDataSchema = z.object({
  team_total_performance: AmountStringSchema,
  today_effective_performance: AmountStringSchema,
  claimable_amount: AmountStringSchema,
  pending_confirmation_amount: AmountStringSchema,
  total_received: AmountStringSchema,
  total_claimed: AmountStringSchema,
  current_team_rate: RateStringSchema,
  current_tier: z.string().nullable(),
  next_rate_target: z
    .object({
      next_rate: RateStringSchema,
      required_team_total_performance: AmountStringSchema,
      remaining_needed: AmountStringSchema,
    })
    .nullable(),
});
export const GetTeamOverviewResponseSchema = successEnvelope(TeamOverviewDataSchema);

// ---- GET /team/members ----

export const TeamMemberRowSchema = z.object({
  wallet_address_masked: z.string(),
  level: z.number().int().positive(),
  joined_at: IsoTimestampSchema,
  cumulative_deposit: AmountStringSchema,
  current_tier: z.string().nullable(),
  direct_referral_count: z.number().int().nonnegative(),
  status: z.string(),
});

export const TeamLevelAggregateRowSchema = z.object({
  level: z.number().int().positive(),
  member_count: z.number().int().nonnegative(),
  active_count: z.number().int().nonnegative(),
  new_performance: AmountStringSchema,
  cumulative_performance: AmountStringSchema,
});

export const ListTeamMembersQuerySchema = PaginationQuerySchema.extend({
  level: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
});
export const ListTeamMembersDataSchema = z.object({
  items: z.array(TeamMemberRowSchema),
  pagination: PaginationMetaSchema,
  aggregates_by_level: z.array(TeamLevelAggregateRowSchema),
});
export const ListTeamMembersResponseSchema = successEnvelope(ListTeamMembersDataSchema);

// ---- GET /team/daily-details ----

export const TeamDailyDetailItemSchema = z.object({
  date: UtcDateSchema,
  effective_performance: AmountStringSchema,
  team_rate: RateStringSchema,
  team_raw_amount: AmountStringSchema,
  equal_level_raw_amount: AmountStringSchema,
  burned_amount: AmountStringSchema,
  actual_amount: AmountStringSchema,
  status: z.enum(['settled', 'pending_confirmation']),
});
export const ListTeamDailyDetailsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema);
export const ListTeamDailyDetailsResponseSchema = successEnvelope(
  paginatedPayload(TeamDailyDetailItemSchema),
);
