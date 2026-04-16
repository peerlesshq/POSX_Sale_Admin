/**
 * `report_export_jobs` repo — data access only.
 *
 * Extended in Phase 6 with transition helpers so the export worker
 * can mark jobs running / completed / failed without open-coding SQL.
 */
import type { ReportExportStatus, Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface ReportExportJobRow {
  id: Uuid;
  requested_by_admin_id: Uuid | null;
  report_type: string;
  status: ReportExportStatus;
  filters: Record<string, unknown> | null;
  file_path: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ReportExportJobInsertInput {
  requested_by_admin_id: Uuid | null;
  report_type: string;
  filters?: Record<string, unknown> | null;
  status?: ReportExportStatus;
}

export async function insertReportExportJob(
  db: DbClient,
  input: ReportExportJobInsertInput,
): Promise<ReportExportJobRow> {
  return db.queryRequired<ReportExportJobRow>(
    `insert into report_export_jobs (
        requested_by_admin_id, report_type, status, filters
      ) values ($1, $2, coalesce($3, 'queued'), $4::jsonb)
      returning *`,
    [
      input.requested_by_admin_id,
      input.report_type,
      input.status ?? null,
      input.filters ? JSON.stringify(input.filters) : null,
    ],
  );
}

export async function findReportExportJobById(
  db: DbClient,
  id: Uuid,
): Promise<ReportExportJobRow | null> {
  return db.queryOne<ReportExportJobRow>(
    `select * from report_export_jobs where id = $1`,
    [id],
  );
}

/**
 * Transition a job to `running`. Only valid from `queued`.
 * Throws if the row is in any other state.
 */
export async function markReportExportRunning(
  db: DbClient,
  id: Uuid,
): Promise<ReportExportJobRow> {
  const updated = await db.queryOne<ReportExportJobRow>(
    `update report_export_jobs
        set status = 'running'
      where id = $1 and status = 'queued'
      returning *`,
    [id],
  );
  if (!updated) {
    throw new Error(
      `report_export_jobs row not in queued state (id=${id}) — refusing to run`,
    );
  }
  return updated;
}

/**
 * Transition a job to `completed` and record where the payload lives.
 * Only valid from `running`.
 */
export async function markReportExportCompleted(
  db: DbClient,
  input: { id: Uuid; filePath: string; finishedAt: string },
): Promise<ReportExportJobRow> {
  const updated = await db.queryOne<ReportExportJobRow>(
    `update report_export_jobs
        set status = 'completed',
            file_path = $2,
            finished_at = $3
      where id = $1 and status = 'running'
      returning *`,
    [input.id, input.filePath, input.finishedAt],
  );
  if (!updated) {
    throw new Error(
      `report_export_jobs row not in running state (id=${input.id}) — refusing to complete`,
    );
  }
  return updated;
}

/**
 * Transition a job to `failed` with an error message. Valid from
 * either `queued` (never started) or `running` (crashed mid-flight).
 */
export async function markReportExportFailed(
  db: DbClient,
  input: { id: Uuid; errorMessage: string; finishedAt: string },
): Promise<ReportExportJobRow> {
  const updated = await db.queryOne<ReportExportJobRow>(
    `update report_export_jobs
        set status = 'failed',
            error_message = $2,
            finished_at = $3
      where id = $1 and status in ('queued', 'running')
      returning *`,
    [input.id, input.errorMessage, input.finishedAt],
  );
  if (!updated) {
    throw new Error(
      `report_export_jobs row not in queued/running state (id=${input.id}) — refusing to fail`,
    );
  }
  return updated;
}
