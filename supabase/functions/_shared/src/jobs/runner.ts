/**
 * Job runner wrapper.
 *
 * Creates a `job_runs` row before `fn` runs, updates it after, and
 * captures errors into `error_message`. Services should never
 * insert into `job_runs` directly — always call `runJob`.
 */
import { JobRunStatus } from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { insertJobRun, type JobRunRow } from '../repos/job-runs';

export interface JobRunResult<T> {
  readonly run: JobRunRow;
  readonly result: T | null;
  readonly error: unknown;
}

export interface JobRunOptions<T> {
  readonly jobName: string;
  readonly jobKey?: string | null;
  readonly fn: () => Promise<T>;
  readonly extractCounts?: (result: T) => {
    rows_scanned?: number;
    rows_processed?: number;
    rows_failed?: number;
    detail?: Record<string, unknown>;
  };
}

export class JobRunner {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async run<T>(options: JobRunOptions<T>): Promise<JobRunResult<T>> {
    const startedAt = this.clock.nowIso();
    try {
      const result = await options.fn();
      const counts = options.extractCounts?.(result) ?? {};
      const run = await insertJobRun(this.db, {
        job_name: options.jobName,
        job_key: options.jobKey ?? null,
        status: JobRunStatus.Completed,
        started_at: startedAt,
        finished_at: this.clock.nowIso(),
        rows_scanned: counts.rows_scanned ?? 0,
        rows_processed: counts.rows_processed ?? 0,
        rows_failed: counts.rows_failed ?? 0,
        detail: counts.detail ?? null,
      });
      return { run, result, error: null };
    } catch (err) {
      const run = await insertJobRun(this.db, {
        job_name: options.jobName,
        job_key: options.jobKey ?? null,
        status: JobRunStatus.Failed,
        started_at: startedAt,
        finished_at: this.clock.nowIso(),
        rows_scanned: 0,
        rows_processed: 0,
        rows_failed: 0,
        error_message: err instanceof Error ? err.message : String(err),
      });
      return { run, result: null, error: err };
    }
  }
}
