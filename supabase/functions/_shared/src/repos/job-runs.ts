/**
 * `job_runs` repo — data access only.
 */
import type { JobRunStatus, Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';

export interface JobRunRow {
  id: Uuid;
  job_name: string;
  job_key: string | null;
  status: JobRunStatus;
  started_at: string;
  finished_at: string | null;
  rows_scanned: number;
  rows_processed: number;
  rows_failed: number;
  detail: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
}

export interface JobRunInsertInput {
  job_name: string;
  job_key?: string | null;
  status: JobRunStatus;
  started_at: string;
  finished_at?: string | null;
  rows_scanned?: number;
  rows_processed?: number;
  rows_failed?: number;
  detail?: Record<string, unknown> | null;
  error_message?: string | null;
}

export async function insertJobRun(
  db: DbClient,
  input: JobRunInsertInput,
): Promise<JobRunRow> {
  return db.queryRequired<JobRunRow>(
    `insert into job_runs (
        job_name, job_key, status, started_at, finished_at,
        rows_scanned, rows_processed, rows_failed, detail, error_message
      ) values (
        $1, $2, $3, $4, $5,
        coalesce($6, 0), coalesce($7, 0), coalesce($8, 0),
        $9::jsonb, $10
      )
      returning *`,
    [
      input.job_name,
      input.job_key ?? null,
      input.status,
      input.started_at,
      input.finished_at ?? null,
      input.rows_scanned ?? null,
      input.rows_processed ?? null,
      input.rows_failed ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
      input.error_message ?? null,
    ],
  );
}
