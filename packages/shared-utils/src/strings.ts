/**
 * Miscellaneous string helpers.
 */

export function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

export function truncate(value: string, max: number, suffix = '...'): string {
  if (max < 0) {
    throw new Error(`truncate() max must be >= 0, got ${max}`);
  }
  if (value.length <= max) return value;
  if (max <= suffix.length) return suffix.slice(0, max);
  return value.slice(0, max - suffix.length) + suffix;
}

/**
 * Exhaustiveness guard for `switch (x)` on discriminated unions. When
 * every case has been handled, the `default` branch calls this with the
 * remaining `never` type.
 */
export function assertNever(value: never, label = 'value'): never {
  throw new Error(`Unexpected ${label}: ${JSON.stringify(value)}`);
}
