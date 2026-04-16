/**
 * Purchase reversal type.
 *
 * Source of truth: 03_database_schema_spec.md §9.4
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const PurchaseReversalType = {
  DuplicatePayment: 'duplicate_payment',
  SystemError: 'system_error',
  Compliance: 'compliance',
  ManualException: 'manual_exception',
} as const;

export type PurchaseReversalType =
  (typeof PurchaseReversalType)[keyof typeof PurchaseReversalType];

export const PURCHASE_REVERSAL_TYPE_VALUES = [
  PurchaseReversalType.DuplicatePayment,
  PurchaseReversalType.SystemError,
  PurchaseReversalType.Compliance,
  PurchaseReversalType.ManualException,
] as const satisfies ReadonlyArray<PurchaseReversalType>;

export const isPurchaseReversalType = createEnumGuard(
  PURCHASE_REVERSAL_TYPE_VALUES,
);
