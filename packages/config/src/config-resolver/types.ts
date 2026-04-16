/**
 * ConfigResolver public contract.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §11 (versioning + effectiveness)
 *   - 09_config_center_spec.md §7 (resolution priority and historical
 *     integrity)
 *
 * ---------------------------------------------------------------------------
 * ARCHITECTURAL RULE
 * ---------------------------------------------------------------------------
 * Business modules MUST read mutable configuration through this
 * interface. No business handler is allowed to `SELECT * FROM
 * config_versions` directly and patch together its own resolution
 * logic. Violating this means settlement-day vs latest-version bugs
 * become impossible to reason about.
 *
 * Phase 2 ships the interface + pure scope helper only. The concrete
 * backend-wired implementation (reading from Supabase) is delivered in
 * Phase 4 alongside the repository layer.
 * ---------------------------------------------------------------------------
 */
import {
  type ApplyScope,
  ConfigGroup,
  type ConfigVersionStatus,
  type IsoTimestamp,
  type Uuid,
  type UtcDate,
  type WalletAddress,
} from '@posx/shared-types';

// Re-export ConfigGroup as a VALUE so downstream consumers
// (`@posx/backend-core` services) can use it in both type position
// (`config_group: ConfigGroup`) and value position
// (`group: ConfigGroup.ClaimRules`). The `import type` that was here
// before erased the value at compile time, causing 6 pre-existing
// "has no exported member" errors in _shared.
export { ConfigGroup };

/**
 * Semi-structured JSON value used by config row payloads. Concrete
 * shape validation lives inside the domain rules / service that
 * consumes a particular config key.
 */
export type ConfigValue = Readonly<Record<string, unknown>>;

/**
 * Structural shape of a row from `config_versions`. Kept as a plain
 * readonly interface so it can be constructed from either a live DB
 * row or an in-memory fixture.
 */
export interface ConfigVersionRow {
  readonly id: Uuid;
  readonly config_group: ConfigGroup;
  readonly config_key: string;
  readonly version_no: number;
  readonly config_value: ConfigValue;
  readonly effective_from: IsoTimestamp;
  readonly apply_scope: ApplyScope;
  readonly status: ConfigVersionStatus;
  readonly description: string | null;
  readonly created_at: IsoTimestamp;
}

/**
 * Context consumed by the resolver to decide which version applies.
 *
 * `evaluationTime` is the one required field — everything else is
 * scope-dependent. A historical recompute should pass the original
 * settlement day's `evaluationTime` so that the resolver sees only
 * versions that were effective at that instant.
 *
 * Callers that need a `next_settlement_day`-scoped resolution must
 * pass `settlementDate`. Callers that need a `new_users_only` or
 * `new_orders_only` resolution must pass `userCreatedAt` /
 * `orderCreatedAt` respectively.
 */
export interface ConfigResolutionContext {
  readonly evaluationTime: IsoTimestamp;
  readonly settlementDate?: UtcDate;
  readonly userCreatedAt?: IsoTimestamp;
  readonly userWalletAddress?: WalletAddress;
  readonly orderCreatedAt?: IsoTimestamp;
}

export interface ConfigResolveInput {
  readonly group: ConfigGroup;
  readonly key: string;
  readonly context: ConfigResolutionContext;
}

export interface ConfigResolveResult {
  readonly input: ConfigResolveInput;
  readonly version: ConfigVersionRow | null;
}

/**
 * The async resolver interface. Phase 4 will supply a Supabase-backed
 * implementation; tests can substitute an in-memory version by
 * providing `ConfigVersionRow[]` fixtures.
 */
export interface ConfigResolver {
  /**
   * Resolve one config key and return the applicable version, or
   * `null` if no version matches the context.
   */
  resolve(input: ConfigResolveInput): Promise<ConfigVersionRow | null>;

  /**
   * Resolve a batch of config keys with a consistent context object.
   * Implementations should preserve input order.
   */
  resolveMany(
    inputs: ReadonlyArray<ConfigResolveInput>,
  ): Promise<ReadonlyArray<ConfigResolveResult>>;
}
