/**
 * Vesting lot lifecycle status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §11.1
 *   - 07_state_machines_and_exception_flows.md §13
 *
 * Vesting uses the **lot model** (01 §9.1): each confirmed purchase
 * generates exactly one independent lot. Weighted-average merging is
 * forbidden.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const VestingLotStatus = {
  Active: 'active',
  Completed: 'completed',
  Voided: 'voided',
} as const;

export type VestingLotStatus =
  (typeof VestingLotStatus)[keyof typeof VestingLotStatus];

export const VESTING_LOT_STATUS_VALUES = [
  VestingLotStatus.Active,
  VestingLotStatus.Completed,
  VestingLotStatus.Voided,
] as const satisfies ReadonlyArray<VestingLotStatus>;

export const isVestingLotStatus = createEnumGuard(VESTING_LOT_STATUS_VALUES);
