/**
 * Admin dashboard endpoint contract.
 *
 * Source of truth: 04_api_spec.md §14.
 */
import { z } from 'zod';

import { AmountStringSchema, UtcDateSchema } from '../common';
import { successEnvelope } from '../envelope';
import { DateRangeQuerySchema } from '../pagination';

export const AdminDashboardQuerySchema = DateRangeQuerySchema.extend({
  range: z.enum(['day', 'week', 'month', 'custom']).optional(),
});

export const AdminDashboardSummarySchema = z.object({
  platform_total_deposit: AmountStringSchema,
  today_deposit: AmountStringSchema,
  total_users: z.number().int().nonnegative(),
  today_new_users: z.number().int().nonnegative(),
  total_locked_posx: AmountStringSchema,
  total_released_posx: AmountStringSchema,
  reward_24h: z.object({
    direct: AmountStringSchema,
    team: AmountStringSchema,
    equal_level: AmountStringSchema,
  }),
  burn_total: AmountStringSchema,
});

export const AdminDashboardTrendItemSchema = z.object({
  date: UtcDateSchema,
  deposit_total: AmountStringSchema,
  new_users_count: z.number().int().nonnegative(),
  reward_total: AmountStringSchema,
});

export const AdminDashboardTierDistSchema = z.object({
  tier: z.string(),
  count: z.number().int().nonnegative(),
});

export const AdminDashboardDataSchema = z.object({
  summary: AdminDashboardSummarySchema,
  trend: z.array(AdminDashboardTrendItemSchema),
  tier_distribution: z.array(AdminDashboardTierDistSchema),
});
export const GetAdminDashboardResponseSchema = successEnvelope(AdminDashboardDataSchema);
