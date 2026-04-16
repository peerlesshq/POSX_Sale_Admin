/**
 * Structured diff for config values.
 *
 * Compares two `config_value` payloads and produces a flat list of
 * path-keyed diff entries. `ConfigDiffViewer` renders each entry with
 * a visual marker (added / removed / changed / unchanged).
 *
 * Algorithm:
 *   - Walk both trees in lockstep.
 *   - At each level, union the key sets.
 *   - If both sides are plain objects, recurse.
 *   - If both sides are arrays of primitives, compare by stringified
 *     JSON (array equality is intentional — we don't want per-index
 *     noise for user-visible enumerations like languages or themes).
 *   - Otherwise, compare by `===` or deep JSON-equality for objects.
 *
 * The walker returns entries with dotted paths like `tiers[2].direct_rate`
 * which the renderer uses for display and grouping.
 */

export type ConfigDiffKind =
  | 'added'
  | 'removed'
  | 'changed'
  | 'unchanged';

export interface ConfigDiffEntry {
  readonly path: string;
  readonly kind: ConfigDiffKind;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

type AnyRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is AnyRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isArrayOfPrimitives(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (v) => v === null || typeof v !== 'object',
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function join(base: string, seg: string, isIndex = false): string {
  if (!base) return isIndex ? `[${seg}]` : seg;
  if (isIndex) return `${base}[${seg}]`;
  return `${base}.${seg}`;
}

/* --------------------------------------------------------------------- */
/*  Walker                                                               */
/* --------------------------------------------------------------------- */

function walk(
  base: string,
  oldValue: unknown,
  newValue: unknown,
  out: ConfigDiffEntry[],
): void {
  const oldMissing = oldValue === undefined;
  const newMissing = newValue === undefined;

  if (oldMissing && newMissing) return;
  if (oldMissing) {
    out.push({ path: base, kind: 'added', oldValue: undefined, newValue });
    return;
  }
  if (newMissing) {
    out.push({ path: base, kind: 'removed', oldValue, newValue: undefined });
    return;
  }

  // Both sides plain object → recurse per key.
  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = new Set<string>([
      ...Object.keys(oldValue),
      ...Object.keys(newValue),
    ]);
    const sorted = [...keys].sort();
    for (const k of sorted) {
      walk(join(base, k), oldValue[k], newValue[k], out);
    }
    return;
  }

  // Both sides arrays (mixed content) → pair by index.
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    // Primitive-only arrays: compare as whole units.
    if (isArrayOfPrimitives(oldValue) && isArrayOfPrimitives(newValue)) {
      if (deepEqual(oldValue, newValue)) {
        out.push({ path: base, kind: 'unchanged', oldValue, newValue });
      } else {
        out.push({ path: base, kind: 'changed', oldValue, newValue });
      }
      return;
    }
    const len = Math.max(oldValue.length, newValue.length);
    for (let i = 0; i < len; i += 1) {
      walk(join(base, String(i), true), oldValue[i], newValue[i], out);
    }
    return;
  }

  // Leaf comparison.
  if (deepEqual(oldValue, newValue)) {
    out.push({ path: base, kind: 'unchanged', oldValue, newValue });
  } else {
    out.push({ path: base, kind: 'changed', oldValue, newValue });
  }
}

/* --------------------------------------------------------------------- */
/*  Public API                                                           */
/* --------------------------------------------------------------------- */

export function diffConfigValue(
  oldValue: unknown,
  newValue: unknown,
): readonly ConfigDiffEntry[] {
  const out: ConfigDiffEntry[] = [];
  walk('', oldValue, newValue, out);
  return out;
}

/** Counts of changed / added / removed entries. Unchanged excluded. */
export interface ConfigDiffSummary {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly total: number;
  readonly hasChanges: boolean;
}

export function summarizeDiff(
  entries: readonly ConfigDiffEntry[],
): ConfigDiffSummary {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const e of entries) {
    if (e.kind === 'added') added += 1;
    else if (e.kind === 'removed') removed += 1;
    else if (e.kind === 'changed') changed += 1;
  }
  const total = added + removed + changed;
  return { added, removed, changed, total, hasChanges: total > 0 };
}

/**
 * Filter entries to only the "interesting" changes (non-unchanged).
 * Used by the diff viewer's default "changes only" view.
 */
export function keepChanged(
  entries: readonly ConfigDiffEntry[],
): readonly ConfigDiffEntry[] {
  return entries.filter((e) => e.kind !== 'unchanged');
}
