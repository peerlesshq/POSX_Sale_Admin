/**
 * @posx/api-contracts — public API.
 *
 * Phase 2 exports:
 *   - common primitive schemas (amount, address, tx hash, timestamps, uuid)
 *   - envelope builders (success + error + discriminated union)
 *   - pagination + date range helpers
 *   - header schemas (bearer auth, idempotency key)
 *
 * Endpoint-specific schemas are added in Phase 4 under `./endpoints/`.
 */
export * from './common';
export * from './envelope';
export * from './pagination';
export * from './headers';
