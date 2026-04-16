/**
 * User profile + dashboard endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §7.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  RateStringSchema,
  WalletAddressSchema,
} from '../common';
import { successEnvelope } from '../envelope';

// ---- GET /user/profile ----

export const UserProfileDataSchema = z.object({
  wallet_address: WalletAddressSchema,
  status: z.string(),
  referrer_address: WalletAddressSchema.nullable(),
  referral_bound: z.boolean(),
  bound_at: IsoTimestampSchema.nullable(),
  cumulative_deposit: AmountStringSchema,
  holding_posx_amount: AmountStringSchema,
  holding_value_usdt: AmountStringSchema,
  current_tier: z.string().nullable(),
  reward_qualified: z.boolean(),
  team_reward_qualified: z.boolean(),
  direct_rate: RateStringSchema.nullable(),
  team_rate: RateStringSchema.nullable(),
  created_at: IsoTimestampSchema,
});
export const GetUserProfileResponseSchema = successEnvelope(UserProfileDataSchema);

// ---- GET /user/dashboard ----

export const DashboardOverviewSchema = z.object({
  cumulative_deposit: AmountStringSchema,
  holding_value_usdt: AmountStringSchema,
  current_tier: z.string().nullable(),
  locked_posx_total: AmountStringSchema,
  referral_count: z.number().int().nonnegative(),
});

export const DashboardClaimableSchema = z.object({
  direct_claimable: AmountStringSchema,
  team_claimable: AmountStringSchema,
  equal_level_claimable: AmountStringSchema,
  adjustment_credit_claimable: AmountStringSchema,
  total_claimable: AmountStringSchema,
});

export const DashboardRewardSummarySchema = z.object({
  direct_total: AmountStringSchema,
  team_total: AmountStringSchema,
  equal_level_total: AmountStringSchema,
  burned_total: AmountStringSchema,
});

export const DashboardBurnStatusSchema = z.object({
  burn_enabled: z.boolean(),
  holding_value_usdt: AmountStringSchema,
  burn_cap: AmountStringSchema.nullable(),
  used_burn_capacity: AmountStringSchema.nullable(),
  remaining_burn_capacity: AmountStringSchema.nullable(),
});

export const DashboardVestingSummarySchema = z.object({
  total_locked: AmountStringSchema,
  total_released: AmountStringSchema,
  total_withdrawable: AmountStringSchema,
  total_withdrawn: AmountStringSchema,
});

export const DashboardRecentPurchaseSchema = z.object({
  purchase_id: z.string(),
  usdt_amount: AmountStringSchema,
  posx_amount: AmountStringSchema,
  token_price_at_purchase: AmountStringSchema,
  purchase_at: IsoTimestampSchema,
});

export const UserDashboardDataSchema = z.object({
  overview: DashboardOverviewSchema,
  claimable: DashboardClaimableSchema,
  reward_summary: DashboardRewardSummarySchema,
  burn_status: DashboardBurnStatusSchema,
  vesting_summary: DashboardVestingSummarySchema,
  recent_purchases: z.array(DashboardRecentPurchaseSchema),
});
export const GetUserDashboardResponseSchema = successEnvelope(UserDashboardDataSchema);
