/**
 * Admin report endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §19.
 */
import { z } from 'zod';

import {
  AmountStringSchema,
  IsoTimestampSchema,
  RateStringSchema,
  UtcDateSchema,
  UuidSchema,
  WalletAddressSchema,
} from '../common';
import { successEnvelope } from '../envelope';
import { DateRangeQuerySchema } from '../pagination';

// ---- GET /admin/reports/summary ----

export const ReportSummaryQuerySchema = DateRangeQuerySchema.extend({
  granularity: z.enum(['day', 'week', 'month']).optional(),
});

export const ReportSummaryTotalsSchema = z.object({
  deposit_total: AmountStringSchema,
  direct_reward_total: AmountStringSchema,
  team_reward_total: AmountStringSchema,
  equal_level_reward_total: AmountStringSchema,
  burn_total: AmountStringSchema,
  claim_total: AmountStringSchema,
});

export const ReportSummarySeriesItemSchema = z.object({
  date: UtcDateSchema,
  deposit_total: AmountStringSchema,
  team_reward_total: AmountStringSchema,
});

export const ReportSummaryDataSchema = z.object({
  totals: ReportSummaryTotalsSchema,
  series: z.array(ReportSummarySeriesItemSchema),
});
export const GetReportSummaryResponseSchema = successEnvelope(ReportSummaryDataSchema);

// ---- GET /admin/reports/rankings/team ----

export const TeamRankingItemSchema = z.object({
  wallet_address: WalletAddressSchema,
  team_total_performance: AmountStringSchema,
  current_tier: z.string().nullable(),
  team_rate: RateStringSchema,
});
export const TeamRankingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  snapshot_date: UtcDateSchema.optional(),
});
export const GetTeamRankingDataSchema = z.object({
  items: z.array(TeamRankingItemSchema),
});
export const GetTeamRankingResponseSchema = successEnvelope(GetTeamRankingDataSchema);

// ---- POST /admin/reports/export ----

export const CreateReportExportRequestSchema = z.object({
  report_type: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
});
export const CreateReportExportDataSchema = z.object({
  report_export_job_id: UuidSchema,
  status: z.string(),
});
export const CreateReportExportResponseSchema = successEnvelope(CreateReportExportDataSchema);

// ---- GET /admin/reports/export/{id} ----

export const GetReportExportDataSchema = z.object({
  report_export_job_id: UuidSchema,
  status: z.string(),
  file_path: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: IsoTimestampSchema,
  finished_at: IsoTimestampSchema.nullable(),
});
export const GetReportExportResponseSchema = successEnvelope(GetReportExportDataSchema);
