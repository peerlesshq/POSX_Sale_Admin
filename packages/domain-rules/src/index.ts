/**
 * @posx/domain-rules — public API.
 *
 * Rules for this package (permanent):
 *   1. No database, RPC, or I/O access. Pure functions only.
 *   2. Consumes normalized input types from `./inputs`. Raw
 *      `config_value` JSON is NEVER parsed here — the config
 *      package does that and hands over typed objects.
 *   3. Must be safe to import from backend services, tests, and
 *      (where explicitly needed) frontend display-only helpers.
 *   4. No frontend may re-implement any formula that lives here.
 */
export * from './inputs';
export * from './qualification';
export * from './tier';
export * from './team-rate';
export * from './team-differential';
export * from './equal-level';
export * from './burn';
export * from './user-capabilities';
export * from './state-guards';
