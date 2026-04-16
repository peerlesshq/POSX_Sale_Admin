/**
 * @posx/config — public API.
 *
 * Split into two sub-areas:
 *   - `./env`             — server env loader (zod schema + fail-fast
 *                           loader with a process-wide cache)
 *   - `./config-resolver` — ConfigResolver interface + pure scope
 *                           selection helpers. The live backend-wired
 *                           implementation is added in Phase 4.
 */
export * from './env';
export * from './config-resolver';
