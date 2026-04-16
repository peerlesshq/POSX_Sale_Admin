/**
 * Daily settlement job entrypoint.
 *
 * Thin wrapper that binds the settlement orchestrator to the
 * JobRunner so every run gets a `job_runs` row for observability.
 */
import {
  SettlementJobMode,
  type UtcDate,
} from '@posx/shared-types';

import type { DbClient } from '../db';
import type { SettlementOrchestrator } from '../services/settlement-orchestrator';

import { JobRunner } from './runner';

export interface DailySettlementJobInput {
  readonly db: DbClient;
  readonly orchestrator: SettlementOrchestrator;
  readonly settlementDate: UtcDate;
  readonly mode?: SettlementJobMode;
  readonly reason?: string | null;
}

export async function runDailySettlementJob(
  input: DailySettlementJobInput,
): Promise<void> {
  const runner = new JobRunner(input.db);
  await runner.run({
    jobName: 'daily_settlement',
    jobKey: input.settlementDate,
    fn: () =>
      input.orchestrator.run({
        settlementDate: input.settlementDate,
        mode: input.mode ?? SettlementJobMode.Official,
        reason: input.reason ?? 'scheduled daily settlement',
      }),
    extractCounts: (result) => ({
      rows_scanned: result.processedUserCount,
      rows_processed: result.createdSnapshotCount,
      rows_failed: result.errorCount,
      detail: {
        settlement_job_id: result.job.id,
        status: result.job.status,
      },
    }),
  });
}
