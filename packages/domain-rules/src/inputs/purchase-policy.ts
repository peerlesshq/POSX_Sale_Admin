/**
 * Normalized purchase rules input.
 *
 * Source of truth: 09 §9.2 (`purchase_rules.*`).
 */
import type { AmountString } from '@posx/shared-types';

export interface PurchasePolicy {
  readonly minimum_purchase_amount: AmountString;
  /** Frontend quick-amount buttons (display-only for backend). */
  readonly quick_amount_options: ReadonlyArray<AmountString>;
}
