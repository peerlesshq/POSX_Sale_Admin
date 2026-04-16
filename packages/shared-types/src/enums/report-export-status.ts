/**
 * Report export job status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §13.5
 *   - 07_state_machines_and_exception_flows.md §23
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ReportExportStatus = {
  Queued: 'queued',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
} as const;

export type ReportExportStatus =
  (typeof ReportExportStatus)[keyof typeof ReportExportStatus];

export const REPORT_EXPORT_STATUS_VALUES = [
  ReportExportStatus.Queued,
  ReportExportStatus.Running,
  ReportExportStatus.Completed,
  ReportExportStatus.Failed,
] as const satisfies ReadonlyArray<ReportExportStatus>;

export const isReportExportStatus = createEnumGuard(
  REPORT_EXPORT_STATUS_VALUES,
);
