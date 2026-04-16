/**
 * Supabase-backed `ConfigResolver` implementation.
 *
 * Fetches rows from `config_versions` via the repo, maps them to the
 * resolver's `ConfigVersionRow` shape, and delegates selection to the
 * pure `selectMostRecentApplicable` helper in `@posx/config`.
 *
 * Caching strategy: Phase 4 ships a small in-memory cache keyed on
 * `(group, key, evaluationTime bucket)` with a 60-second TTL. Config
 * changes default to next-UTC-day effectiveness, so a one-minute
 * cache cannot surface a stale version in any scope that matters.
 * Cache is flushed automatically whenever `insertConfigVersion` is
 * called through `ConfigMutationService` (Phase 4), via the
 * `invalidate()` method.
 */
import {
  type ConfigGroup,
  type Uuid,
} from '@posx/shared-types';
import {
  type ConfigResolveInput,
  type ConfigResolveResult,
  type ConfigResolver,
  type ConfigVersionRow as DomainConfigVersionRow,
  selectMostRecentApplicable,
} from '@posx/config';
import { asIsoTimestamp } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { listConfigVersionsForKey } from '../repos/config-versions';

interface CacheEntry {
  readonly rows: ReadonlyArray<DomainConfigVersionRow>;
  readonly fetchedAt: number;
}

function cacheKey(group: ConfigGroup, key: string): string {
  return `${group}::${key}`;
}

function mapRowToDomain(row: {
  id: Uuid;
  config_group: string;
  config_key: string;
  version_no: number;
  config_value: Record<string, unknown>;
  effective_from: unknown;
  apply_scope: string;
  status: string;
  description: string | null;
  created_at: unknown;
}): DomainConfigVersionRow {
  return {
    id: row.id,
    config_group: row.config_group as DomainConfigVersionRow['config_group'],
    config_key: row.config_key,
    version_no: row.version_no,
    config_value: row.config_value,
    effective_from: asIsoTimestamp(row.effective_from as Date | string),
    apply_scope: row.apply_scope as DomainConfigVersionRow['apply_scope'],
    status: row.status as DomainConfigVersionRow['status'],
    description: row.description,
    created_at: asIsoTimestamp(row.created_at as Date | string),
  };
}

export class DbConfigResolver implements ConfigResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(
    private readonly db: DbClient,
    options: { ttlMs?: number } = {},
  ) {
    this.ttlMs = options.ttlMs ?? 60_000;
  }

  async resolve(input: ConfigResolveInput): Promise<DomainConfigVersionRow | null> {
    const rows = await this.loadRows(input.group, input.key);
    return selectMostRecentApplicable(rows, input.context);
  }

  async resolveMany(
    inputs: ReadonlyArray<ConfigResolveInput>,
  ): Promise<ReadonlyArray<ConfigResolveResult>> {
    const results: ConfigResolveResult[] = [];
    for (const input of inputs) {
      const rows = await this.loadRows(input.group, input.key);
      results.push({
        input,
        version: selectMostRecentApplicable(rows, input.context),
      });
    }
    return results;
  }

  /** Drop the in-memory cache. Call after writing new config versions. */
  invalidate(): void {
    this.cache.clear();
  }

  private async loadRows(
    group: ConfigGroup,
    key: string,
  ): Promise<ReadonlyArray<DomainConfigVersionRow>> {
    const ck = cacheKey(group, key);
    const cached = this.cache.get(ck);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.rows;
    }
    const raw = await listConfigVersionsForKey(this.db, group, key);
    const mapped = raw.map(mapRowToDomain);
    this.cache.set(ck, { rows: mapped, fetchedAt: Date.now() });
    return mapped;
  }
}
