/**
 * In-process rate limiter + failed-login lockout for the unauthenticated
 * auth surface.
 *
 * Covers the audit findings BE-07, BE-08 and partially BE-25:
 *
 *   BE-07: IP-scoped rate limit on `/admin/auth/login`, `/auth/nonce`,
 *          `/auth/verify`. Each caller may burn N requests per window
 *          per route before being rejected with `RATE_LIMITED`.
 *
 *   BE-08: Failed-login lockout for the admin login endpoint. After K
 *          consecutive failures for the same `(ip, email)` pair we
 *          refuse further attempts for a cool-down period — even with
 *          the correct password — so an online guesser cannot keep
 *          hammering the endpoint indefinitely.
 *
 *   BE-25 (partial): exposed in a shape the router can call
 *          `auditLoginFailure` / `auditLoginSuccess` against so admin
 *          login attempts leave an audit trail regardless of outcome.
 *          The actual audit-log write lives in the handler layer — we
 *          don't pull `DbClient` into this module because it has to
 *          stay dead-simple for the hot path.
 *
 * ---------------------------------------------------------------------
 * Scope limits
 * ---------------------------------------------------------------------
 *
 * This is an IN-PROCESS limiter. Counters live inside a module-level
 * Map, so every edge-function instance has its own view. That means:
 *
 *   - A real attacker could horizontally scale around it by targeting
 *     different instances.
 *   - Horizontal edge runtimes (Supabase, CloudFlare Workers) WILL
 *     fragment the state.
 *
 * The production-grade fix is a Redis/Upstash shared store (tracked as
 * a follow-up in the remediation doc). Until then, this limiter is a
 * defense-in-depth layer that still blocks naive single-instance
 * attacks, slows down offline-to-online password guessing, and keeps
 * the endpoint from being trivially DoS'd from one IP.
 */

export interface RateLimitConfig {
  /** Time window in milliseconds. */
  readonly windowMs: number;
  /** Allowed attempts inside the window. */
  readonly max: number;
}

export interface LockoutConfig {
  /** Consecutive failures before the lockout engages. */
  readonly maxFailures: number;
  /** How long to keep the lockout active once tripped. */
  readonly lockoutMs: number;
}

/**
 * Conservative defaults for launch. These are tight on purpose —
 * legitimate traffic patterns for these endpoints are "a user types
 * their password" frequency, not "script making dozens of calls".
 */
export const DEFAULT_AUTH_RATE_LIMITS: {
  readonly adminLogin: RateLimitConfig;
  readonly walletNonce: RateLimitConfig;
  readonly walletVerify: RateLimitConfig;
  readonly adminLoginLockout: LockoutConfig;
} = {
  adminLogin: { windowMs: 60_000, max: 10 },
  walletNonce: { windowMs: 60_000, max: 30 },
  walletVerify: { windowMs: 60_000, max: 30 },
  adminLoginLockout: { maxFailures: 5, lockoutMs: 15 * 60_000 },
};

interface SlidingWindow {
  readonly windowMs: number;
  readonly max: number;
  timestamps: number[];
}

interface FailureRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

/**
 * Bucket key scheme:
 *   - rate windows:   `rate:<route>:<ip>`
 *   - failed logins:  `fail:admin-login:<ip>|<email-lowercase>`
 *
 * We include both `ip` and `email` in the failure key so one hostile
 * IP doesn't lock out real admins, and one hostile actor who forgot
 * their own password can't also lock out another admin's account from
 * elsewhere.
 */
const rateWindows = new Map<string, SlidingWindow>();
const failureRecords = new Map<string, FailureRecord>();

function bucket(key: string, cfg: RateLimitConfig): SlidingWindow {
  const existing = rateWindows.get(key);
  if (existing) return existing;
  const created: SlidingWindow = {
    windowMs: cfg.windowMs,
    max: cfg.max,
    timestamps: [],
  };
  rateWindows.set(key, created);
  return created;
}

function prune(window: SlidingWindow, now: number): void {
  const cutoff = now - window.windowMs;
  // Drop anything older than the cutoff. Array-splice is fine here
  // because timestamps are append-only and monotonically increasing.
  let i = 0;
  while (i < window.timestamps.length && window.timestamps[i]! < cutoff) {
    i += 1;
  }
  if (i > 0) window.timestamps.splice(0, i);
}

export interface RateLimitOutcome {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
}

/**
 * Check-and-record a single hit against the sliding window bucket.
 * Returns the outcome so the caller can decide whether to reject the
 * request. This is a pure side-effecting function — the timestamp is
 * only appended when the hit is `allowed`, so a blocked caller does
 * NOT extend their own cool-down.
 */
export function rateLimitHit(
  keyPrefix: string,
  ip: string | null,
  cfg: RateLimitConfig,
  nowMs: number = Date.now(),
): RateLimitOutcome {
  const ipKey = ip ?? 'unknown';
  const key = `rate:${keyPrefix}:${ipKey}`;
  const window = bucket(key, cfg);
  prune(window, nowMs);

  if (window.timestamps.length >= cfg.max) {
    const oldest = window.timestamps[0] ?? nowMs;
    const retryAfterMs = Math.max(0, window.windowMs - (nowMs - oldest));
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  window.timestamps.push(nowMs);
  return {
    allowed: true,
    remaining: cfg.max - window.timestamps.length,
    retryAfterMs: 0,
  };
}

function lockoutKey(ip: string | null, email: string): string {
  return `fail:admin-login:${ip ?? 'unknown'}|${email.toLowerCase()}`;
}

export interface LockoutStatus {
  readonly locked: boolean;
  readonly failures: number;
  readonly retryAfterMs: number;
}

/**
 * Check if the `(ip, email)` pair is currently locked out. Call this
 * BEFORE invoking `AdminAuthService.login()` so a locked-out caller
 * can't even probe whether a password is correct.
 *
 * This is a read-only probe — the lockout window is set by
 * `recordAdminLoginFailure`, which is where the `LockoutConfig` is
 * actually consumed. That means the checker does not need to know
 * the config thresholds at all.
 */
export function checkAdminLoginLockout(
  ip: string | null,
  email: string,
  nowMs: number = Date.now(),
): LockoutStatus {
  const rec = failureRecords.get(lockoutKey(ip, email));
  if (!rec) return { locked: false, failures: 0, retryAfterMs: 0 };
  if (rec.lockedUntil !== null && rec.lockedUntil > nowMs) {
    return {
      locked: true,
      failures: rec.failures,
      retryAfterMs: rec.lockedUntil - nowMs,
    };
  }
  // Lock expired — clear it so the window resets for a fresh attempt.
  if (rec.lockedUntil !== null && rec.lockedUntil <= nowMs) {
    failureRecords.delete(lockoutKey(ip, email));
    return { locked: false, failures: 0, retryAfterMs: 0 };
  }
  return { locked: false, failures: rec.failures, retryAfterMs: 0 };
}

/**
 * Record an authentication failure for `(ip, email)`. When the failure
 * count reaches `cfg.maxFailures`, the caller is locked out for
 * `cfg.lockoutMs` milliseconds. Counter resets on success via
 * `clearAdminLoginFailures`.
 */
export function recordAdminLoginFailure(
  ip: string | null,
  email: string,
  cfg: LockoutConfig = DEFAULT_AUTH_RATE_LIMITS.adminLoginLockout,
  nowMs: number = Date.now(),
): LockoutStatus {
  const key = lockoutKey(ip, email);
  const existing = failureRecords.get(key);
  const rec: FailureRecord = existing ?? {
    failures: 0,
    firstFailureAt: nowMs,
    lockedUntil: null,
  };
  rec.failures += 1;
  if (rec.failures >= cfg.maxFailures) {
    rec.lockedUntil = nowMs + cfg.lockoutMs;
  }
  failureRecords.set(key, rec);
  return {
    locked: rec.lockedUntil !== null && rec.lockedUntil > nowMs,
    failures: rec.failures,
    retryAfterMs:
      rec.lockedUntil !== null ? Math.max(0, rec.lockedUntil - nowMs) : 0,
  };
}

export function clearAdminLoginFailures(
  ip: string | null,
  email: string,
): void {
  failureRecords.delete(lockoutKey(ip, email));
}

/**
 * Test helper — clears ALL in-memory state. Never called from prod
 * code; only used by unit tests that want a clean slate per case.
 */
export function __resetAuthRateLimiterForTests(): void {
  rateWindows.clear();
  failureRecords.clear();
}
