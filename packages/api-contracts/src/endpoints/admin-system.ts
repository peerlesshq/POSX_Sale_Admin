/**
 * Admin system endpoint contracts (chain-sync, jobs, health, logs).
 *
 * Source of truth: 04_api_spec.md §20.
 */
import { z } from 'zod';

import {
  IsoTimestampSchema,
  UuidSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  DateRangeQuerySchema,
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- GET /admin/system/chain-sync ----

export const ChainSyncStateItemSchema = z.object({
  chain_id: z.number().int().positive(),
  contract_address: z.string(),
  sync_key: z.string(),
  last_scanned_block: z.number().int().nonnegative(),
  last_confirmed_block: z.number().int().nonnegative(),
  last_scanned_at: IsoTimestampSchema.nullable(),
  updated_at: IsoTimestampSchema,
});
export const GetChainSyncStateDataSchema = z.object({
  items: z.array(ChainSyncStateItemSchema),
});
export const GetChainSyncStateResponseSchema = successEnvelope(GetChainSyncStateDataSchema);

// ---- GET /admin/system/jobs ----

export const JobRunItemSchema = z.object({
  job_run_id: UuidSchema,
  job_name: z.string(),
  status: z.string(),
  started_at: IsoTimestampSchema,
  finished_at: IsoTimestampSchema.nullable(),
  rows_scanned: z.number().int().nonnegative(),
  rows_processed: z.number().int().nonnegative(),
  rows_failed: z.number().int().nonnegative(),
  error_message: z.string().nullable(),
});
export const ListJobRunsQuerySchema = PaginationQuerySchema.extend({
  job_name: z.string().optional(),
  status: z.string().optional(),
});
export const ListJobRunsResponseSchema = successEnvelope(paginatedPayload(JobRunItemSchema));

// ---- GET /admin/system/health ----

export const HealthCheckItemSchema = z.object({
  health_key: z.string(),
  status: z.enum(['ok', 'warn', 'error']),
  checked_at: IsoTimestampSchema,
  detail: z.record(z.string(), z.unknown()).nullable(),
});
export const GetSystemHealthDataSchema = z.object({
  checks: z.array(HealthCheckItemSchema),
});
export const GetSystemHealthResponseSchema = successEnvelope(GetSystemHealthDataSchema);

// ---- GET /admin/logs ----

export const AdminLogItemSchema = z.object({
  admin_log_id: UuidSchema,
  admin_user_id: UuidSchema.nullable(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  ip_address: z.string().nullable(),
  created_at: IsoTimestampSchema,
});
export const ListAdminLogsQuerySchema = PaginationQuerySchema.merge(DateRangeQuerySchema).extend({
  admin_user_id: z.string().optional(),
  action: z.string().optional(),
  target_type: z.string().optional(),
});
export const ListAdminLogsResponseSchema = successEnvelope(paginatedPayload(AdminLogItemSchema));
