/**
 * Vesting lot state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §13
 */
import {
  VestingLotStatus,
  type VestingLotStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [VestingLotStatus.Active]: [
    VestingLotStatus.Completed,
    VestingLotStatus.Voided,
  ],
  [VestingLotStatus.Completed]: [],
  [VestingLotStatus.Voided]: [],
};

export function canTransitionVestingLot(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertVestingLotTransition(from: Status, to: Status): void {
  if (!canTransitionVestingLot(from, to)) {
    throw new Error(`Forbidden vesting_lot transition: ${from} -> ${to}`);
  }
}
