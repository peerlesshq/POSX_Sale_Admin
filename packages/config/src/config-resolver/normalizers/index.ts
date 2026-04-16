/**
 * Config value normalizers.
 *
 * Each normalizer takes the raw `config_value` (jsonb) of one config
 * key and produces the typed, validated input object consumed by
 * `@posx/domain-rules`. Normalizers are the ONLY place where
 * `config_value` JSON is parsed — domain-rules never touches raw JSON.
 *
 * The boundary is bidirectional by construction:
 *   - Config layer owns the zod schemas here
 *   - Domain-rules owns the normalized input types in
 *     `@posx/domain-rules/src/inputs`
 */
export * from './common';
export * from './pricing';
export * from './purchase-rules';
export * from './qualification-rules';
export * from './tier-rules';
export * from './team-reward-rules';
export * from './equal-level-rules';
export * from './burn-rules';
export * from './vesting-rules';
export * from './claim-rules';
