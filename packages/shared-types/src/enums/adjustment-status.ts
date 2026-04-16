/**
 * Adjustment record status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §10.10
 *   - 07_state_machines_and_exception_flows.md §19
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const AdjustmentStatus = {
  Active: 'active',
  FullyOffset: 'fully_offset',
  Voided: 'voided',
} as const;

export type AdjustmentStatus =
  (typeof AdjustmentStatus)[keyof typeof AdjustmentStatus];

export const ADJUSTMENT_STATUS_VALUES = [
  AdjustmentStatus.Active,
  AdjustmentStatus.FullyOffset,
  AdjustmentStatus.Voided,
] as const satisfies ReadonlyArray<AdjustmentStatus>;

export const isAdjustmentStatus = createEnumGuard(ADJUSTMENT_STATUS_VALUES);
