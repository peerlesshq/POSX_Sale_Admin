/**
 * Settlement job type.
 *
 * Source of truth: 03_database_schema_spec.md §10.2
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const SettlementJobType = {
  DailySettlement: 'daily_settlement',
  Recompute: 'recompute',
  Backfill: 'backfill',
} as const;

export type SettlementJobType =
  (typeof SettlementJobType)[keyof typeof SettlementJobType];

export const SETTLEMENT_JOB_TYPE_VALUES = [
  SettlementJobType.DailySettlement,
  SettlementJobType.Recompute,
  SettlementJobType.Backfill,
] as const satisfies ReadonlyArray<SettlementJobType>;

export const isSettlementJobType = createEnumGuard(
  SETTLEMENT_JOB_TYPE_VALUES,
);
