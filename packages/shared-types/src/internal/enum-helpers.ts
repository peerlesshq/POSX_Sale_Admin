/**
 * Internal helper for building string-union enum type guards.
 *
 * The project avoids native PostgreSQL enums (see 03 §4) and models enums as
 * constrained text + TypeScript const objects. This helper produces a
 * `(value: unknown) => value is T` guard from the list of valid values.
 *
 * Not part of the public API of `@posx/shared-types`. Enum modules import
 * this file directly from `../internal/enum-helpers`.
 */
export function createEnumGuard<T extends string>(
  values: ReadonlyArray<T>,
): (value: unknown) => value is T {
  const set = new Set<string>(values as readonly string[]);
  return (value: unknown): value is T =>
    typeof value === 'string' && set.has(value);
}
