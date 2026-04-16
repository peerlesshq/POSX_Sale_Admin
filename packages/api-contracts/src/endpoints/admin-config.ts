/**
 * Admin config endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §17.
 */
import { z } from 'zod';

import {
  IsoTimestampSchema,
  UuidSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

const ConfigScopeSchema = z.enum([
  'all_users',
  'new_users_only',
  'new_orders_only',
  'next_settlement_day',
]);

// ---- GET /admin/config ----

export const AdminConfigItemSchema = z.object({
  config_version_id: UuidSchema,
  config_group: z.string(),
  config_key: z.string(),
  version_no: z.number().int().positive(),
  config_value: z.record(z.string(), z.unknown()),
  effective_from: IsoTimestampSchema,
  apply_scope: ConfigScopeSchema,
  status: z.string(),
  description: z.string().nullable(),
});
export const ListAdminConfigQuerySchema = z.object({
  config_group: z.string().optional(),
  config_key: z.string().optional(),
});
export const ListAdminConfigDataSchema = z.object({
  items: z.array(AdminConfigItemSchema),
});
export const ListAdminConfigResponseSchema = successEnvelope(ListAdminConfigDataSchema);

// ---- POST /admin/config ----

export const CreateAdminConfigRequestSchema = z.object({
  config_group: z.string().min(1),
  config_key: z.string().min(1),
  config_value: z.record(z.string(), z.unknown()),
  effective_from: IsoTimestampSchema,
  apply_scope: ConfigScopeSchema,
  description: z.string().optional(),
  /** BE-70 — operator audit reason, required for every config mutation. */
  reason: z.string().min(1),
});
export type CreateAdminConfigRequest = z.infer<typeof CreateAdminConfigRequestSchema>;

export const CreateAdminConfigDataSchema = z.object({
  config_version_id: UuidSchema,
  config_group: z.string(),
  config_key: z.string(),
  version_no: z.number().int().positive(),
  effective_from: IsoTimestampSchema,
  apply_scope: ConfigScopeSchema,
  status: z.string(),
});
export const CreateAdminConfigResponseSchema = successEnvelope(CreateAdminConfigDataSchema);

// ---- GET /admin/config/history ----

export const AdminConfigHistoryItemSchema = z.object({
  config_change_history_id: UuidSchema,
  config_version_id: UuidSchema,
  config_group: z.string(),
  config_key: z.string(),
  old_value: z.record(z.string(), z.unknown()).nullable(),
  new_value: z.record(z.string(), z.unknown()),
  effective_from: IsoTimestampSchema,
  apply_scope: ConfigScopeSchema,
  changed_by_admin_id: UuidSchema.nullable(),
  changed_at: IsoTimestampSchema,
  change_note: z.string().nullable(),
});
export const ListAdminConfigHistoryQuerySchema = PaginationQuerySchema.extend({
  config_group: z.string().optional(),
  config_key: z.string().optional(),
});
export const ListAdminConfigHistoryResponseSchema = successEnvelope(
  paginatedPayload(AdminConfigHistoryItemSchema),
);
