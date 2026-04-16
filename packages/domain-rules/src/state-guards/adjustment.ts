/**
 * Adjustment record state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §19
 */
import {
  AdjustmentStatus,
  type AdjustmentStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [AdjustmentStatus.Active]: [
    AdjustmentStatus.FullyOffset,
    AdjustmentStatus.Voided,
  ],
  [AdjustmentStatus.FullyOffset]: [],
  [AdjustmentStatus.Voided]: [],
};

export function canTransitionAdjustment(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertAdjustmentTransition(from: Status, to: Status): void {
  if (!canTransitionAdjustment(from, to)) {
    throw new Error(`Forbidden adjustment transition: ${from} -> ${to}`);
  }
}
