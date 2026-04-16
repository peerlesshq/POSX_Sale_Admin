/**
 * PurchaseReversalService — records a purchase reversal + creates an
 * offsetting debit adjustment on the buyer's wallet so future
 * settlements exclude the reversed purchase (07 §36).
 *
 * Constraint 4: reversal NEVER overwrites any claimed reward
 * history. Adjustments are the only supported correction path.
 */
import {
  AdjustmentDirection,
  AdjustmentType,
  type AmountString,
  type PurchaseReversalType,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import { insertAdjustmentRecord } from '../repos/adjustment-records';
import { writeAuditLog } from '../observability/audit-log';
import {
  findReversalByPurchaseId,
  insertPurchaseReversal,
  markPurchaseAsReversed,
} from '../repos/purchase-reversals';

export interface PurchaseReversalInput {
  readonly purchaseId: Uuid;
  readonly wallet: WalletAddress;
  readonly reason: string;
  readonly reversalType: PurchaseReversalType;
  readonly reversedByAdminId: Uuid;
  readonly approvedByAdminId: Uuid;
  readonly effectiveAt: string;
  readonly notes?: string | null;
  /**
   * Amount of previously-paid off-chain reward that the operator
   * determines should be clawed back via a debit adjustment. Pass
   * "0" when there is nothing to offset yet.
   */
  readonly debitOffsetAmount: AmountString;
  readonly ipAddress?: string | null;
}

export class PurchaseReversalService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async reverse(input: PurchaseReversalInput): Promise<void> {
    if (!input.reason || !input.reason.trim()) {
      throw new AppError('INVALID_REQUEST', 'reversal reason required');
    }

    const existing = await findReversalByPurchaseId(this.db, input.purchaseId);
    if (existing) {
      throw new AppError('CONFLICT', 'purchase is already reversed');
    }

    await this.db.transaction(async (tx) => {
      await insertPurchaseReversal(tx, {
        purchase_id: input.purchaseId,
        reversal_reason: input.reason,
        reversal_type: input.reversalType,
        reversed_by_admin_id: input.reversedByAdminId,
        approved_by_admin_id: input.approvedByAdminId,
        effective_at: input.effectiveAt,
        notes: input.notes ?? null,
      });

      await markPurchaseAsReversed(tx, input.purchaseId);

      // Optional debit offset. Zero-value adjustments are valid
      // shape-wise (the check constraint is `amount >= 0`) but the
      // service skips them to keep the ledger clean.
      if (input.debitOffsetAmount !== '0') {
        await insertAdjustmentRecord(tx, {
          wallet_address: input.wallet,
          adjustment_type: AdjustmentType.PurchaseReversalOffset,
          direction: AdjustmentDirection.Debit,
          amount: input.debitOffsetAmount,
          remaining_amount: input.debitOffsetAmount,
          source_table: 'purchase_reversals',
          source_snapshot_id: input.purchaseId,
          reason: input.reason,
          created_by_admin_id: input.reversedByAdminId,
        });
      }

      await writeAuditLog(tx, {
        adminUserId: input.reversedByAdminId,
        action: 'purchase_reversal',
        targetType: 'purchase',
        targetId: input.purchaseId,
        detail: {
          reversal_type: input.reversalType,
          debit_offset_amount: input.debitOffsetAmount,
          approved_by: input.approvedByAdminId,
          effective_at: input.effectiveAt,
        },
        ipAddress: input.ipAddress ?? null,
      });
    });

    void this.clock; // clock currently unused; kept for future timestamps
  }
}
