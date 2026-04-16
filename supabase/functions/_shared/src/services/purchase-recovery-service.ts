/**
 * PurchaseRecoveryService.
 *
 * Source of truth: 07 §10, §27. Takes a tx hash and either attaches
 * it to an existing purchase order or creates a standalone recovery
 * linkage row. The chain event processor is what actually creates
 * the purchase fact — this service only manages the recovery
 * bookkeeping + deduplication.
 */
import type { TxHash, Uuid, WalletAddress } from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  failPurchaseRecovery,
  findPurchaseRecoveryByTxHash,
  insertPurchaseRecovery,
  markPurchaseRecoveryDuplicate,
  resolvePurchaseRecovery,
  type PurchaseRecoveryRow,
} from '../repos/purchase-recoveries';

export class PurchaseRecoveryService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async request(input: {
    wallet: WalletAddress;
    txHash: TxHash;
    purchaseOrderId?: Uuid | null;
  }): Promise<PurchaseRecoveryRow> {
    const existing = await findPurchaseRecoveryByTxHash(this.db, input.txHash);
    if (existing && existing.status === 'resolved') {
      throw new AppError(
        'PURCHASE_ALREADY_RECOVERED',
        'tx hash is already linked to a purchase',
      );
    }
    return insertPurchaseRecovery(this.db, {
      wallet_address: input.wallet,
      tx_hash: input.txHash,
      purchase_order_id: input.purchaseOrderId ?? null,
    });
  }

  async resolve(recoveryId: Uuid, resolvedPurchaseId: Uuid): Promise<void> {
    await resolvePurchaseRecovery(
      this.db,
      recoveryId,
      resolvedPurchaseId,
      this.clock.nowIso(),
    );
  }

  async markDuplicate(recoveryId: Uuid): Promise<void> {
    await markPurchaseRecoveryDuplicate(
      this.db,
      recoveryId,
      this.clock.nowIso(),
    );
  }

  async markFailed(recoveryId: Uuid, reason: string): Promise<void> {
    await failPurchaseRecovery(
      this.db,
      recoveryId,
      reason,
      this.clock.nowIso(),
    );
  }
}
