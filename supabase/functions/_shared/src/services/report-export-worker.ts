/**
 * Report export worker service.
 *
 * Phase 6 — promotes the export-job flow from "queue-only placeholder"
 * to "queue + real CSV generation + inline fetch" without touching
 * any reward/burn/claim business logic.
 *
 * How it works:
 *   1. `createAndRun()` inserts a queued row, immediately transitions
 *      it to `running`, runs a SQL query appropriate to the report
 *      type, formats the rows as CSV, and transitions to `completed`.
 *   2. The CSV bytes live in `blobCache` — an in-process Map keyed
 *      by job id. No DB migration, no object storage dependency.
 *      Appropriate for local/staging and for a single-replica
 *      production admin where the admin generates an export and
 *      downloads it in the same browser session.
 *   3. `getBlob()` reads back the CSV bytes for the download handler.
 *
 * Production note: in a multi-replica deployment, swap `blobCache`
 * for S3/GCS via a pluggable `BlobStore` interface. The rest of the
 * worker is storage-agnostic.
 *
 * State transitions go through the repo helpers in
 * `./repos/report-export-jobs.ts` — no open-coded status SQL here.
 */
import type { ReportType, Uuid } from '@posx/shared-types';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findReportExportJobById,
  insertReportExportJob,
  markReportExportCompleted,
  markReportExportFailed,
  markReportExportRunning,
  type ReportExportJobRow,
} from '../repos/report-export-jobs';

export interface ExportBlob {
  readonly contentType: string;
  readonly filename: string;
  readonly body: string;
}

/**
 * Minimal storage contract. The default implementation stores blobs
 * in an in-process Map; a production setup can provide an S3-backed
 * implementation without touching the worker.
 */
export interface BlobStore {
  put(id: Uuid, blob: ExportBlob): Promise<string>;
  get(id: Uuid): Promise<ExportBlob | null>;
}

export class InMemoryBlobStore implements BlobStore {
  private readonly cache = new Map<string, ExportBlob>();

  async put(id: Uuid, blob: ExportBlob): Promise<string> {
    this.cache.set(id, blob);
    return `mem://${id}`;
  }

  async get(id: Uuid): Promise<ExportBlob | null> {
    return this.cache.get(id) ?? null;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * BE-66/67 — database-backed blob store.
 *
 * Writes the CSV content into `report_export_jobs.blob_data` so it
 * survives cold starts, replica switches, and redeployments. This
 * replaces the in-memory singleton for staging/production.
 *
 * For reports >5 MB, a Supabase Storage (S3) implementation should
 * replace this as a follow-up. Inline DB storage is acceptable for
 * the admin export use-case where reports are typically <1 MB CSV.
 */
export class DatabaseBlobStore implements BlobStore {
  constructor(private readonly db: DbClient) {}

  async put(id: Uuid, blob: ExportBlob): Promise<string> {
    const payload = JSON.stringify({
      contentType: blob.contentType,
      filename: blob.filename,
      body: blob.body,
    });
    await this.db.query(
      `update report_export_jobs
          set blob_data = $2
        where id = $1`,
      [id, payload],
    );
    return `db://${id}`;
  }

  async get(id: Uuid): Promise<ExportBlob | null> {
    const row = await this.db.queryOne<{ blob_data: string | null }>(
      `select blob_data from report_export_jobs where id = $1`,
      [id],
    );
    if (!row?.blob_data) return null;
    try {
      const parsed = JSON.parse(row.blob_data) as {
        contentType: string;
        filename: string;
        body: string;
      };
      return parsed;
    } catch {
      return null;
    }
  }
}

// Process-wide singleton — used only as a local-dev fallback. In
// staging/production, handlers construct a `DatabaseBlobStore` from
// the request's `DbClient` instead.
export const defaultBlobStore = new InMemoryBlobStore();

// ---- CSV formatting ----

/** RFC 4180-ish CSV escaping: wrap in quotes, double any inner quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatCsv(headers: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  const lines: string[] = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// ---- Report query table ----
//
// Each report type maps to:
//   - A header row
//   - A SQL query that returns rows matching those headers
//
// Filters are optional; supported keys are documented per report type.

interface ReportDef {
  readonly headers: readonly string[];
  readonly query: (filters: Record<string, unknown>) => {
    sql: string;
    params: readonly unknown[];
  };
}

function iso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return value;
}

const REPORTS: Record<string, ReportDef> = {
  deposit: {
    headers: ['wallet_address', 'usdt_amount', 'tx_hash', 'purchase_at'],
    query: (filters) => {
      const from = iso(filters['from_date']);
      const to = iso(filters['to_date']);
      return {
        sql: `select wallet_address, usdt_amount::text, tx_hash, purchase_at
                from purchases
               where is_reversed = false
                 and ($1::date is null or purchase_at::date >= $1)
                 and ($2::date is null or purchase_at::date <= $2)
               order by purchase_at desc
               limit 10000`,
        params: [from, to],
      };
    },
  },
  direct_reward: {
    headers: [
      'from_wallet_address',
      'to_wallet_address',
      'reward_rate',
      'reward_amount',
      'tx_hash',
      'rewarded_at',
    ],
    query: (filters) => {
      const from = iso(filters['from_date']);
      const to = iso(filters['to_date']);
      return {
        sql: `select from_wallet_address, to_wallet_address,
                     reward_rate::text, reward_amount::text, tx_hash, rewarded_at
                from direct_rewards
               where ($1::date is null or rewarded_at::date >= $1)
                 and ($2::date is null or rewarded_at::date <= $2)
               order by rewarded_at desc
               limit 10000`,
        params: [from, to],
      };
    },
  },
  team_reward: {
    headers: [
      'wallet_address',
      'settle_date',
      'qualification_tier',
      'user_team_rate',
      'team_total_performance',
      'raw_total',
      'burned_amount',
      'actual_total',
      'status',
    ],
    query: (filters) => {
      const from = iso(filters['from_date']);
      const to = iso(filters['to_date']);
      return {
        sql: `select wallet_address, settle_date, qualification_tier,
                     user_team_rate::text, team_total_performance::text,
                     raw_total::text, burned_amount::text, actual_total::text, status
                from team_rewards_daily
               where ($1::date is null or settle_date >= $1)
                 and ($2::date is null or settle_date <= $2)
               order by settle_date desc
               limit 10000`,
        params: [from, to],
      };
    },
  },
  equal_level_reward: {
    headers: [
      'wallet_address',
      'line_root_wallet_address',
      'settle_date',
      'equal_level_rate',
      'raw_amount',
      'burned_amount',
      'actual_amount',
      'status',
    ],
    query: (filters) => {
      const from = iso(filters['from_date']);
      const to = iso(filters['to_date']);
      return {
        sql: `select wallet_address, line_root_wallet_address, settle_date,
                     equal_level_rate::text, raw_amount::text,
                     burned_amount::text, actual_amount::text, status
                from equal_level_rewards_daily
               where ($1::date is null or settle_date >= $1)
                 and ($2::date is null or settle_date <= $2)
               order by settle_date desc
               limit 10000`,
        params: [from, to],
      };
    },
  },
  reward_generation_raw: {
    // Raw totals BEFORE burn — sum of raw_reward_amount fields.
    headers: ['settle_date', 'wallet_address', 'raw_total'],
    query: () => ({
      sql: `select settle_date, wallet_address, raw_total::text
              from team_rewards_daily
             order by settle_date desc, wallet_address
             limit 10000`,
      params: [],
    }),
  },
  reward_generation_actual: {
    // Actual totals AFTER burn — matches what the user sees in the
    // rewards overview API.
    headers: ['settle_date', 'wallet_address', 'actual_total'],
    query: () => ({
      sql: `select settle_date, wallet_address, actual_total::text
              from team_rewards_daily
             order by settle_date desc, wallet_address
             limit 10000`,
      params: [],
    }),
  },
  burn: {
    headers: [
      'wallet_address',
      'reward_type',
      'settle_date',
      'raw_amount',
      'burned_amount',
      'actual_amount',
      'reason',
    ],
    query: (filters) => {
      const from = iso(filters['from_date']);
      const to = iso(filters['to_date']);
      return {
        sql: `select wallet_address, reward_type, settle_date,
                     raw_amount::text, burned_amount::text, actual_amount::text, reason
                from burn_records
               where ($1::date is null or settle_date >= $1)
                 and ($2::date is null or settle_date <= $2)
               order by settle_date desc
               limit 10000`,
        params: [from, to],
      };
    },
  },
  claim_payout_history: {
    headers: [
      'claim_order_id',
      'wallet_address',
      'amount',
      'tx_hash',
      'status',
      'recorded_at',
    ],
    query: (filters) => {
      const from = iso(filters['from_date']);
      const to = iso(filters['to_date']);
      return {
        sql: `select claim_order_id, wallet_address, amount::text,
                     tx_hash, status, recorded_at
                from claim_records
               where ($1::date is null or recorded_at::date >= $1)
                 and ($2::date is null or recorded_at::date <= $2)
               order by recorded_at desc
               limit 10000`,
        params: [from, to],
      };
    },
  },
  team_ranking: {
    headers: ['rank', 'wallet_address', 'team_total_performance', 'direct_count'],
    query: () => ({
      sql: `with ranked as (
               select u.wallet_address,
                      coalesce((select sum(p.usdt_amount) from referral_closure rc
                                  join purchases p on p.wallet_address = rc.descendant_wallet_address
                                 where rc.ancestor_wallet_address = u.wallet_address
                                   and p.is_reversed = false),0)::text as team_total_performance,
                      (select count(*)::int from referral_closure
                        where ancestor_wallet_address = u.wallet_address and depth = 1) as direct_count
                 from users u
             )
             select row_number() over (order by team_total_performance::numeric desc) as rank,
                    wallet_address, team_total_performance, direct_count
               from ranked
              order by team_total_performance::numeric desc
              limit 1000`,
      params: [],
    }),
  },
};

/**
 * Format the run result as a filename. Deterministic so the same
 * export overwrites cleanly on re-run.
 */
function filenameFor(job: ReportExportJobRow): string {
  return `${job.report_type}-${job.id}.csv`;
}

// ---- Worker service ----

export interface RunExportResult {
  readonly jobId: Uuid;
  readonly status: 'completed' | 'failed';
  readonly filePath: string | null;
  readonly errorMessage: string | null;
  readonly rowCount: number;
}

export class ReportExportWorkerService {
  constructor(
    private readonly db: DbClient,
    private readonly blobStore: BlobStore = defaultBlobStore,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /**
   * Insert a new queued job, immediately run it, and return the final
   * row. If execution fails, the job row is transitioned to `failed`
   * with an error message and the exception is swallowed — callers
   * should inspect the returned row.
   */
  async createAndRun(input: {
    requestedByAdminId: Uuid | null;
    reportType: ReportType | string;
    filters?: Record<string, unknown>;
  }): Promise<{ job: ReportExportJobRow; result: RunExportResult }> {
    const queued = await insertReportExportJob(this.db, {
      requested_by_admin_id: input.requestedByAdminId,
      report_type: input.reportType,
      filters: input.filters ?? null,
    });
    const result = await this.run(queued.id);
    const finalRow = await findReportExportJobById(this.db, queued.id);
    if (!finalRow) {
      throw new AppError('INTERNAL_ERROR', `export job ${queued.id} disappeared`);
    }
    return { job: finalRow, result };
  }

  /**
   * Pick up a queued job and run it. The job must be in `queued`
   * state — otherwise markReportExportRunning throws.
   */
  async run(jobId: Uuid): Promise<RunExportResult> {
    const row = await findReportExportJobById(this.db, jobId);
    if (!row) {
      throw new AppError('NOT_FOUND', `report export job ${jobId} not found`);
    }

    await markReportExportRunning(this.db, jobId);

    try {
      const def = REPORTS[row.report_type];
      if (!def) {
        throw new AppError(
          'INVALID_REQUEST',
          `unknown report_type: ${row.report_type}`,
        );
      }

      const { sql, params } = def.query(row.filters ?? {});
      const rows = await this.db.query<Record<string, unknown>>(sql, [...params]);
      const csv = formatCsv(def.headers, rows);

      const blob: ExportBlob = {
        contentType: 'text/csv; charset=utf-8',
        filename: filenameFor(row),
        body: csv,
      };
      const filePath = await this.blobStore.put(jobId, blob);

      await markReportExportCompleted(this.db, {
        id: jobId,
        filePath,
        finishedAt: this.clock(),
      });

      return {
        jobId,
        status: 'completed',
        filePath,
        errorMessage: null,
        rowCount: rows.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markReportExportFailed(this.db, {
        id: jobId,
        errorMessage: message,
        finishedAt: this.clock(),
      });
      return {
        jobId,
        status: 'failed',
        filePath: null,
        errorMessage: message,
        rowCount: 0,
      };
    }
  }

  /**
   * Return the on-disk/in-memory blob for a completed job. Returns
   * null when the job is not completed or its blob has been evicted.
   */
  async getBlob(jobId: Uuid): Promise<ExportBlob | null> {
    const row = await findReportExportJobById(this.db, jobId);
    if (!row || row.status !== 'completed') return null;
    return this.blobStore.get(jobId);
  }

  /**
   * List every report type the worker knows how to generate. Used by
   * the admin UI to populate its dropdown.
   */
  static listSupportedReports(): readonly string[] {
    return Object.keys(REPORTS);
  }
}
