/**
 * Chain event lifecycle status.
 *
 * Sources of truth:
 *   - 03_database_schema_spec.md §9.5
 *   - 07_state_machines_and_exception_flows.md §11
 *
 * Transitions (summary):
 *   observed  -> confirmed | reverted
 *   confirmed -> processed | failed_processing
 *   failed_processing -> processed (via safe retry)
 *   failed_processing -> reverted  (only if unfinalized and later invalidated)
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ChainEventStatus = {
  Observed: 'observed',
  Confirmed: 'confirmed',
  Processed: 'processed',
  Reverted: 'reverted',
  FailedProcessing: 'failed_processing',
} as const;

export type ChainEventStatus =
  (typeof ChainEventStatus)[keyof typeof ChainEventStatus];

export const CHAIN_EVENT_STATUS_VALUES = [
  ChainEventStatus.Observed,
  ChainEventStatus.Confirmed,
  ChainEventStatus.Processed,
  ChainEventStatus.Reverted,
  ChainEventStatus.FailedProcessing,
] as const satisfies ReadonlyArray<ChainEventStatus>;

export const isChainEventStatus = createEnumGuard(CHAIN_EVENT_STATUS_VALUES);

/**
 * Terminal chain event states (07 §11.3). `failed_processing` is NOT
 * terminal — it may be retried safely if processing is idempotent.
 */
export const CHAIN_EVENT_TERMINAL_STATES = [
  ChainEventStatus.Processed,
  ChainEventStatus.Reverted,
] as const satisfies ReadonlyArray<ChainEventStatus>;
