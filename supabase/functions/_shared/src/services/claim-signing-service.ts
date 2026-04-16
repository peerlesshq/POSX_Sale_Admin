/**
 * ClaimSigningService — accepts the user's wallet signature, moves
 * the order from `pending_signature → queued`, and hands the order
 * to the broadcaster.
 */
import {
  ClaimOrderStatus,
  type TxHash,
  type WalletAddress,
} from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import { verifyWalletSignature } from '../crypto/wallet-signature';
import type { DbClient } from '../db';
import { AppError } from '../errors';
import { transitionClaimOrder } from '../transitions/claim-order';

import type { ClaimBroadcastAdapter } from './claim-broadcast/adapter';
import type { ClaimOrderRow } from '../repos/claim-orders';

export interface ClaimSignInput {
  readonly order: ClaimOrderRow;
  readonly signature: string;
  readonly messageThatWasSigned: string;
  readonly wallet: WalletAddress;
}

export class ClaimSigningService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly broadcaster: ClaimBroadcastAdapter,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async sign(input: ClaimSignInput): Promise<{ order: ClaimOrderRow; txHash: TxHash | null }> {
    if (input.order.status !== ClaimOrderStatus.PendingSignature) {
      throw new AppError(
        'CLAIM_ALREADY_IN_PROGRESS',
        `claim order already in status ${input.order.status}`,
      );
    }
    const ok = await verifyWalletSignature({
      message: input.messageThatWasSigned,
      signature: input.signature,
      expectedWalletAddress: input.wallet,
    });
    if (!ok) {
      throw new AppError('INVALID_SIGNATURE', 'claim signature invalid');
    }

    const queuedAt = this.clock.nowIso();
    const queued = await transitionClaimOrder(this.db, {
      order: input.order,
      toStatus: ClaimOrderStatus.Queued,
      timestamps: {
        signed_message: input.messageThatWasSigned,
        signed_at: queuedAt,
        queued_at: queuedAt,
      },
    });

    const submitOutcome = await this.broadcaster.submit({
      claimOrderId: queued.id,
      wallet: queued.wallet_address,
      amount: queued.requested_total_amount,
    });

    if (submitOutcome.kind === 'failed') {
      const failed = await transitionClaimOrder(this.db, {
        order: queued,
        toStatus: ClaimOrderStatus.Failed,
        timestamps: {
          failed_at: this.clock.nowIso(),
          failure_reason: submitOutcome.reason,
        },
      });
      return { order: failed, txHash: null };
    }

    const broadcasted = await transitionClaimOrder(this.db, {
      order: queued,
      toStatus: ClaimOrderStatus.Broadcasted,
      timestamps: {
        broadcasted_at: this.clock.nowIso(),
        broadcast_tx_hash: submitOutcome.txHash,
      },
    });
    return { order: broadcasted, txHash: submitOutcome.txHash };
  }
}
