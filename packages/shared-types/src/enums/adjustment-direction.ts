/**
 * Adjustment direction.
 *
 * Source of truth: 03_database_schema_spec.md §10.10
 *
 * - `credit`: increases future claimable balance (01 §15.6)
 * - `debit`: must be offset from future payable rewards (01 §15.7)
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const AdjustmentDirection = {
  Credit: 'credit',
  Debit: 'debit',
} as const;

export type AdjustmentDirection =
  (typeof AdjustmentDirection)[keyof typeof AdjustmentDirection];

export const ADJUSTMENT_DIRECTION_VALUES = [
  AdjustmentDirection.Credit,
  AdjustmentDirection.Debit,
] as const satisfies ReadonlyArray<AdjustmentDirection>;

export const isAdjustmentDirection = createEnumGuard(
  ADJUSTMENT_DIRECTION_VALUES,
);
