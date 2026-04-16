/**
 * Injectable clock abstraction.
 *
 * Business modules (settlement, config resolution, claim TTL expiry,
 * etc.) must depend on this `Clock` interface rather than calling
 * `Date.now()` or `new Date()` directly. This makes tests deterministic
 * and supports fixture-driven settlement replays.
 */
export interface Clock {
  now(): Date;
  nowMs(): number;
  nowIso(): string;
}

/**
 * The real system clock. Use in production runtime wiring.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  nowMs(): number {
    return Date.now();
  }
  nowIso(): string {
    return new Date().toISOString();
  }
}

/**
 * Fixed / advanceable clock for tests and settlement fixtures. Not
 * thread-safe in the sense that concurrent mutation is unsafe; single
 * test context assumed.
 */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date | string | number) {
    const date =
      typeof initial === 'string' || typeof initial === 'number'
        ? new Date(initial)
        : new Date(initial.getTime());
    if (Number.isNaN(date.getTime())) {
      throw new Error(`FixedClock received invalid initial value: ${String(initial)}`);
    }
    this.current = date;
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  nowMs(): number {
    return this.current.getTime();
  }

  nowIso(): string {
    return this.current.toISOString();
  }

  advanceMs(ms: number): void {
    if (!Number.isFinite(ms)) {
      throw new Error(`FixedClock.advanceMs requires a finite number, got ${String(ms)}`);
    }
    this.current = new Date(this.current.getTime() + ms);
  }

  advanceSeconds(seconds: number): void {
    this.advanceMs(seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advanceMs(minutes * 60 * 1000);
  }

  advanceDays(days: number): void {
    this.advanceMs(days * 24 * 60 * 60 * 1000);
  }

  set(date: Date | string | number): void {
    const next =
      typeof date === 'string' || typeof date === 'number'
        ? new Date(date)
        : new Date(date.getTime());
    if (Number.isNaN(next.getTime())) {
      throw new Error(`FixedClock.set received invalid value: ${String(date)}`);
    }
    this.current = next;
  }
}

/**
 * A module-level singleton of the real system clock. Services that
 * require a clock as a constructor dependency should prefer passing
 * this explicitly so that tests can substitute a `FixedClock`.
 */
export const systemClock: Clock = new SystemClock();
