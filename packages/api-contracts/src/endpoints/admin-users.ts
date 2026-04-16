/**
 * Admin user management endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §15.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  UuidSchema,
  WalletAddressSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  DateRangeQuerySchema,
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- GET /admin/users ----

export const AdminUserListItemSchema = z.object({
  wallet_address: WalletAddressSchema,
  status: z.string(),
  cumulative_deposit: AmountStringSchema,
  holding_value_usdt: AmountStringSchema,
  current_tier: z.string().nullable(),
  referrer_address: WalletAddressSchema.nullable(),
  direct_referral_count: z.number().int().nonnegative(),
  team_total_performance: AmountStringSchema,
  created_at: IsoTimestampSchema,
});

export const ListAdminUsersQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  search: z.string().optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  min_deposit: z.string().optional(),
  max_deposit: z.string().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

export const ListAdminUsersResponseSchema = successEnvelope(
  paginatedPayload(AdminUserListItemSchema),
);

// ---- GET /admin/users/{wallet} ----

export const AdminUserDetailDataSchema = z.object({
  identity: z.object({
    wallet_address: WalletAddressSchema,
    status: z.string(),
    created_at: IsoTimestampSchema,
    first_purchase_at: IsoTimestampSchema.nullable(),
  }),
  referral: z.object({
    referrer_address: WalletAddressSchema.nullable(),
    bound_at: IsoTimestampSchema.nullable(),
    binding_source: z.string().nullable(),
    direct_referral_count: z.number().int().nonnegative(),
  }),
  financial: z.object({
    cumulative_deposit: AmountStringSchema,
    holding_posx_amount: AmountStringSchema,
    holding_value_usdt: AmountStringSchema,
    current_tier: z.string().nullable(),
    reward_qualified: z.boolean(),
    team_reward_qualified: z.boolean(),
    team_total_performance: AmountStringSchema,
  }),
  reward_summary: z.object({
    direct_total: AmountStringSchema,
    team_total: AmountStringSchema,
    equal_level_total: AmountStringSchema,
    claimable_total: AmountStringSchema,
    burned_total: AmountStringSchema,
  }),
  vesting_summary: z.object({
    total_locked: AmountStringSchema,
    total_released: AmountStringSchema,
    total_withdrawable: AmountStringSchema,
    total_withdrawn: AmountStringSchema,
  }),
});
export const GetAdminUserDetailResponseSchema = successEnvelope(AdminUserDetailDataSchema);

// ---- PATCH /admin/users/{wallet}/status ----

export const UpdateUserStatusRequestSchema = z.object({
  target_status: z.enum([
    'active',
    'restricted_purchase',
    'restricted_claim',
    'suspended',
    'blacklisted',
  ]),
  reason: z.string().min(1),
  effective_from: IsoTimestampSchema,
  note: z.string().optional(),
});
export type UpdateUserStatusRequest = z.infer<typeof UpdateUserStatusRequestSchema>;

export const UpdateUserStatusDataSchema = z.object({
  wallet_address: WalletAddressSchema,
  old_status: z.string(),
  new_status: z.string(),
  effective_from: IsoTimestampSchema,
  updated_by: UuidSchema,
});
export const UpdateUserStatusResponseSchema = successEnvelope(UpdateUserStatusDataSchema);

// ---- GET /admin/users/{wallet}/tree ----

export const AdminTreeNodeSchema = z.object({
  wallet_address: WalletAddressSchema,
  parent_wallet_address: WalletAddressSchema.nullable(),
  depth: z.number().int().nonnegative(),
  status: z.string(),
  cumulative_deposit: AmountStringSchema,
  current_tier: z.string().nullable(),
});
export const GetAdminUserTreeDataSchema = z.object({
  root_wallet_address: WalletAddressSchema,
  nodes: z.array(AdminTreeNodeSchema),
});
export const GetAdminUserTreeQuerySchema = z.object({
  max_depth: z.coerce.number().int().positive().max(20).optional(),
  include_metrics: z.coerce.boolean().optional(),
});
export const GetAdminUserTreeResponseSchema = successEnvelope(GetAdminUserTreeDataSchema);
