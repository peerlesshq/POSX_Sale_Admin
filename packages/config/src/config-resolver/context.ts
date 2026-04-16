/**
 * ConfigResolutionContext builder.
 *
 * Provides a small constructor helper so call sites don't accidentally
 * forget `evaluationTime`. All optional fields remain optional so that
 * scope mismatches surface as "no version applicable" rather than
 * silently coercing.
 */
import { systemClock, type Clock } from '@posx/shared-utils';

import type { ConfigResolutionContext } from './types';

export interface ContextInput {
  /**
   * Override the evaluation time. Defaults to the clock's current ISO
   * timestamp. Historical recompute jobs MUST pass this explicitly.
   */
  evaluationTime?: string;
  settlementDate?: string;
  userCreatedAt?: string;
  userWalletAddress?: string;
  orderCreatedAt?: string;
}

/**
 * Build a `ConfigResolutionContext`. `exactOptionalPropertyTypes` is
 * off so passing `undefined` explicitly is safe, but we still avoid
 * putting `undefined` keys into the object to keep telemetry output
 * clean.
 */
export function buildResolutionContext(
  input: ContextInput = {},
  clock: Clock = systemClock,
): ConfigResolutionContext {
  const evaluationTime = input.evaluationTime ?? clock.nowIso();

  const ctx: Writeable<ConfigResolutionContext> = {
    evaluationTime,
  };
  if (input.settlementDate !== undefined) {
    ctx.settlementDate = input.settlementDate;
  }
  if (input.userCreatedAt !== undefined) {
    ctx.userCreatedAt = input.userCreatedAt;
  }
  if (input.userWalletAddress !== undefined) {
    ctx.userWalletAddress = input.userWalletAddress;
  }
  if (input.orderCreatedAt !== undefined) {
    ctx.orderCreatedAt = input.orderCreatedAt;
  }
  return ctx;
}

type Writeable<T> = { -readonly [K in keyof T]: T[K] };
