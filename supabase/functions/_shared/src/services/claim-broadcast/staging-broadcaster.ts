/**
 * `StagingClaimBroadcaster` — simulates payout the same way as the
 * mock, BUT forces the claim flow to pass through every
 * intermediate state.
 *
 * Phase 2 constraint 6 / Phase 4 constraint: staging must preserve
 * `queued` and `broadcasted`. This adapter:
 *   - returns `submitted` from `submit` with a fake tx hash
 *   - returns `{ confirmed: false }` on the first confirmation poll
 *     and `{ confirmed: true }` on subsequent polls, so the claim
 *     finalization loop observes the `broadcasted → confirmed`
 *     transition separately from `queued → broadcasted`.
 */
import { createHash } from 'node:crypto';

import type { TxHash } from '@posx/shared-types';

import type {
  BroadcastConfirmation,
  BroadcastInput,
  BroadcastOutcome,
  ClaimBroadcastAdapter,
} from './adapter';

export class StagingClaimBroadcaster implements ClaimBroadcastAdapter {
  readonly name = 'staging-claim-broadcaster';
  readonly preserveIntermediateStates = true;

  private readonly seen = new Set<string>();

  async submit(input: BroadcastInput): Promise<BroadcastOutcome> {
    const hash = createHash('sha256')
      .update(`staging:${input.claimOrderId}|${input.wallet}|${input.amount}`)
      .digest('hex')
      .padEnd(64, '0')
      .slice(0, 64);
    return { kind: 'submitted', txHash: `0x${hash}` as TxHash };
  }

  async checkConfirmation(txHash: TxHash): Promise<BroadcastConfirmation> {
    if (this.seen.has(txHash)) {
      return { confirmed: true };
    }
    this.seen.add(txHash);
    return { confirmed: false };
  }
}
