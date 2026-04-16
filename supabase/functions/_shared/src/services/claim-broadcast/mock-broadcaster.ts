/**
 * `MockClaimBroadcaster` — LOCAL DEVELOPMENT ONLY.
 *
 * This adapter claims the payout succeeded immediately with a
 * deterministic fake tx hash. It does not preserve intermediate
 * states; staging and production environments must use
 * `StagingClaimBroadcaster` (which still simulates payout but keeps
 * queued + broadcasted observable).
 *
 * Wiring rule enforced at construction: throws if instantiated in
 * any environment other than `local` unless `allowOutsideLocal` is
 * explicitly set to `true` (for tests).
 */
import { createHash } from 'node:crypto';

import type { TxHash } from '@posx/shared-types';

import { AppError } from '../../errors';

import type {
  BroadcastConfirmation,
  BroadcastInput,
  BroadcastOutcome,
  ClaimBroadcastAdapter,
} from './adapter';

export interface MockClaimBroadcasterOptions {
  readonly appEnv: 'local' | 'staging' | 'production';
  /** Test hook — do not use outside unit tests. */
  readonly allowOutsideLocal?: boolean;
}

export class MockClaimBroadcaster implements ClaimBroadcastAdapter {
  readonly name = 'mock-claim-broadcaster';
  readonly preserveIntermediateStates = false;

  constructor(options: MockClaimBroadcasterOptions) {
    if (options.appEnv !== 'local' && !options.allowOutsideLocal) {
      throw new AppError(
        'SERVICE_UNAVAILABLE',
        'MockClaimBroadcaster is only allowed in the local environment',
      );
    }
  }

  async submit(input: BroadcastInput): Promise<BroadcastOutcome> {
    const hash = createHash('sha256')
      .update(`${input.claimOrderId}|${input.wallet}|${input.amount}`)
      .digest('hex')
      .padEnd(64, '0')
      .slice(0, 64);
    return { kind: 'submitted', txHash: `0x${hash}` as TxHash };
  }

  async checkConfirmation(): Promise<BroadcastConfirmation> {
    return { confirmed: true };
  }
}
