/**
 * AdjustmentService — creates + consumes adjustment records.
 *
 * Constraint 4: adjustments are the ONLY path for financial
 * corrections after claimed history exists (01 §15, 07 §35).
 */
import {
  AdjustmentDirection,
  AdjustmentStatus,
  type AdjustmentType,
  type AmountString,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import { addAmount, amountLte, minAmount } from '@posx/shared-utils';

import type { DbClient } from '../db';
import {
  decrementAdjustmentRemaining,
  insertAdjustmentRecord,
  listActiveAdjustmentsForWallet,
  type AdjustmentRecordRow,
} from '../repos/adjustment-records';

export interface CreateAdjustmentInput {
  readonly wallet: WalletAddress;
  readonly settlementJobId?: Uuid | null;
  readonly adjustmentType: AdjustmentType;
  readonly direction: AdjustmentDirection;
  readonly amount: AmountString;
  readonly reason: string;
  readonly settleDate?: string | null;
  readonly sourceTable?: string | null;
  readonly sourceSnapshotId?: Uuid | null;
  readonly createdByAdminId?: Uuid | null;
}

export class AdjustmentService {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateAdjustmentInput): Promise<AdjustmentRecordRow> {
    return insertAdjustmentRecord(this.db, {
      wallet_address: input.wallet,
      settlement_job_id: input.settlementJobId ?? null,
      adjustment_type: input.adjustmentType,
      direction: input.direction,
      amount: input.amount,
      remaining_amount: input.amount,
      settle_date: input.settleDate ?? null,
      source_table: input.sourceTable ?? null,
      source_snapshot_id: input.sourceSnapshotId ?? null,
      reason: input.reason,
      status: AdjustmentStatus.Active,
      created_by_admin_id: input.createdByAdminId ?? null,
    });
  }

  /**
   * Consume credit adjustments up to `amountNeeded`, decrementing
   * each in FIFO order. Returns the total credit actually consumed.
   */
  async consumeCredits(
    wallet: WalletAddress,
    amountNeeded: AmountString,
  ): Promise<AmountString> {
    let remaining = amountNeeded;
    let consumed: AmountString = '0';
    const rows = await listActiveAdjustmentsForWallet(this.db, wallet);
    for (const row of rows) {
      if (row.direction !== AdjustmentDirection.Credit) continue;
      if (amountLte(remaining, '0')) break;
      const take = minAmount(row.remaining_amount, remaining);
      await decrementAdjustmentRemaining(this.db, row.id, take);
      consumed = addAmount(consumed, take);
      remaining = addAmount(remaining, `-${take}`);
    }
    return consumed;
  }
}
