/**
 * PurchaseOrderService — creates orders, attaches tx hashes, and
 * reads them back. All status flips go through
 * `transitionPurchaseOrder`.
 */
import {
  type AmountString,
  PurchaseOrderStatus,
  type TxHash,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import { amountGte, type Clock, systemClock } from '@posx/shared-utils';
import {
  ConfigGroup,
  type ConfigResolver,
  normalizeMinimumPurchaseAmount,
} from '@posx/config';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findPurchaseOrderById,
  insertPurchaseOrder,
  type PurchaseOrderRow,
} from '../repos/purchases';
import { transitionPurchaseOrder } from '../transitions/purchase-order';
import type { UserAccessPolicyService } from './user-access-policy';

export interface CreatePurchaseOrderInput {
  readonly wallet: WalletAddress;
  readonly clientOrderId: string;
  readonly usdtAmount: AmountString;
  readonly expectedTokenPrice?: AmountString;
  readonly chainId?: number;
  readonly contractAddress?: string;
}

export class PurchaseOrderService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly access: UserAccessPolicyService,
    private readonly config: ConfigResolver,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async create(input: CreatePurchaseOrderInput): Promise<PurchaseOrderRow> {
    await this.access.assertCanPurchase(input.wallet);

    const nowIso = this.clock.nowIso();
    const minRow = await this.config.resolve({
      group: ConfigGroup.PurchaseRules,
      key: 'minimum_purchase_amount',
      context: {
        evaluationTime: nowIso,
        orderCreatedAt: nowIso,
      },
    });
    if (!minRow) {
      throw new AppError(
        'INTERNAL_ERROR',
        'purchase_rules.minimum_purchase_amount missing',
      );
    }
    const { minimum_purchase_amount } = normalizeMinimumPurchaseAmount(
      minRow.config_value,
    );
    if (!amountGte(input.usdtAmount, minimum_purchase_amount)) {
      throw new AppError(
        'MIN_PURCHASE_NOT_MET',
        `minimum purchase amount is ${minimum_purchase_amount}`,
      );
    }

    return insertPurchaseOrder(this.db, {
      wallet_address: input.wallet,
      client_order_id: input.clientOrderId,
      usdt_amount: input.usdtAmount,
      token_price_snapshot: input.expectedTokenPrice ?? null,
      chain_id: input.chainId ?? null,
      contract_address: input.contractAddress ?? null,
    });
  }

  async attachTx(input: {
    orderId: Uuid;
    wallet: WalletAddress;
    purchaseTxHash: TxHash;
    approvalTxHash?: TxHash;
  }): Promise<PurchaseOrderRow> {
    const order = await findPurchaseOrderById(this.db, input.orderId);
    if (!order) {
      throw new AppError('PURCHASE_NOT_FOUND', 'purchase order not found');
    }
    if (order.wallet_address.toLowerCase() !== input.wallet.toLowerCase()) {
      throw new AppError('FORBIDDEN', 'purchase order belongs to another wallet');
    }

    await this.db.query(
      `update purchase_orders
          set purchase_tx_hash = $2,
              approval_tx_hash = coalesce($3, approval_tx_hash)
        where id = $1`,
      [input.orderId, input.purchaseTxHash, input.approvalTxHash ?? null],
    );

    return transitionPurchaseOrder(this.db, {
      orderId: input.orderId,
      toStatus: PurchaseOrderStatus.PurchasePending,
    });
  }

  async get(orderId: Uuid, wallet: WalletAddress): Promise<PurchaseOrderRow> {
    const order = await findPurchaseOrderById(this.db, orderId);
    if (!order) {
      throw new AppError('PURCHASE_NOT_FOUND', 'purchase order not found');
    }
    if (order.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
      throw new AppError('FORBIDDEN', 'purchase order belongs to another wallet');
    }
    return order;
  }
}
