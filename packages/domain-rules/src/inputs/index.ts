/**
 * Normalized input types consumed by domain-rules compute functions.
 *
 * Config normalizers in `@posx/config/src/config-resolver/normalizers`
 * turn raw `ConfigVersionRow.config_value` JSON into these types.
 * Domain-rules functions then take them as parameters — no config or
 * DB lookups inside the compute layer.
 */
export * from './tier-definitions';
export * from './team-ladder';
export * from './equal-level-policy';
export * from './burn-policy';
export * from './qualification-policy';
export * from './vesting-policy';
export * from './claim-policy';
export * from './purchase-policy';
export * from './pricing';
