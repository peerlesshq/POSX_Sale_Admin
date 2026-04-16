/**
 * Reward endpoint contracts (user-side).
 *
 * Source of truth: 04_api_spec.md §10.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  RateStringSchema,
  TxHashSchema,
  UtcDateSchema,
  UuidSchema,
  WalletAddressSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  DateRangeQuerySchema,
  PaginationMetaSchema,
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- GET /rewards/overview ----

export const RewardOverviewDataSchema = z.object({
  claimable: z.object({
    team_claimable: AmountStringSchema,
    equal_level_claimable: AmountStringSchema,
    adjustment_credit_claimable: AmountStringSchema,
    total_claimable: AmountStringSchema,
  }),
  totals: z.object({
    direct_total: AmountStringSchema,
    team_total: AmountStringSchema,
    equal_level_total: AmountStringSchema,
    burned_total: AmountStringSchema,
  }),
});
export const GetRewardOverviewResponseSchema = successEnvelope(RewardOverviewDataSchema);

// ---- GET /rewards/direct ----

export const DirectRewardItemSchema = z.object({
  direct_reward_id: UuidSchema,
  from_wallet_address: WalletAddressSchema,
  purchase_amount: AmountStringSchema,
  reward_rate: RateStringSchema.nullable(),
  reward_amount: AmountStringSchema,
  tx_hash: TxHashSchema,
  rewarded_at: IsoTimestampSchema,
});
export const ListDirectRewardsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema);
export const ListDirectRewardsResponseSchema = successEnvelope(
  paginatedPayload(DirectRewardItemSchema),
);

// ---- GET /rewards/team ----

export const TeamRewardItemSchema = z.object({
  team_reward_daily_id: UuidSchema,
  settle_date: UtcDateSchema,
  qualification_tier: z.string(),
  user_team_rate: RateStringSchema,
  team_total_performance: AmountStringSchema,
  effective_performance: AmountStringSchema,
  raw_total: AmountStringSchema,
  burned_amount: AmountStringSchema,
  actual_total: AmountStringSchema,
  status: z.string(),
  claim_order_id: UuidSchema.nullable(),
  created_at: IsoTimestampSchema,
});
export const ListTeamRewardsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  status: z.string().optional(),
});
export const ListTeamRewardsResponseSchema = successEnvelope(
  paginatedPayload(TeamRewardItemSchema),
);

// ---- GET /rewards/team/{id} ----

export const TeamRewardLineDetailSchema = z.object({
  line_root_wallet_address: WalletAddressSchema,
  line_effective_performance: AmountStringSchema,
  subordinate_team_rate: RateStringSchema,
  differential_rate: RateStringSchema,
  raw_reward_amount: AmountStringSchema,
  equal_level_replaced: z.boolean(),
});
export const GetTeamRewardDetailDataSchema = TeamRewardItemSchema.extend({
  line_details: z.array(TeamRewardLineDetailSchema),
});
export const GetTeamRewardDetailResponseSchema = successEnvelope(GetTeamRewardDetailDataSchema);

// ---- GET /rewards/equal-level ----

export const EqualLevelRewardItemSchema = z.object({
  equal_level_reward_id: UuidSchema,
  settle_date: UtcDateSchema,
  line_root_wallet_address: WalletAddressSchema,
  equal_level_rate: RateStringSchema,
  subordinate_team_total_performance: AmountStringSchema,
  line_effective_performance: AmountStringSchema,
  raw_amount: AmountStringSchema,
  burned_amount: AmountStringSchema,
  actual_amount: AmountStringSchema,
  status: z.string(),
  created_at: IsoTimestampSchema,
});
export const ListEqualLevelRewardsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  status: z.string().optional(),
});
export const ListEqualLevelRewardsResponseSchema = successEnvelope(
  paginatedPayload(EqualLevelRewardItemSchema),
);

// ---- GET /rewards/burn-status ----

export const BurnStatusDataSchema = z.object({
  burn_enabled: z.boolean(),
  holding_value_usdt: AmountStringSchema,
  burn_disable_threshold: AmountStringSchema,
  burn_cap: AmountStringSchema.nullable(),
  used_burn_capacity: AmountStringSchema.nullable(),
  remaining_burn_capacity: AmountStringSchema.nullable(),
  burned_total: AmountStringSchema,
});
export const GetBurnStatusResponseSchema = successEnvelope(BurnStatusDataSchema);

// ---- GET /rewards/claims ----

export const ClaimHistoryItemSchema = z.object({
  claim_record_id: UuidSchema,
  claim_order_id: UuidSchema,
  amount: AmountStringSchema,
  tx_hash: TxHashSchema.nullable(),
  status: z.string(),
  recorded_at: IsoTimestampSchema,
});
export const ListClaimHistoryQuerySchema = PaginationQuerySchema.extend({
  status: z.string().optional(),
});
export const ListClaimHistoryResponseSchema = successEnvelope(
  paginatedPayload(ClaimHistoryItemSchema),
);

// Re-export common list shapes for consumers that want to compose
// their own envelopes later.
export { PaginationMetaSchema };
