/**
 * Generic background job run status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §14.2
 *   - 07_state_machines_and_exception_flows.md §24
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const JobRunStatus = {
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Partial: 'partial',
  Cancelled: 'cancelled',
} as const;

export type JobRunStatus = (typeof JobRunStatus)[keyof typeof JobRunStatus];

export const JOB_RUN_STATUS_VALUES = [
  JobRunStatus.Running,
  JobRunStatus.Completed,
  JobRunStatus.Failed,
  JobRunStatus.Partial,
  JobRunStatus.Cancelled,
] as const satisfies ReadonlyArray<JobRunStatus>;

export const isJobRunStatus = createEnumGuard(JOB_RUN_STATUS_VALUES);
