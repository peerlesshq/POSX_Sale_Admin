/**
 * Normalized vesting policy input.
 *
 * Source of truth: 01 §9 and 09 §9.8 (`vesting_rules.vesting_policy`).
 */
export const VestingMode = {
  LotBased: 'lot_based',
} as const;

export type VestingMode = (typeof VestingMode)[keyof typeof VestingMode];

export interface VestingPolicy {
  readonly lock_days: number;
  readonly release_days: number;
  readonly mode: VestingMode;
}
