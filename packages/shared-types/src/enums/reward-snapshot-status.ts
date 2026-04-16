/**
 * Team / equal-level reward snapshot status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §10.3 and §10.5
 *   - 07_state_machines_and_exception_flows.md §14 and §15
 *
 * NOTE: the *lock* state during an in-flight claim is tracked by
 * `claim_order_id` on the snapshot row, not by an additional status
 * value (07 §14.4).
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const RewardSnapshotStatus = {
  Claimable: 'claimable',
  Claimed: 'claimed',
  Offset: 'offset',
  Voided: 'voided',
} as const;

export type RewardSnapshotStatus =
  (typeof RewardSnapshotStatus)[keyof typeof RewardSnapshotStatus];

export const REWARD_SNAPSHOT_STATUS_VALUES = [
  RewardSnapshotStatus.Claimable,
  RewardSnapshotStatus.Claimed,
  RewardSnapshotStatus.Offset,
  RewardSnapshotStatus.Voided,
] as const satisfies ReadonlyArray<RewardSnapshotStatus>;

export const isRewardSnapshotStatus = createEnumGuard(
  REWARD_SNAPSHOT_STATUS_VALUES,
);
