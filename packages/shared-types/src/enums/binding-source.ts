/**
 * Referral binding source. Records how a referral binding was created so
 * audit reviewers can distinguish automatic bindings from admin imports
 * or manual corrections.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §10.8
 *   - 03_database_schema_spec.md §8.2
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const BindingSource = {
  ReferralLink: 'referral_link',
  AdminImport: 'admin_import',
  ManualCorrection: 'manual_correction',
} as const;

export type BindingSource = (typeof BindingSource)[keyof typeof BindingSource];

export const BINDING_SOURCE_VALUES = [
  BindingSource.ReferralLink,
  BindingSource.AdminImport,
  BindingSource.ManualCorrection,
] as const satisfies ReadonlyArray<BindingSource>;

export const isBindingSource = createEnumGuard(BINDING_SOURCE_VALUES);
