/**
 * Pure derivation helpers for the Config Center.
 *
 * All logic in this file operates on the raw `ConfigVersion[]` array
 * returned by the backend and produces the index structures the page
 * uses to render:
 *
 *   - groupIndex: Record<group, ConfigKeyBucket[]>
 *   - ConfigKeyBucket = { key, current, future[], history[] }
 *
 * Bucketing rules — matching `09_config_center_spec.md` semantics:
 *
 *   - current = latest active version with effective_from <= now
 *     (the one the resolver would pick right now)
 *   - future  = active versions with effective_from > now
 *     (scheduled, not yet effective)
 *   - history = every other version (superseded, disabled, and any
 *     older active that has been succeeded by a newer active)
 *
 * "now" is injected as a parameter to keep the function pure and
 * testable. The page uses `new Date()` at call time.
 *
 * These helpers do not mutate their inputs.
 */

export interface ConfigVersionLike {
  readonly config_version_id: string;
  readonly config_group: string;
  readonly config_key: string;
  readonly version_no: number;
  readonly config_value: Record<string, unknown>;
  readonly effective_from: string;
  readonly apply_scope: string;
  readonly status: 'draft' | 'active' | 'superseded' | 'disabled';
  readonly description?: string;
  readonly created_by?: string;
  readonly created_at?: string;
}

export interface ConfigKeyBucket {
  readonly group: string;
  readonly key: string;
  /** The version a resolver would return right now, if any. */
  readonly current: ConfigVersionLike | null;
  /**
   * Active versions scheduled for the future (effective_from > now),
   * sorted ascending by effective_from.
   */
  readonly future: readonly ConfigVersionLike[];
  /**
   * Everything else: superseded, disabled, draft, and any older
   * active records that have been replaced by a newer active.
   * Sorted descending by effective_from (newest first).
   */
  readonly history: readonly ConfigVersionLike[];
  /** The most recent effective_from across all versions in this bucket. */
  readonly lastUpdated: string;
  /** Total version count for the key (current + future + history). */
  readonly versionCount: number;
}

export interface GroupIndexEntry {
  readonly group: string;
  readonly buckets: readonly ConfigKeyBucket[];
  readonly keyCount: number;
  readonly futureCount: number;
  readonly lastUpdated: string;
}

/* --------------------------------------------------------------------- */
/*  Bucket a single key's versions                                       */
/* --------------------------------------------------------------------- */

function bucketKeyVersions(
  group: string,
  key: string,
  versions: readonly ConfigVersionLike[],
  now: number,
): ConfigKeyBucket {
  // Sort desc by effective_from; tie-break on version_no desc.
  const sorted = [...versions].sort((a, b) => {
    const at = Date.parse(a.effective_from);
    const bt = Date.parse(b.effective_from);
    if (bt !== at) return bt - at;
    return b.version_no - a.version_no;
  });

  const futureList: ConfigVersionLike[] = [];
  const pastActive: ConfigVersionLike[] = [];
  const nonActive: ConfigVersionLike[] = [];

  for (const v of sorted) {
    const t = Date.parse(v.effective_from);
    if (v.status === 'active') {
      if (t > now) {
        futureList.push(v);
      } else {
        pastActive.push(v);
      }
    } else {
      nonActive.push(v);
    }
  }

  // Current = most recent past-active. Anything older is history.
  const [current = null, ...olderActive] = pastActive;

  // Future list stored ascending by effective_from (nearest first)
  const future = [...futureList].sort(
    (a, b) => Date.parse(a.effective_from) - Date.parse(b.effective_from),
  );

  // History = older active + non-active records. Already desc by sort.
  const history = [...olderActive, ...nonActive].sort((a, b) => {
    const at = Date.parse(a.effective_from);
    const bt = Date.parse(b.effective_from);
    if (bt !== at) return bt - at;
    return b.version_no - a.version_no;
  });

  // Last updated = max effective_from across all versions.
  const lastUpdated = sorted.length
    ? sorted[0]!.effective_from
    : new Date(now).toISOString();

  return {
    group,
    key,
    current,
    future,
    history,
    lastUpdated,
    versionCount: sorted.length,
  };
}

/* --------------------------------------------------------------------- */
/*  Index by group + key                                                 */
/* --------------------------------------------------------------------- */

export function deriveGroupIndex(
  versions: readonly ConfigVersionLike[],
  now: number = Date.now(),
): readonly GroupIndexEntry[] {
  // Partition by (group, key)
  const byGroup = new Map<string, Map<string, ConfigVersionLike[]>>();
  for (const v of versions) {
    let perGroup = byGroup.get(v.config_group);
    if (!perGroup) {
      perGroup = new Map();
      byGroup.set(v.config_group, perGroup);
    }
    let perKey = perGroup.get(v.config_key);
    if (!perKey) {
      perKey = [];
      perGroup.set(v.config_key, perKey);
    }
    perKey.push(v);
  }

  const entries: GroupIndexEntry[] = [];
  for (const [group, perGroup] of byGroup) {
    const buckets: ConfigKeyBucket[] = [];
    let futureCount = 0;
    let lastUpdated = '';
    for (const [key, perKeyVersions] of perGroup) {
      const bucket = bucketKeyVersions(group, key, perKeyVersions, now);
      buckets.push(bucket);
      futureCount += bucket.future.length;
      if (
        !lastUpdated ||
        Date.parse(bucket.lastUpdated) > Date.parse(lastUpdated)
      ) {
        lastUpdated = bucket.lastUpdated;
      }
    }
    // Stable key order — alphabetical
    buckets.sort((a, b) => a.key.localeCompare(b.key));
    entries.push({
      group,
      buckets,
      keyCount: buckets.length,
      futureCount,
      lastUpdated: lastUpdated || new Date(now).toISOString(),
    });
  }
  return entries;
}

/** Convenience lookup: flatten the index into `group → entry`. */
export function groupIndexMap(
  entries: readonly GroupIndexEntry[],
): ReadonlyMap<string, GroupIndexEntry> {
  const m = new Map<string, GroupIndexEntry>();
  for (const e of entries) m.set(e.group, e);
  return m;
}

/** Find a single bucket by (group, key). */
export function findBucket(
  entries: readonly GroupIndexEntry[],
  group: string,
  key: string,
): ConfigKeyBucket | null {
  const entry = entries.find((e) => e.group === group);
  if (!entry) return null;
  return entry.buckets.find((b) => b.key === key) ?? null;
}
