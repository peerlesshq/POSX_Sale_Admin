/**
 * State transition guards for every critical lifecycle object.
 *
 * Each module exports a pair of functions:
 *   - `canTransitionX(from, to): boolean`
 *   - `assertXTransition(from, to): void`  (throws on forbidden)
 *
 * The guards are pure functions that encode the transition tables in
 * `07_state_machines_and_exception_flows.md`. Services that mutate
 * state MUST go through the assertion variant so that forbidden
 * transitions fail loudly rather than silently.
 */
export * from './purchase-order';
export * from './chain-event';
export * from './claim-order';
export * from './reward-snapshot';
export * from './adjustment';
export * from './settlement-job';
export * from './vesting-lot';
export * from './user-status';
export * from './config-version';
