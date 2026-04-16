/**
 * Settlement job run status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §10.2
 *   - 07_state_machines_and_exception_flows.md §20
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const SettlementJobStatus = {
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Partial: 'partial',
  Cancelled: 'cancelled',
} as const;

export type SettlementJobStatus =
  (typeof SettlementJobStatus)[keyof typeof SettlementJobStatus];

export const SETTLEMENT_JOB_STATUS_VALUES = [
  SettlementJobStatus.Running,
  SettlementJobStatus.Completed,
  SettlementJobStatus.Failed,
  SettlementJobStatus.Partial,
  SettlementJobStatus.Cancelled,
] as const satisfies ReadonlyArray<SettlementJobStatus>;

export const isSettlementJobStatus = createEnumGuard(
  SETTLEMENT_JOB_STATUS_VALUES,
);
