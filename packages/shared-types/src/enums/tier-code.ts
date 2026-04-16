/**
 * User tier code.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §4.4
 *   - 09_config_center_spec.md §9.4
 *
 * "None" is intentionally NOT stored — it represents the absence of tier
 * qualification and is modelled as `null` in DTOs.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const TierCode = {
  Basic: 'basic',
  Advanced: 'advanced',
  Elite: 'elite',
} as const;

export type TierCode = (typeof TierCode)[keyof typeof TierCode];

export const TIER_CODE_VALUES = [
  TierCode.Basic,
  TierCode.Advanced,
  TierCode.Elite,
] as const satisfies ReadonlyArray<TierCode>;

export const isTierCode = createEnumGuard(TIER_CODE_VALUES);
