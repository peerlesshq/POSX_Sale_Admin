/**
 * Adjustment type.
 *
 * Source of truth: 03_database_schema_spec.md §10.10
 *
 * Adjustments are the *only* supported mechanism for financial correction
 * after claimed history exists (01 §15.5, 07 §35). Destructive overwrite
 * is forbidden.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const AdjustmentType = {
  RecomputeDiff: 'recompute_diff',
  PurchaseReversalOffset: 'purchase_reversal_offset',
  ManualFinancialCorrection: 'manual_financial_correction',
} as const;

export type AdjustmentType =
  (typeof AdjustmentType)[keyof typeof AdjustmentType];

export const ADJUSTMENT_TYPE_VALUES = [
  AdjustmentType.RecomputeDiff,
  AdjustmentType.PurchaseReversalOffset,
  AdjustmentType.ManualFinancialCorrection,
] as const satisfies ReadonlyArray<AdjustmentType>;

export const isAdjustmentType = createEnumGuard(ADJUSTMENT_TYPE_VALUES);
