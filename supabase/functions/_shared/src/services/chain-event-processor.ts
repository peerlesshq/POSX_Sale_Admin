/**
 * ChainEventProcessor — maps confirmed `chain_events` rows to
 * business facts (purchases + direct rewards) via the purchase fact
 * service.
 *
 * Phase 4 ships the skeleton. Event payload shape is defined by
 * whatever contract wiring Phase 5 picks — for now the processor
 * understands two event names, documented in the switch statement.
 *
 * Constraint 2: chain event status transitions (observed → confirmed
 * → processed / failed_processing / reverted) go through the
 * domain-rules state guard, applied at the repo layer.
 */
import {
  ChainEventStatus,
  type AmountString,
  type TxHash,
  type WalletAddress,
} from '@posx/shared-types';
import { assertChainEventTransition } from '@posx/domain-rules';
import { type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  listConfirmedUnprocessedEvents,
  markChainEventFailedProcessing,
  markChainEventProcessed,
  type ChainEventRow,
} from '../repos/chain-events';
import { insertDirectReward } from '../repos/direct-rewards';

import type { PurchaseFactService } from './purchase-fact-service';

export class ChainEventProcessor {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly purchaseFacts: PurchaseFactService,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async processPending(limit = 100): Promise<{ processed: number; failed: number }> {
    const rows = await listConfirmedUnprocessedEvents(this.db, limit);
    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        assertChainEventTransition(row.status, ChainEventStatus.Processed);
        await this.handle(row);
        await markChainEventProcessed(this.db, row.id, this.clock.nowIso());
        processed += 1;
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : String(err);
        // Guard transition: failed_processing is allowed from
        // confirmed per 07 §11.2.
        assertChainEventTransition(row.status, ChainEventStatus.FailedProcessing);
        await markChainEventFailedProcessing(
          this.db,
          row.id,
          this.clock.nowIso(),
          reason,
        );
      }
    }
    return { processed, failed };
  }

  private async handle(row: ChainEventRow): Promise<void> {
    switch (row.event_name) {
      case 'Purchased': {
        const payload = row.payload as {
          wallet: WalletAddress;
          usdt_amount: AmountString;
          token_price: AmountString;
          purchase_order_id?: string;
          candidate_referrer?: WalletAddress;
          purchase_at?: string;
        };
        await this.purchaseFacts.recordConfirmedPurchase({
          purchaseOrderId: (payload.purchase_order_id as string | undefined) ?? null,
          wallet: payload.wallet,
          chainId: row.chain_id,
          contractAddress: row.contract_address,
          txHash: row.tx_hash,
          blockNumber: row.block_number,
          logIndex: row.log_index,
          usdtAmount: payload.usdt_amount,
          tokenPriceAtPurchase: payload.token_price,
          purchaseAt: payload.purchase_at ?? this.clock.nowIso(),
          candidateReferrer: payload.candidate_referrer ?? null,
        });
        return;
      }

      case 'DirectRewardPaid': {
        const payload = row.payload as {
          from_wallet: WalletAddress;
          to_wallet: WalletAddress;
          purchase_amount: AmountString;
          reward_amount: AmountString;
          reward_rate?: string;
          rewarded_at?: string;
        };
        await insertDirectReward(this.db, {
          from_wallet_address: payload.from_wallet,
          to_wallet_address: payload.to_wallet,
          chain_id: row.chain_id,
          tx_hash: row.tx_hash as TxHash,
          block_number: row.block_number,
          purchase_amount: payload.purchase_amount,
          reward_amount: payload.reward_amount,
          reward_rate: payload.reward_rate ?? null,
          rewarded_at: payload.rewarded_at ?? this.clock.nowIso(),
        });
        return;
      }

      default:
        throw new AppError(
          'INTERNAL_ERROR',
          `unknown chain event: ${row.event_name}`,
        );
    }
  }
}
