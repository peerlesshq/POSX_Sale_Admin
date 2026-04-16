/**
 * Team / equal-level reward snapshot state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §14 and §15
 *
 * Note: the lock state during an in-flight claim is represented by
 * `claim_order_id`, NOT by a different status value. Snapshots stay
 * `claimable` while locked; this guard does not concern itself with
 * locks.
 */
import {
  RewardSnapshotStatus,
  type RewardSnapshotStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [RewardSnapshotStatus.Claimable]: [
    RewardSnapshotStatus.Claimed,
    RewardSnapshotStatus.Offset,
    RewardSnapshotStatus.Voided,
  ],
  [RewardSnapshotStatus.Offset]: [
    // Recommended simpler rule (07 §14.2): if offset is partial,
    // keep status `claimable` with reduced remaining payable. If
    // fully offset, use `offset` terminal state. We still allow
    // `offset → claimed` in the guard for implementations that chose
    // the alternate model.
    RewardSnapshotStatus.Claimed,
  ],
  [RewardSnapshotStatus.Claimed]: [],
  [RewardSnapshotStatus.Voided]: [],
};

export function canTransitionRewardSnapshot(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertRewardSnapshotTransition(from: Status, to: Status): void {
  if (!canTransitionRewardSnapshot(from, to)) {
    throw new Error(`Forbidden reward_snapshot transition: ${from} -> ${to}`);
  }
}
