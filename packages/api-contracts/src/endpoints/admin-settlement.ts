/**
 * Admin settlement + recompute endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §18.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  UtcDateSchema,
  UuidSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import {
  PaginationQuerySchema,
  paginatedPayload,
} from '../pagination';

// ---- POST /admin/settlement/trigger ----

export const TriggerSettlementRequestSchema = z.object({
  settlement_date: UtcDateSchema,
  mode: z.enum(['official', 'backfill']),
  reason: z.string().min(1),
});
export type TriggerSettlementRequest = z.infer<typeof TriggerSettlementRequestSchema>;

export const TriggerSettlementDataSchema = z.object({
  settlement_job_id: UuidSchema,
  job_type: z.string(),
  settlement_date: UtcDateSchema,
  status: z.string(),
});
export const TriggerSettlementResponseSchema = successEnvelope(TriggerSettlementDataSchema);

// ---- POST /admin/recompute/preview ----

export const RecomputePreviewRequestSchema = z.object({
  settlement_date: UtcDateSchema,
  reason: z.string().min(1),
});
export type RecomputePreviewRequest = z.infer<typeof RecomputePreviewRequestSchema>;

/**
 * BE-19 — the preview response now carries a per-user `diffs` array
 * so the admin knows exactly WHO is affected and by HOW MUCH before
 * confirming apply. The `summary` is an aggregate of the diff array.
 */
export const RecomputeDiffItemSchema = z.object({
  wallet_address: z.string(),
  direction: z.enum(['credit', 'debit']),
  amount: AmountStringSchema,
  source_table: z.string().optional(),
  source_snapshot_id: UuidSchema.optional(),
  detail: z.string().optional(),
});

export const RecomputePreviewDataSchema = z.object({
  settlement_job_id: UuidSchema,
  mode: z.literal('recompute_preview'),
  status: z.string(),
  summary: z.object({
    processed_user_count: z.number().int().nonnegative(),
    difference_count: z.number().int().nonnegative(),
    positive_difference_total: AmountStringSchema,
    negative_difference_total: AmountStringSchema,
  }),
  diffs: z.array(RecomputeDiffItemSchema),
});
export const RecomputePreviewResponseSchema = successEnvelope(RecomputePreviewDataSchema);

// ---- POST /admin/recompute/apply ----

/**
 * BE-20 — apply now requires `preview_settlement_job_id` so the
 * backend loads the stored diffs from the preview job instead of
 * accepting them from the client (prevents the client from
 * fabricating diffs that the preview never computed).
 */
export const RecomputeApplyRequestSchema = z.object({
  settlement_date: UtcDateSchema,
  reason: z.string().min(1),
  preview_settlement_job_id: UuidSchema,
});
export type RecomputeApplyRequest = z.infer<typeof RecomputeApplyRequestSchema>;

export const RecomputeApplyDataSchema = z.object({
  settlement_job_id: UuidSchema,
  mode: z.literal('recompute_apply_adjustment'),
  status: z.string(),
  applied_diff_count: z.number().int().nonnegative(),
});
export const RecomputeApplyResponseSchema = successEnvelope(RecomputeApplyDataSchema);

// ---- GET /admin/settlement/jobs ----

export const SettlementJobItemSchema = z.object({
  settlement_job_id: UuidSchema,
  job_type: z.string(),
  mode: z.string(),
  settlement_date: UtcDateSchema,
  status: z.string(),
  processed_user_count: z.number().int().nonnegative(),
  created_snapshot_count: z.number().int().nonnegative(),
  created_adjustment_count: z.number().int().nonnegative(),
  error_count: z.number().int().nonnegative(),
  started_at: IsoTimestampSchema,
  finished_at: IsoTimestampSchema.nullable(),
});
export const ListSettlementJobsQuerySchema = PaginationQuerySchema.extend({
  settlement_date: UtcDateSchema.optional(),
  job_type: z.string().optional(),
  status: z.string().optional(),
});
export const ListSettlementJobsResponseSchema = successEnvelope(
  paginatedPayload(SettlementJobItemSchema),
);

// ---- GET /admin/settlement/jobs/{id} ----

export const GetSettlementJobDetailDataSchema = SettlementJobItemSchema.extend({
  config_version_snapshot: z.record(z.string(), z.unknown()),
  error_sample: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().nullable(),
});
export const GetSettlementJobDetailResponseSchema = successEnvelope(
  GetSettlementJobDetailDataSchema,
);
