/**
 * Pure scope selection helpers for the config resolver.
 *
 * These functions are the entire "business logic" of the resolver.
 * They are pure (no I/O, no clock) so they can be unit-tested against
 * fixtures in Phase 6 and reused by the in-memory test resolver in
 * `@posx/test-utils`.
 *
 * Source of truth: 09_config_center_spec.md §6 and §7.
 */
import {
  ApplyScope,
  type ConfigVersionStatus,
  CONFIG_VERSION_RESOLVABLE_STATUSES,
} from '@posx/shared-types';
import {
  assertNever,
  compareIsoTimestamps,
  isoTimestampGt,
  isoTimestampGte,
  utcDayStart,
} from '@posx/shared-utils';

import type { ConfigResolutionContext, ConfigVersionRow } from './types';

/**
 * Check whether a single config version is applicable for a given
 * resolution context.
 *
 * Rules (09 §6 and §11.2):
 *   1. The version's `status` must be `active` or `superseded`. Draft
 *      and disabled versions are invisible to the resolver — disabled
 *      means "not usable for NEW resolutions" but the spec is clear
 *      that historical calculations should still find previous
 *      effective versions. Because we filter by `effective_from`
 *      monotonically, disabled rows simply drop out; older active /
 *      superseded rows remain reachable.
 *   2. `version.effective_from` must be less than or equal to
 *      `context.evaluationTime`.
 *   3. `apply_scope` must match the available context fields:
 *      - `all_users`           → always true
 *      - `new_users_only`      → `userCreatedAt >= effective_from`
 *      - `new_orders_only`     → `orderCreatedAt >= effective_from`
 *      - `next_settlement_day` → `settlementDate`'s 00:00:00Z start is
 *                                at or after `effective_from`
 */
export function isVersionApplicable(
  version: ConfigVersionRow,
  context: ConfigResolutionContext,
): boolean {
  if (!isResolvableStatus(version.status)) return false;
  if (isoTimestampGt(version.effective_from, context.evaluationTime)) return false;

  switch (version.apply_scope) {
    case ApplyScope.AllUsers:
      return true;

    case ApplyScope.NewUsersOnly: {
      if (!context.userCreatedAt) return false;
      return isoTimestampGte(context.userCreatedAt, version.effective_from);
    }

    case ApplyScope.NewOrdersOnly: {
      if (!context.orderCreatedAt) return false;
      return isoTimestampGte(context.orderCreatedAt, version.effective_from);
    }

    case ApplyScope.NextSettlementDay: {
      if (!context.settlementDate) return false;
      const settleStart = utcDayStart(context.settlementDate);
      return isoTimestampGte(settleStart, version.effective_from);
    }

    default:
      return assertNever(version.apply_scope, 'apply_scope');
  }
}

function isResolvableStatus(status: ConfigVersionStatus): boolean {
  return (CONFIG_VERSION_RESOLVABLE_STATUSES as ReadonlyArray<string>).includes(
    status,
  );
}

/**
 * From a candidate list of versions for the same `(group, key)`, pick
 * the one that applies to the given context with the highest priority.
 *
 * Priority rule (09 §7.1):
 *   1. Most recent `effective_from` wins.
 *   2. If two rows share `effective_from`, the higher `version_no` wins.
 *
 * Returns `null` if no version is applicable.
 */
export function selectMostRecentApplicable(
  versions: ReadonlyArray<ConfigVersionRow>,
  context: ConfigResolutionContext,
): ConfigVersionRow | null {
  const applicable = versions.filter((v) => isVersionApplicable(v, context));
  if (applicable.length === 0) return null;

  // Sort descending by effective_from (parsed as ms to dodge the ISO
  // fractional-seconds trap), then by version_no.
  const sorted = [...applicable].sort((a, b) => {
    const byTime = compareIsoTimestamps(b.effective_from, a.effective_from);
    if (byTime !== 0) return byTime;
    return b.version_no - a.version_no;
  });

  return sorted[0] ?? null;
}
