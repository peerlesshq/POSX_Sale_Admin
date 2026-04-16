/**
 * Admin reward endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §16.
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
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- GET /admin/rewards/direct ----

export const AdminDirectRewardItemSchema = z.object({
  direct_reward_id: UuidSchema,
  from_wallet_address: WalletAddressSchema,
  to_wallet_address: WalletAddressSchema,
  purchase_amount: AmountStringSchema,
  reward_rate: RateStringSchema.nullable(),
  reward_amount: AmountStringSchema,
  tx_hash: TxHashSchema,
  rewarded_at: IsoTimestampSchema,
});
export const ListAdminDirectRewardsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  wallet_address: z.string().optional(),
  from_wallet_address: z.string().optional(),
});
export const ListAdminDirectRewardsResponseSchema = successEnvelope(
  paginatedPayload(AdminDirectRewardItemSchema),
);

// ---- GET /admin/rewards/team ----

export const AdminTeamRewardItemSchema = z.object({
  team_reward_daily_id: UuidSchema,
  wallet_address: WalletAddressSchema,
  settle_date: UtcDateSchema,
  qualification_tier: z.string(),
  user_team_rate: RateStringSchema,
  team_total_performance: AmountStringSchema,
  effective_performance: AmountStringSchema,
  raw_total: AmountStringSchema,
  burned_amount: AmountStringSchema,
  actual_total: AmountStringSchema,
  status: z.string(),
});
export const ListAdminTeamRewardsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  wallet_address: z.string().optional(),
  settle_date: UtcDateSchema.optional(),
  status: z.string().optional(),
});
export const ListAdminTeamRewardsResponseSchema = successEnvelope(
  paginatedPayload(AdminTeamRewardItemSchema),
);

// ---- GET /admin/rewards/team/{id} ----

export const AdminTeamRewardLineDetailSchema = z.object({
  line_root_wallet_address: WalletAddressSchema,
  line_effective_performance: AmountStringSchema,
  subordinate_team_rate: RateStringSchema,
  differential_rate: RateStringSchema,
  raw_reward_amount: AmountStringSchema,
  equal_level_replaced: z.boolean(),
});
export const GetAdminTeamRewardDetailDataSchema = AdminTeamRewardItemSchema.extend({
  line_details: z.array(AdminTeamRewardLineDetailSchema),
});
export const GetAdminTeamRewardDetailResponseSchema = successEnvelope(
  GetAdminTeamRewardDetailDataSchema,
);

// ---- GET /admin/rewards/equal-level ----

export const AdminEqualLevelRewardItemSchema = z.object({
  equal_level_reward_id: UuidSchema,
  wallet_address: WalletAddressSchema,
  line_root_wallet_address: WalletAddressSchema,
  settle_date: UtcDateSchema,
  equal_level_rate: RateStringSchema,
  line_effective_performance: AmountStringSchema,
  raw_amount: AmountStringSchema,
  burned_amount: AmountStringSchema,
  actual_amount: AmountStringSchema,
  status: z.string(),
});
export const ListAdminEqualLevelRewardsQuerySchema = PaginationQuerySchema.extend({
  wallet_address: z.string().optional(),
  line_root_wallet_address: z.string().optional(),
  settle_date: UtcDateSchema.optional(),
  status: z.string().optional(),
});
export const ListAdminEqualLevelRewardsResponseSchema = successEnvelope(
  paginatedPayload(AdminEqualLevelRewardItemSchema),
);

// ---- GET /admin/rewards/burns ----

export const AdminBurnRecordItemSchema = z.object({
  burn_record_id: UuidSchema,
  wallet_address: WalletAddressSchema,
  reward_type: z.enum(['team', 'equal_level']),
  settle_date: UtcDateSchema,
  holding_value_at_snapshot: AmountStringSchema,
  used_burn_capacity_before: AmountStringSchema,
  burn_cap: AmountStringSchema,
  raw_amount: AmountStringSchema,
  burned_amount: AmountStringSchema,
  actual_amount: AmountStringSchema,
  reason: z.string(),
});
export const ListAdminBurnRecordsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  wallet_address: z.string().optional(),
  reward_type: z.enum(['team', 'equal_level']).optional(),
});
export const ListAdminBurnRecordsResponseSchema = successEnvelope(
  paginatedPayload(AdminBurnRecordItemSchema),
);
