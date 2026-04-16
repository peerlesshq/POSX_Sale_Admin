/**
 * Domain type re-exports.
 *
 * Phase 2 intentionally exports only the holding service contract. Other
 * domain entity types (user, purchase, reward, claim, etc.) will be added
 * in Phase 3 alongside their database migrations and repository layer.
 */
export * from './holding';
