/**
 * Unit tests for `ReportExportWorkerService`.
 *
 * Uses a hand-rolled in-memory `DbClient` so the worker can be
 * exercised end-to-end without a real Postgres. Every SQL call is
 * intercepted: we match the known statements and either return
 * fixture rows or mutate an in-memory `jobs` table.
 *
 * What the tests cover:
 *   - Happy path: createAndRun transitions queued → running → completed
 *   - CSV formatting: headers line followed by row lines, quoting
 *   - Blob retrieval: getBlob returns the stored CSV
 *   - Failure path: an unknown report_type marks the job failed
 */
import { describe, expect, it } from 'vitest';

import {
  InMemoryBlobStore,
  ReportExportWorkerService,
} from '../src/services/report-export-worker';
import type { DbClient } from '../src/db/client';

// ---- Fake DbClient -------------------------------------------------------

interface JobRow {
  id: string;
  requested_by_admin_id: string | null;
  report_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  filters: Record<string, unknown> | null;
  file_path: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

interface FakeRows {
  readonly purchases?: Record<string, unknown>[];
  readonly teamRanking?: Record<string, unknown>[];
  readonly teamRewards?: Record<string, unknown>[];
}

function createFakeDb(rows: FakeRows): DbClient {
  const jobs = new Map<string, JobRow>();
  let nextId = 1;

  const fakeNow = () => '2026-04-14T10:00:00.000Z';

  async function query<T>(sql: string, _params: unknown[] = []): Promise<T[]> {
    if (/from purchases/.test(sql)) {
      return (rows.purchases ?? []) as unknown as T[];
    }
    if (/from team_rewards_daily/.test(sql) && /row_number/.test(sql) === false) {
      return (rows.teamRewards ?? []) as unknown as T[];
    }
    if (/row_number\(\) over/.test(sql)) {
      return (rows.teamRanking ?? []) as unknown as T[];
    }
    // Unknown select — return empty for robustness.
    return [] as unknown as T[];
  }

  async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    // INSERT returning *
    if (/insert into report_export_jobs/.test(sql)) {
      const id = `job-${nextId++}`;
      const row: JobRow = {
        id,
        requested_by_admin_id: params[0] as string | null,
        report_type: params[1] as string,
        status: (params[2] as JobRow['status'] | null) ?? 'queued',
        filters: params[3] === null ? null : JSON.parse(params[3] as string),
        file_path: null,
        error_message: null,
        created_at: fakeNow(),
        finished_at: null,
      };
      jobs.set(id, row);
      return row as unknown as T;
    }
    // SELECT * FROM report_export_jobs WHERE id = $1
    if (/^select \* from report_export_jobs where id/.test(sql)) {
      const id = params[0] as string;
      return (jobs.get(id) ?? null) as unknown as T | null;
    }
    // UPDATE ... status = 'running' ... WHERE id = $1 AND status = 'queued'
    if (/set status = 'running'/.test(sql)) {
      const id = params[0] as string;
      const row = jobs.get(id);
      if (!row || row.status !== 'queued') return null;
      row.status = 'running';
      return row as unknown as T;
    }
    // UPDATE ... status = 'completed' ... WHERE id = $1 AND status = 'running'
    if (/set status = 'completed'/.test(sql)) {
      const id = params[0] as string;
      const filePath = params[1] as string;
      const finishedAt = params[2] as string;
      const row = jobs.get(id);
      if (!row || row.status !== 'running') return null;
      row.status = 'completed';
      row.file_path = filePath;
      row.finished_at = finishedAt;
      return row as unknown as T;
    }
    // UPDATE ... status = 'failed' ...
    if (/set status = 'failed'/.test(sql)) {
      const id = params[0] as string;
      const errorMessage = params[1] as string;
      const finishedAt = params[2] as string;
      const row = jobs.get(id);
      if (!row || (row.status !== 'queued' && row.status !== 'running')) return null;
      row.status = 'failed';
      row.error_message = errorMessage;
      row.finished_at = finishedAt;
      return row as unknown as T;
    }
    return null;
  }

  async function queryRequired<T>(sql: string, params: unknown[] = []): Promise<T> {
    const row = await queryOne<T>(sql, params);
    if (!row) throw new Error(`fake db: queryRequired got null for: ${sql.slice(0, 40)}`);
    return row;
  }

  async function transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    return fn({ query, queryOne, queryRequired, transaction, close } as DbClient);
  }

  async function close(): Promise<void> {
    // no-op for tests
  }

  return { query, queryOne, queryRequired, transaction, close } as DbClient;
}

// ---- Tests ---------------------------------------------------------------

describe('ReportExportWorkerService — happy path', () => {
  it('runs an export end-to-end and stores a CSV blob', async () => {
    const store = new InMemoryBlobStore();
    const db = createFakeDb({
      purchases: [
        {
          wallet_address: '0xaaa',
          usdt_amount: '100',
          tx_hash: '0xtx1',
          purchase_at: '2026-04-02T10:00:00.000Z',
        },
        {
          wallet_address: '0xbbb,with,commas',
          usdt_amount: '200',
          tx_hash: '0xtx2',
          purchase_at: '2026-04-03T10:00:00.000Z',
        },
      ],
    });
    const worker = new ReportExportWorkerService(
      db,
      store,
      () => '2026-04-14T10:00:00.000Z',
    );

    const { job, result } = await worker.createAndRun({
      requestedByAdminId: 'admin-1',
      reportType: 'deposit',
    });

    expect(result.status).toBe('completed');
    expect(result.rowCount).toBe(2);
    expect(job.status).toBe('completed');
    expect(job.file_path).toMatch(/^mem:\/\//);

    const blob = await worker.getBlob(job.id);
    expect(blob).not.toBeNull();
    expect(blob?.contentType).toBe('text/csv; charset=utf-8');
    expect(blob?.body).toContain('wallet_address,usdt_amount,tx_hash,purchase_at');
    // First row — unescaped
    expect(blob?.body).toContain('0xaaa,100,0xtx1,2026-04-02T10:00:00.000Z');
    // Second row — quoted because of commas
    expect(blob?.body).toContain('"0xbbb,with,commas",200,0xtx2,2026-04-03T10:00:00.000Z');
  });
});

describe('ReportExportWorkerService — failure path', () => {
  it('marks the job failed when report_type is unknown', async () => {
    const store = new InMemoryBlobStore();
    const db = createFakeDb({});
    const worker = new ReportExportWorkerService(
      db,
      store,
      () => '2026-04-14T10:00:00.000Z',
    );

    const { job, result } = await worker.createAndRun({
      requestedByAdminId: 'admin-1',
      reportType: 'nonsense_report',
    });

    expect(result.status).toBe('failed');
    expect(job.status).toBe('failed');
    expect(job.error_message).toMatch(/unknown report_type/);

    // No blob should have been stored.
    expect(await worker.getBlob(job.id)).toBeNull();
  });
});

describe('ReportExportWorkerService.listSupportedReports', () => {
  it('includes the specified report types from the Phase 6 contract', () => {
    const types = ReportExportWorkerService.listSupportedReports();
    expect(types).toContain('deposit');
    expect(types).toContain('team_reward');
    expect(types).toContain('equal_level_reward');
    expect(types).toContain('burn');
    expect(types).toContain('claim_payout_history');
    expect(types).toContain('team_ranking');
  });
});
