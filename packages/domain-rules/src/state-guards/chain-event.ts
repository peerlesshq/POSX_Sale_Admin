/**
 * Chain event state transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §11
 */
import {
  ChainEventStatus,
  type ChainEventStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [ChainEventStatus.Observed]: [
    ChainEventStatus.Confirmed,
    ChainEventStatus.Reverted,
  ],
  [ChainEventStatus.Confirmed]: [
    ChainEventStatus.Processed,
    ChainEventStatus.FailedProcessing,
  ],
  [ChainEventStatus.FailedProcessing]: [
    // Safe retry path (07 §11.4).
    ChainEventStatus.Processed,
    // Only if later chain invalidation proves event unusable AND no
    // business finalization occurred (07 §11.2).
    ChainEventStatus.Reverted,
  ],
  [ChainEventStatus.Processed]: [],
  [ChainEventStatus.Reverted]: [],
};

export function canTransitionChainEvent(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertChainEventTransition(from: Status, to: Status): void {
  if (!canTransitionChainEvent(from, to)) {
    throw new Error(`Forbidden chain_event transition: ${from} -> ${to}`);
  }
}
