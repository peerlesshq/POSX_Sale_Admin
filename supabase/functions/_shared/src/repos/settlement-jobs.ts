/**
 * `settlement_jobs` repo — data access only.
 *
 * The settlement orchestrator creates one row per run and updates
 * counters as the job progresses. This repo does NOT know anything
 * about mode semantics (01 §15) — callers pass whatever mode they
 * need.
 */
import type {
  SettlementJobMode,
  SettlementJobStatus,
  SettlementJobType,
  Uuid,
} from '@posx/shared-types';

import type { DbClient } from '../db';

export interface SettlementJobRow {
  id: Uuid;
  job_type: SettlementJobType;
  settlement_date: string;
  mode: SettlementJobMode;
  status: SettlementJobStatus;
  config_version_snapshot: Record<string, unknown>;
  started_at: string;
  finished_at: string | null;
  triggered_by_admin_id: Uuid | null;
  reason: string | null;
  processed_user_count: number;
  created_snapshot_count: number;
  created_adjustment_count: number;
  error_count: number;
  error_sample: Record<string, unknown> | null;
  created_at: string;
}

export interface SettlementJobInsertInput {
  id?: Uuid;
  job_type: SettlementJobType;
  settlement_date: string;
  mode: SettlementJobMode;
  status?: SettlementJobStatus;
  config_version_snapshot: Record<string, unknown>;
  started_at: string;
  triggered_by_admin_id?: Uuid | null;
  reason?: string | null;
}

export async function insertSettlementJob(
  db: DbClient,
  input: SettlementJobInsertInput,
): Promise<SettlementJobRow> {
  return db.queryRequired<SettlementJobRow>(
    `insert into settlement_jobs (
        id, job_type, settlement_date, mode, status,
        config_version_snapshot, started_at,
        triggered_by_admin_id, reason
      ) values (
        coalesce($1, gen_random_uuid()),
        $2, $3, $4, coalesce($5, 'running'),
        $6::jsonb, $7, $8, $9
      )
      returning *`,
    [
      input.id ?? null,
      input.job_type,
      input.settlement_date,
      input.mode,
      input.status ?? null,
      JSON.stringify(input.config_version_snapshot),
      input.started_at,
      input.triggered_by_admin_id ?? null,
      input.reason ?? null,
    ],
  );
}

export interface SettlementJobFinalizeInput {
  id: Uuid;
  status: SettlementJobStatus;
  finished_at: string;
  processed_user_count: number;
  created_snapshot_count: number;
  created_adjustment_count: number;
  error_count: number;
  error_sample?: Record<string, unknown> | null;
}

export async function finalizeSettlementJob(
  db: DbClient,
  input: SettlementJobFinalizeInput,
): Promise<SettlementJobRow> {
  return db.queryRequired<SettlementJobRow>(
    `update settlement_jobs
        set status = $2,
            finished_at = $3,
            processed_user_count = $4,
            created_snapshot_count = $5,
            created_adjustment_count = $6,
            error_count = $7,
            error_sample = $8::jsonb
      where id = $1
      returning *`,
    [
      input.id,
      input.status,
      input.finished_at,
      input.processed_user_count,
      input.created_snapshot_count,
      input.created_adjustment_count,
      input.error_count,
      input.error_sample === undefined || input.error_sample === null
        ? null
        : JSON.stringify(input.error_sample),
    ],
  );
}

export async function findSettlementJobById(
  db: DbClient,
  id: Uuid,
): Promise<SettlementJobRow | null> {
  return db.queryOne<SettlementJobRow>(
    `select * from settlement_jobs where id = $1`,
    [id],
  );
}

/**
 * BE-52 idempotency guard. Returns the most recent non-failed
 * settlement job for `(settlement_date, mode)`, or null if no such
 * job exists. The orchestrator uses this to reject a re-run after a
 * successful or still-running settlement has been recorded for the
 * same day/mode pair — otherwise a second run would double-credit
 * every user for that day.
 */
export async function findNonFailedSettlementJob(
  db: DbClient,
  settlement_date: string,
  mode: SettlementJobMode,
): Promise<SettlementJobRow | null> {
  return db.queryOne<SettlementJobRow>(
    `select *
       from settlement_jobs
      where settlement_date = $1
        and mode = $2
        and status <> 'failed'
      order by created_at desc
      limit 1`,
    [settlement_date, mode],
  );
}

/**
 * BE-51 idempotency guard — advisory lock acquisition. At most one
 * concurrent settlement run per `(settlement_date, mode)` key can
 * hold this lock. Uses Postgres's two-int advisory lock namespace so
 * the keys are deterministic without an extra cast path.
 *
 * Returns `true` if the lock was acquired, `false` if another session
 * already holds it. The caller must pair a successful acquisition
 * with a matching `releaseSettlementLock` in a `finally` block.
 */
export async function tryAcquireSettlementLock(
  db: DbClient,
  settlement_date: string,
  mode: SettlementJobMode,
): Promise<boolean> {
  const row = await db.queryOne<{ acquired: boolean | null }>(
    `select pg_try_advisory_lock(hashtext($1), hashtext($2)) as acquired`,
    [`posx:settlement:${settlement_date}`, `mode:${mode}`],
  );
  return row?.acquired === true;
}

export async function releaseSettlementLock(
  db: DbClient,
  settlement_date: string,
  mode: SettlementJobMode,
): Promise<void> {
  await db.queryOne<{ released: boolean | null }>(
    `select pg_advisory_unlock(hashtext($1), hashtext($2)) as released`,
    [`posx:settlement:${settlement_date}`, `mode:${mode}`],
  );
}
