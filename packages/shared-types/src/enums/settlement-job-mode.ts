/**
 * Settlement job mode. Mode is distinct from `SettlementJobStatus`:
 * mode describes *what* the job is doing, status describes *how it
 * went*.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §10.2
 *   - 07_state_machines_and_exception_flows.md §20.4
 *
 * Mode semantics (01 §15):
 *   - `official`                    — the canonical daily settlement run
 *   - `backfill`                    — re-runs a missed historical day and
 *                                     produces formal official outputs
 *   - `recompute_preview`           — diff-only, mutates nothing
 *   - `recompute_apply_adjustment`  — writes adjustment records; never
 *                                     rewrites claimed history
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const SettlementJobMode = {
  Official: 'official',
  Backfill: 'backfill',
  RecomputePreview: 'recompute_preview',
  RecomputeApplyAdjustment: 'recompute_apply_adjustment',
} as const;

export type SettlementJobMode =
  (typeof SettlementJobMode)[keyof typeof SettlementJobMode];

export const SETTLEMENT_JOB_MODE_VALUES = [
  SettlementJobMode.Official,
  SettlementJobMode.Backfill,
  SettlementJobMode.RecomputePreview,
  SettlementJobMode.RecomputeApplyAdjustment,
] as const satisfies ReadonlyArray<SettlementJobMode>;

export const isSettlementJobMode = createEnumGuard(
  SETTLEMENT_JOB_MODE_VALUES,
);
