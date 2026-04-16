/**
 * PurchaseFactService — writes the confirmed on-chain purchase fact
 * and triggers the downstream artefacts (vesting lot creation,
 * referral binding on first purchase). Called from the chain event
 * processor.
 *
 * Constraint 2: order status moves to `confirmed` only via
 * `transitionPurchaseOrder`, not by a raw UPDATE here.
 */
import {
  BindingSource,
  PurchaseOrderStatus,
  type AmountString,
  type TxHash,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import { type Clock, divAmount, systemClock } from '@posx/shared-utils';
import {
  ConfigGroup,
  type ConfigResolver,
  normalizeVestingPolicy,
} from '@posx/config';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findPurchaseOrderById,
  insertPurchase,
  type PurchaseRow,
} from '../repos/purchases';
import { insertVestingLot } from '../repos/vesting-lots';
import { upsertUser } from '../repos/users';
import { transitionPurchaseOrder } from '../transitions/purchase-order';

import type { ReferralBindingService } from './referral-binding-service';

export interface ProcessPurchaseFactInput {
  readonly purchaseOrderId: Uuid | null;
  readonly wallet: WalletAddress;
  readonly chainId: number;
  readonly contractAddress: string;
  readonly txHash: TxHash;
  readonly blockNumber: number;
  readonly logIndex?: number | null;
  readonly usdtAmount: AmountString;
  readonly tokenPriceAtPurchase: AmountString;
  readonly purchaseAt: string;
  /**
   * Wallet that referred this buyer, if the chain event carried one
   * AND this is the buyer's first successful purchase. The service
   * is responsible for verifying whether binding should actually
   * happen.
   */
  readonly candidateReferrer?: WalletAddress | null;
}

export class PurchaseFactService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly config: ConfigResolver,
    private readonly referralBinding: ReferralBindingService,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async recordConfirmedPurchase(
    input: ProcessPurchaseFactInput,
  ): Promise<PurchaseRow> {
    // Ensure the user row exists (chain event path — the user may
    // have never gone through the auth flow if the contract was
    // triggered externally).
    await upsertUser(this.db, {
      wallet_address: input.wallet,
      first_seen_at: input.purchaseAt,
      first_purchase_at: input.purchaseAt,
    });

    // Insert the purchase fact. Uniqueness via (chain_id, tx_hash,
    // coalesce(log_index, -1)) keeps re-processing safe.
    const purchase = await insertPurchase(this.db, {
      purchase_order_id: input.purchaseOrderId ?? null,
      wallet_address: input.wallet,
      chain_id: input.chainId,
      contract_address: input.contractAddress,
      tx_hash: input.txHash,
      block_number: input.blockNumber,
      log_index: input.logIndex ?? null,
      usdt_amount: input.usdtAmount,
      posx_amount: divAmount(input.usdtAmount, input.tokenPriceAtPurchase),
      token_price_at_purchase: input.tokenPriceAtPurchase,
      purchase_at: input.purchaseAt,
    });

    // Create the vesting lot. Parameters come from the vesting
    // policy effective at order creation time (`new_orders_only`
    // scope, 09 §6.3).
    const vestingRow = await this.config.resolve({
      group: ConfigGroup.VestingRules,
      key: 'vesting_policy',
      context: {
        evaluationTime: input.purchaseAt,
        orderCreatedAt: input.purchaseAt,
      },
    });
    if (!vestingRow) {
      throw new AppError('INTERNAL_ERROR', 'vesting_rules.vesting_policy missing');
    }
    const vesting = normalizeVestingPolicy(vestingRow.config_value);
    await insertVestingLot(this.db, {
      wallet_address: input.wallet,
      purchase_id: purchase.id,
      total_locked: purchase.posx_amount,
      start_time: purchase.purchase_at,
      lock_days: vesting.lock_days,
      release_days: vesting.release_days,
    });

    // Move the originating order to `confirmed` if it existed.
    if (input.purchaseOrderId) {
      const existing = await findPurchaseOrderById(this.db, input.purchaseOrderId);
      if (existing && existing.status !== PurchaseOrderStatus.Confirmed) {
        await transitionPurchaseOrder(this.db, {
          orderId: input.purchaseOrderId,
          toStatus: PurchaseOrderStatus.Confirmed,
          confirmedAt: this.clock.nowIso(),
        });
      }
    }

    // Referral binding (first-purchase only — service no-ops on
    // duplicate).
    if (input.candidateReferrer) {
      await this.referralBinding.bindOnFirstPurchase({
        childWallet: input.wallet,
        parentWallet: input.candidateReferrer,
        source: BindingSource.ReferralLink,
        bindingTxHash: input.txHash,
        boundAt: input.purchaseAt,
      });
    }

    return purchase;
  }
}
