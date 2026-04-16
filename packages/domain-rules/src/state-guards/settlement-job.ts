/**
 * Settlement job (and generic job run) state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §20 + §24
 */
import {
  SettlementJobStatus,
  type SettlementJobStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [SettlementJobStatus.Running]: [
    SettlementJobStatus.Completed,
    SettlementJobStatus.Failed,
    SettlementJobStatus.Partial,
    SettlementJobStatus.Cancelled,
  ],
  [SettlementJobStatus.Completed]: [],
  [SettlementJobStatus.Failed]: [],
  [SettlementJobStatus.Partial]: [],
  [SettlementJobStatus.Cancelled]: [],
};

export function canTransitionSettlementJob(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertSettlementJobTransition(from: Status, to: Status): void {
  if (!canTransitionSettlementJob(from, to)) {
    throw new Error(`Forbidden settlement_job transition: ${from} -> ${to}`);
  }
}
