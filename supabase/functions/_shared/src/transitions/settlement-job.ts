/**
 * Settlement job transition helper.
 *
 * Constraint 2: settlement-job status flips happen only here.
 */
import type { SettlementJobStatus, Uuid } from '@posx/shared-types';
import { assertSettlementJobTransition } from '@posx/domain-rules';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import { type AuditLogInput, withAuditTx } from '../observability/audit-log';
import {
  finalizeSettlementJob,
  findSettlementJobById,
  type SettlementJobRow,
} from '../repos/settlement-jobs';

export interface SettlementJobFinalizeTransitionInput {
  readonly jobId: Uuid;
  readonly toStatus: SettlementJobStatus;
  readonly finishedAt: string;
  readonly processedUserCount: number;
  readonly createdSnapshotCount: number;
  readonly createdAdjustmentCount: number;
  readonly errorCount: number;
  readonly errorSample?: Record<string, unknown> | null;
  /** BE-22 — optional audit context. */
  readonly audit?: AuditLogInput | null;
}

export async function transitionSettlementJob(
  db: DbClient,
  input: SettlementJobFinalizeTransitionInput,
): Promise<SettlementJobRow> {
  const current = await findSettlementJobById(db, input.jobId);
  if (!current) {
    throw new AppError('NOT_FOUND', `settlement_job ${input.jobId} not found`);
  }
  assertSettlementJobTransition(current.status, input.toStatus);

  const doFinalize = (conn: DbClient) =>
    finalizeSettlementJob(conn, {
      id: input.jobId,
      status: input.toStatus,
      finished_at: input.finishedAt,
      processed_user_count: input.processedUserCount,
      created_snapshot_count: input.createdSnapshotCount,
      created_adjustment_count: input.createdAdjustmentCount,
      error_count: input.errorCount,
      error_sample: input.errorSample ?? null,
    });

  if (input.audit) {
    return withAuditTx(db, input.audit, doFinalize);
  }
  return doFinalize(db);
}
