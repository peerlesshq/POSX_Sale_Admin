/**
 * ClaimFinalizationService — polls the broadcaster and, upon
 * confirmation, marks linked snapshots `claimed` + inserts a
 * `claim_records` row. On broadcast failure it transitions the order
 * to `failed` which releases the locks.
 */
import {
  ClaimItemSourceTable,
  ClaimOrderStatus,
  ClaimRecordStatus,
  type Uuid,
} from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  insertClaimRecord,
  type ClaimOrderRow,
} from '../repos/claim-orders';
import { markEqualLevelRewardClaimed } from '../repos/equal-level-rewards';
import { markTeamRewardClaimed } from '../repos/team-rewards';
import { transitionClaimOrder } from '../transitions/claim-order';

import type { ClaimBroadcastAdapter } from './claim-broadcast/adapter';

export class ClaimFinalizationService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly broadcaster: ClaimBroadcastAdapter,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async finalize(order: ClaimOrderRow): Promise<ClaimOrderRow> {
    if (order.status !== ClaimOrderStatus.Broadcasted) {
      throw new AppError(
        'CONFLICT',
        `claim order must be in broadcasted state to finalize (actual: ${order.status})`,
      );
    }
    if (!order.broadcast_tx_hash) {
      throw new AppError('INTERNAL_ERROR', 'claim order has no broadcast_tx_hash');
    }

    const confirmation = await this.broadcaster.checkConfirmation(
      order.broadcast_tx_hash,
    );
    if (!confirmation.confirmed) {
      // Staying in `broadcasted` is intentional — per 07 §32 we do
      // NOT prematurely mark failed while confirmation is uncertain.
      return order;
    }

    return this.db.transaction(async (tx) => {
      const confirmedAt = this.clock.nowIso();
      const updatedOrder = await transitionClaimOrder(tx, {
        order,
        toStatus: ClaimOrderStatus.Confirmed,
        timestamps: {
          confirmed_at: confirmedAt,
        },
      });

      // Mark each linked snapshot as claimed.
      const items = await tx.query<{
        reward_type: string;
        source_table: string;
        source_snapshot_id: Uuid;
      }>(
        `select reward_type, source_table, source_snapshot_id
           from claim_order_items
          where claim_order_id = $1`,
        [order.id],
      );
      for (const item of items) {
        if (item.source_table === ClaimItemSourceTable.TeamRewardsDaily) {
          await markTeamRewardClaimed(tx, item.source_snapshot_id, order.broadcast_tx_hash!);
        } else if (item.source_table === ClaimItemSourceTable.EqualLevelRewardsDaily) {
          await markEqualLevelRewardClaimed(tx, item.source_snapshot_id, order.broadcast_tx_hash!);
        }
      }

      await insertClaimRecord(tx, {
        claim_order_id: order.id,
        wallet_address: order.wallet_address,
        amount: order.requested_total_amount,
        tx_hash: order.broadcast_tx_hash,
        status: ClaimRecordStatus.Confirmed,
        recorded_at: confirmedAt,
      });

      return updatedOrder;
    });
  }
}
