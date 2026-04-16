/**
 * Referral pending-capture source.
 *
 * Source of truth: 03_database_schema_spec.md §8.1
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const CaptureSource = {
  ReferralLink: 'referral_link',
  ManualSeed: 'manual_seed',
  Import: 'import',
} as const;

export type CaptureSource = (typeof CaptureSource)[keyof typeof CaptureSource];

export const CAPTURE_SOURCE_VALUES = [
  CaptureSource.ReferralLink,
  CaptureSource.ManualSeed,
  CaptureSource.Import,
] as const satisfies ReadonlyArray<CaptureSource>;

export const isCaptureSource = createEnumGuard(CAPTURE_SOURCE_VALUES);
