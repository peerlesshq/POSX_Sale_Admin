/**
 * System pages — Phase 3 audit remediation rewrite.
 *
 * Four pages live here:
 *   - ChainSyncPage — per-chain status cards + threshold lag + table
 *   - JobsPage      — filter bar + ErrorCell column + row detail drawer
 *   - HealthPage    — per-service cards with icons + structured detail
 *                     (replaces the `<div>JSON.stringify(detail)</div>`)
 *   - LogsPage      — filter bar (action/admin/target/time) + row drawer
 *
 * All four pages now adopt the Phase 1 primitives:
 *   SectionCard (icon / tone / statusPill / timestamp slots),
 *   ThresholdCell, ErrorCell, FilterBar + filterFields, JsonViewer (tree),
 *   RoleBadge.
 */
import { useQuery } from '@tanstack/react-query';
import { Drawer } from 'antd';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  HardDrive,
  Hash,
  RefreshCw,
  ScrollText,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { api } from '../api/endpoints';
import {
  CountCell,
  DataTable,
  EmptyHint,
  ErrorCell,
  FilterBar,
  InlineError,
  JsonViewer,
  KeyValuePanel,
  PageHeader,
  SectionCard,
  SelectField,
  StatusBadge,
  TextField,
  ThresholdCell,
  TimeCell,
  TimeRangeField,
  WalletCell,
} from '../components/shared';
import { filterByRange } from '../lib/analytics';
import { resolveRange, type TimeRange } from '../lib/timeRange';
import { toNumber } from '../lib/format';
import { useT } from '../lib/i18n';
import type { KvItem } from '../components/shared';

type Row = Record<string, unknown>;

/* ==================================================================
 * Chain Sync
 * ================================================================== */

interface ChainSyncRow extends Row {
  readonly chain_id: unknown;
  readonly contract_address: unknown;
  readonly sync_key: unknown;
  readonly last_scanned_block: unknown;
  readonly last_confirmed_block: unknown;
  readonly updated_at: unknown;
}

export function ChainSyncPage() {
  const t = useT();
  const { data, isLoading, isError, error: err, refetch, dataUpdatedAt } = useQuery<Row>({
    queryKey: ['admin', 'chain-sync'],
    queryFn: () => api.chainSync(),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const rows = ((data?.['items'] as ChainSyncRow[]) ?? []) as ChainSyncRow[];

  const summary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let err = 0;
    for (const r of rows) {
      const lag = Math.max(
        0,
        toNumber(r['last_scanned_block']) - toNumber(r['last_confirmed_block']),
      );
      if (lag > 20) err += 1;
      else if (lag > 5) warn += 1;
      else ok += 1;
    }
    const tone: 'success' | 'warn' | 'danger' | 'default' =
      err > 0 ? 'danger' : warn > 0 ? 'warn' : ok > 0 ? 'success' : 'default';
    const label =
      err > 0
        ? t('system.chain_sync.status.degraded', 'Degraded')
        : warn > 0
          ? t('system.chain_sync.status.watching', 'Watching')
          : ok > 0
            ? t('system.chain_sync.status.healthy', 'Healthy')
            : t('common.empty.default_title', 'No data');
    return { ok, warn, err, tone, label };
  }, [rows, t]);

  return (
    <div>
      <PageHeader
        title={t('system.chain_sync.title')}
        subtitle={t('system.chain_sync.subtitle')}
      />

      {isError && (
        <div style={{ marginBottom: 16 }}>
          <InlineError
            title={t('common.error')}
            description={err instanceof Error ? err.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {/* Per-chain status grid */}
      {!isError && (
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          marginBottom: 16,
        }}
      >
        {isLoading || rows.length === 0
          ? Array.from({ length: 2 }).map((_, i) => (
              <SectionCard
                key={`skel-${i}`}
                status="loading"
                loadingRows={3}
                title="—"
                padded
              />
            ))
          : rows.map((row) => (
              <ChainSyncCard key={`${row['chain_id']}-${row['contract_address']}-${row['sync_key']}`} row={row} />
            ))}
      </div>
      )}

      {!isError && (
      <SectionCard
        icon={<Database size={14} />}
        title={t('system.chain_sync.all_indexers', 'All indexers')}
        hint={t('system.chain_sync.all_indexers_hint', 'Every scanned contract and sync key')}
        tone={summary.tone}
        statusPill={
          <span
            className="px-tabular"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 'var(--px-radius-pill)',
              background:
                summary.tone === 'danger'
                  ? 'var(--px-status-err-soft)'
                  : summary.tone === 'warn'
                    ? 'var(--px-status-warn-soft)'
                    : 'var(--px-status-ok-soft)',
              color:
                summary.tone === 'danger'
                  ? 'var(--px-status-err)'
                  : summary.tone === 'warn'
                    ? 'var(--px-status-warn)'
                    : 'var(--px-status-ok)',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'currentColor',
              }}
            />
            {summary.label}
          </span>
        }
        timestamp={
          dataUpdatedAt
            ? `${t('common.updated', 'Updated')} ${formatSecondsAgo(dataUpdatedAt)}`
            : undefined
        }
        actions={
          <button
            type="button"
            className="px-icon-btn"
            onClick={() => void refetch()}
            title={t('common.refresh', 'Refresh')}
            aria-label="refresh"
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--px-radius-xs)',
              border: '1px solid var(--px-border)',
              background: 'transparent',
              color: 'var(--px-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
          </button>
        }
        padded={false}
      >
        <DataTable<ChainSyncRow>
          rowKey={(r) => `${r['chain_id']}-${r['contract_address']}-${r['sync_key']}`}
          dataSource={rows}
          pagination={false}
          loading={isLoading}
          columns={[
            {
              title: t('system.chain_sync.col.chain'),
              dataIndex: 'chain_id',
              render: (v: unknown) => (
                <span style={{ fontWeight: 500 }}>#{String(v)}</span>
              ),
            },
            {
              title: t('system.chain_sync.col.contract'),
              dataIndex: 'contract_address',
              render: (v: string) => <WalletCell value={v} />,
            },
            { title: t('system.chain_sync.col.key'), dataIndex: 'sync_key' },
            {
              title: t('system.chain_sync.col.last_scanned'),
              dataIndex: 'last_scanned_block',
              align: 'right',
              render: (v: unknown) => <CountCell value={v} />,
            },
            {
              title: t('system.chain_sync.col.last_confirmed'),
              dataIndex: 'last_confirmed_block',
              align: 'right',
              render: (v: unknown) => <CountCell value={v} />,
            },
            {
              title: t('system.chain_sync.col.lag'),
              align: 'right',
              render: (_: unknown, row: ChainSyncRow) => {
                const lag = Math.max(
                  0,
                  toNumber(row['last_scanned_block']) -
                    toNumber(row['last_confirmed_block']),
                );
                return (
                  <ThresholdCell
                    value={lag}
                    thresholds={[5, 20]}
                    suffix={t('system.chain_sync.blocks', 'blocks')}
                  />
                );
              },
            },
            {
              title: t('system.chain_sync.col.updated'),
              dataIndex: 'updated_at',
              render: (v: unknown) => <TimeCell value={v} mode="relative" />,
            },
          ]}
        />
      </SectionCard>
      )}
    </div>
  );
}

function ChainSyncCard({ row }: { row: ChainSyncRow }) {
  const t = useT();
  const scanned = toNumber(row['last_scanned_block']);
  const confirmed = toNumber(row['last_confirmed_block']);
  const lag = Math.max(0, scanned - confirmed);
  const tone: 'success' | 'warn' | 'danger' =
    lag > 20 ? 'danger' : lag > 5 ? 'warn' : 'success';
  const icon = tone === 'danger' ? <AlertTriangle size={14} /> : <GitBranch size={14} />;

  return (
    <SectionCard
      icon={icon}
      tone={tone}
      title={
        <span style={{ fontFamily: 'var(--px-font-mono)', fontSize: 13 }}>
          #{String(row['chain_id'])} · {String(row['sync_key'])}
        </span>
      }
      hint={<WalletCell value={String(row['contract_address'] ?? '')} />}
      statusPill={
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 'var(--px-radius-pill)',
            color:
              tone === 'danger'
                ? 'var(--px-status-err)'
                : tone === 'warn'
                  ? 'var(--px-status-warn)'
                  : 'var(--px-status-ok)',
            background:
              tone === 'danger'
                ? 'var(--px-status-err-soft)'
                : tone === 'warn'
                  ? 'var(--px-status-warn-soft)'
                  : 'var(--px-status-ok-soft)',
          }}
        >
          {t(`system.chain_sync.tone.${tone}`, tone)}
        </span>
      }
      timestamp={<TimeCell value={row['updated_at']} mode="relative" />}
      padded
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div>
          <div
            style={{ fontSize: 10.5, color: 'var(--px-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            {t('system.chain_sync.col.last_scanned')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {scanned.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            style={{ fontSize: 10.5, color: 'var(--px-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            {t('system.chain_sync.col.last_confirmed')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {confirmed.toLocaleString()}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1', marginTop: 2 }}>
          <div
            style={{ fontSize: 10.5, color: 'var(--px-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}
          >
            {t('system.chain_sync.col.lag')}
          </div>
          <ThresholdCell
            value={lag}
            thresholds={[5, 20]}
            suffix={t('system.chain_sync.blocks', 'blocks')}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* ==================================================================
 * Job Runs
 * ================================================================== */

export function JobsPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);

  const { data, isLoading, isError, error: jobsErr, refetch } = useQuery<Row>({
    queryKey: ['admin', 'job-runs', page, pageSize],
    queryFn: () => api.jobRuns({ page, page_size: pageSize }),
    staleTime: 15_000,
  });

  const rawItems = (data?.['items'] as Row[]) ?? [];
  const total = toNumber((data?.['pagination'] as Row)?.['total']);

  const filtered = useMemo(() => {
    return rawItems.filter((row) => {
      if (statusFilter && String(row['status']) !== statusFilter) return false;
      if (
        nameFilter &&
        !String(row['job_name'] ?? '')
          .toLowerCase()
          .includes(nameFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [rawItems, statusFilter, nameFilter]);

  const summary = useMemo(() => {
    let ok = 0;
    let failed = 0;
    let running = 0;
    for (const r of rawItems) {
      const s = String(r['status']);
      if (s === 'ok' || s === 'success' || s === 'completed') ok += 1;
      else if (s === 'failed' || s === 'err' || s === 'error') failed += 1;
      else if (s === 'running') running += 1;
    }
    return { ok, failed, running };
  }, [rawItems]);

  const reset = () => {
    setStatusFilter('');
    setNameFilter('');
  };

  return (
    <div>
      <PageHeader title={t('system.jobs.title')} subtitle={t('system.jobs.subtitle')} />

      <SectionCard
        icon={<Zap size={14} />}
        title={t('system.jobs.title')}
        hint={t('system.jobs.hint', 'Background and scheduled job runs')}
        statusPill={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 11,
              color: 'var(--px-text-secondary)',
            }}
          >
            <span>
              <CheckCircle2 size={10} style={{ color: 'var(--px-status-ok)', verticalAlign: 'middle', marginRight: 3 }} />
              {summary.ok}
            </span>
            <span>
              <RefreshCw size={10} style={{ color: 'var(--px-status-info)', verticalAlign: 'middle', marginRight: 3 }} />
              {summary.running}
            </span>
            <span>
              <AlertTriangle size={10} style={{ color: 'var(--px-status-err)', verticalAlign: 'middle', marginRight: 3 }} />
              {summary.failed}
            </span>
          </span>
        }
        filterSlot={
          <FilterBar bare onReset={reset} onRefresh={() => void refetch()}>
            <TextField
              label={t('system.jobs.filter.name', 'Job name')}
              value={nameFilter}
              onChange={setNameFilter}
              placeholder={t('system.jobs.filter.name_placeholder', 'e.g. settlement_run')}
            />
            <SelectField
              label={t('system.jobs.filter.status', 'Status')}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ok', label: t('status.ok', 'OK') },
                { value: 'running', label: t('status.running', 'Running') },
                { value: 'failed', label: t('status.failed', 'Failed') },
                { value: 'pending', label: t('status.pending', 'Pending') },
              ]}
            />
          </FilterBar>
        }
        padded={false}
      >
        {isError ? (
          <InlineError
            title={t('common.error')}
            description={jobsErr instanceof Error ? jobsErr.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
            compact
          />
        ) : (
        <DataTable<Row>
          rowKey={(r) => String(r['job_run_id'] ?? Math.random())}
          dataSource={filtered}
          loading={isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(row) => ({
            onClick: () => setSelected(row),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('system.jobs.col.name'),
              dataIndex: 'job_name',
              render: (v: string) => (
                <span style={{ fontWeight: 500 }}>{v}</span>
              ),
            },
            {
              title: t('system.jobs.col.status'),
              dataIndex: 'status',
              render: (v: string) => <StatusBadge value={v} />,
            },
            {
              title: t('system.jobs.col.started'),
              dataIndex: 'started_at',
              render: (v: unknown) => <TimeCell value={v} mode="relative" />,
            },
            {
              title: t('system.jobs.col.finished'),
              dataIndex: 'finished_at',
              render: (v: unknown) => <TimeCell value={v} mode="relative" />,
            },
            {
              title: t('system.jobs.col.processed'),
              dataIndex: 'rows_processed',
              align: 'right',
              render: (v: unknown) => <CountCell value={v} />,
            },
            {
              title: t('system.jobs.col.failed'),
              dataIndex: 'rows_failed',
              align: 'right',
              render: (v: unknown) => (
                <ThresholdCell
                  value={v}
                  thresholds={[0, 0]}
                  format={(n) => n.toLocaleString()}
                />
              ),
            },
            {
              title: t('system.jobs.col.error'),
              dataIndex: 'error_message',
              render: (v: unknown) => (
                <ErrorCell value={v} limit={80} title={t('system.jobs.error_drawer', 'Job error detail')} />
              ),
            },
          ]}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
        )}
      </SectionCard>

      <Drawer
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} /> {t('system.jobs.detail_title', 'Job run detail')}
          </span>
        }
        open={!!selected}
        onClose={() => setSelected(null)}
        width={640}
      >
        {selected && <JsonViewer value={selected} maxHeight={720} rootLabel={String(selected['job_name'] ?? 'job')} />}
      </Drawer>
    </div>
  );
}

/* ==================================================================
 * Health
 * ================================================================== */

type HealthStatus = 'ok' | 'warn' | 'err';

interface HealthCheckRow {
  readonly key: string;
  readonly status: HealthStatus;
  readonly detail: Record<string, unknown> | null;
}

const HEALTH_ICON_MAP: Record<string, ReactNode> = {
  database: <Database size={14} />,
  db: <Database size={14} />,
  postgres: <Database size={14} />,
  chain: <GitBranch size={14} />,
  rpc: <Server size={14} />,
  scanner: <Activity size={14} />,
  queue: <HardDrive size={14} />,
  worker: <Zap size={14} />,
  auth: <Shield size={14} />,
  settlement: <CheckCircle2 size={14} />,
};

function healthIcon(key: string): ReactNode {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(HEALTH_ICON_MAP)) {
    if (lower.includes(k)) return v;
  }
  return <Activity size={14} />;
}

function normalizeHealthStatus(v: unknown): HealthStatus {
  if (v === 'ok' || v === 'healthy' || v === 'up') return 'ok';
  if (v === 'err' || v === 'error' || v === 'down' || v === 'fail') return 'err';
  return 'warn';
}

export function HealthPage() {
  const t = useT();
  const { data, isLoading, isError, error: healthErr, refetch, dataUpdatedAt } = useQuery<Row>({
    queryKey: ['admin', 'system-health'],
    queryFn: () => api.systemHealth(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const checks: HealthCheckRow[] = useMemo(() => {
    const raw = (data?.['checks'] as Row[]) ?? [];
    return raw.map((c) => ({
      key: String(c['health_key'] ?? 'unknown'),
      status: normalizeHealthStatus(c['status']),
      detail:
        c['detail'] && typeof c['detail'] === 'object'
          ? (c['detail'] as Record<string, unknown>)
          : null,
    }));
  }, [data]);

  const summary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let err = 0;
    for (const c of checks) {
      if (c.status === 'ok') ok += 1;
      else if (c.status === 'warn') warn += 1;
      else err += 1;
    }
    return { ok, warn, err };
  }, [checks]);

  const overallTone: 'success' | 'warn' | 'danger' | 'default' =
    summary.err > 0 ? 'danger' : summary.warn > 0 ? 'warn' : summary.ok > 0 ? 'success' : 'default';

  return (
    <div>
      <PageHeader
        title={t('system.health.title')}
        subtitle={t('system.health.subtitle')}
      />

      {/* Top summary strip */}
      <SectionCard
        icon={<Activity size={14} />}
        title={t('system.health.overall', 'Overall system health')}
        hint={t('system.health.overall_hint', 'Aggregated across all monitored services')}
        tone={overallTone}
        statusPill={<HealthOverallPill tone={overallTone} locale={t} counts={summary} />}
        timestamp={
          dataUpdatedAt
            ? `${t('common.updated', 'Updated')} ${formatSecondsAgo(dataUpdatedAt)}`
            : undefined
        }
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            title={t('common.refresh', 'Refresh')}
            aria-label="refresh"
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--px-radius-xs)',
              border: '1px solid var(--px-border)',
              background: 'transparent',
              color: 'var(--px-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
          </button>
        }
        padded
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          <HealthStatSummary
            icon={<CheckCircle2 size={14} style={{ color: 'var(--px-status-ok)' }} />}
            label={t('status.ok', 'Healthy')}
            value={summary.ok}
            tone="success"
          />
          <HealthStatSummary
            icon={<AlertTriangle size={14} style={{ color: 'var(--px-status-warn)' }} />}
            label={t('status.warn', 'Warning')}
            value={summary.warn}
            tone="warn"
          />
          <HealthStatSummary
            icon={<AlertTriangle size={14} style={{ color: 'var(--px-status-err)' }} />}
            label={t('status.err', 'Error')}
            value={summary.err}
            tone="danger"
          />
        </div>
      </SectionCard>

      {/* Per-service grid */}
      {isError ? (
        <div style={{ marginTop: 16 }}>
          <InlineError
            title={t('common.error')}
            description={healthErr instanceof Error ? healthErr.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
          />
        </div>
      ) : isLoading && checks.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <SectionCard status="loading" loadingRows={4} padded title="—" />
        </div>
      ) : checks.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <SectionCard
            status="empty"
            emptyTitle={t('system.health.empty', 'No health checks configured')}
            padded
          />
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          }}
        >
          {checks.map((c) => (
            <HealthServiceCard key={c.key} check={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function HealthStatSummary({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: ReactNode;
  value: number;
  tone: 'success' | 'warn' | 'danger';
}) {
  const accent =
    tone === 'success'
      ? 'var(--px-status-ok)'
      : tone === 'warn'
        ? 'var(--px-status-warn)'
        : 'var(--px-status-err)';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 14px',
        border: '1px solid var(--px-border-subtle)',
        borderRadius: 'var(--px-radius-md)',
        background: 'var(--px-bg-surface-raised)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--px-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function HealthOverallPill({
  tone,
  counts,
  locale: tFn,
}: {
  tone: 'success' | 'warn' | 'danger' | 'default';
  counts: { ok: number; warn: number; err: number };
  locale: ReturnType<typeof useT>;
}) {
  const label =
    tone === 'danger'
      ? tFn('system.health.label.degraded', 'Degraded')
      : tone === 'warn'
        ? tFn('system.health.label.watching', 'Watching')
        : tone === 'success'
          ? tFn('system.health.label.healthy', 'All healthy')
          : tFn('common.empty.default_title', 'No data');
  const color =
    tone === 'danger'
      ? 'var(--px-status-err)'
      : tone === 'warn'
        ? 'var(--px-status-warn)'
        : tone === 'success'
          ? 'var(--px-status-ok)'
          : 'var(--px-text-tertiary)';
  const bg =
    tone === 'danger'
      ? 'var(--px-status-err-soft)'
      : tone === 'warn'
        ? 'var(--px-status-warn-soft)'
        : tone === 'success'
          ? 'var(--px-status-ok-soft)'
          : 'var(--px-bg-surface-raised)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 'var(--px-radius-pill)',
        background: bg,
        color,
        fontSize: 11.5,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'currentColor',
          boxShadow: '0 0 0 3px currentColor',
          opacity: 0.25,
        }}
      />
      {label} · {counts.ok + counts.warn + counts.err}
    </span>
  );
}

function HealthServiceCard({ check }: { check: HealthCheckRow }) {
  const t = useT();
  const tone: 'success' | 'warn' | 'danger' =
    check.status === 'ok' ? 'success' : check.status === 'warn' ? 'warn' : 'danger';
  const color =
    tone === 'danger'
      ? 'var(--px-status-err)'
      : tone === 'warn'
        ? 'var(--px-status-warn)'
        : 'var(--px-status-ok)';
  const bg =
    tone === 'danger'
      ? 'var(--px-status-err-soft)'
      : tone === 'warn'
        ? 'var(--px-status-warn-soft)'
        : 'var(--px-status-ok-soft)';

  const kvItems = useMemo<readonly KvItem[]>(() => {
    if (!check.detail) return [];
    return Object.entries(check.detail)
      .slice(0, 6)
      .map(([k, v]) => ({
        key: k,
        label: k,
        value: formatHealthDetailValue(v),
      }));
  }, [check.detail]);

  const hasRemainingDetail =
    check.detail !== null && Object.keys(check.detail).length > 6;

  return (
    <SectionCard
      icon={healthIcon(check.key)}
      tone={tone}
      title={<span style={{ fontFamily: 'var(--px-font-mono)', fontSize: 13 }}>{check.key}</span>}
      statusPill={
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px',
            borderRadius: 'var(--px-radius-pill)',
            background: bg,
            color,
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'currentColor',
            }}
          />
          {t(`status.${check.status}`, check.status.toUpperCase())}
        </span>
      }
      dense
      padded
    >
      {kvItems.length > 0 ? (
        <>
          <KeyValuePanel items={kvItems} columns={2} compact />
          {hasRemainingDetail && check.detail && (
            <details style={{ marginTop: 10 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--px-text-link)',
                  fontSize: 11,
                }}
              >
                {t('system.health.full_detail', 'Full detail')}
              </summary>
              <div style={{ marginTop: 8 }}>
                <JsonViewer value={check.detail} maxHeight={240} dense searchable={false} />
              </div>
            </details>
          )}
        </>
      ) : (
        <div
          style={{
            fontSize: 11,
            color: 'var(--px-text-tertiary)',
            fontStyle: 'italic',
          }}
        >
          {t('system.health.no_detail', 'No detail reported by this check.')}
        </div>
      )}
    </SectionCard>
  );
}

function formatHealthDetailValue(v: unknown): ReactNode {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (typeof v === 'number') {
    return <span className="px-tabular">{v.toLocaleString()}</span>;
  }
  if (typeof v === 'string') {
    // Truncate very long strings
    return v.length > 40 ? <span title={v}>{v.slice(0, 40)}…</span> : v;
  }
  try {
    return <span className="px-tabular">{JSON.stringify(v).slice(0, 40)}</span>;
  } catch {
    return String(v);
  }
}

/* ==================================================================
 * Logs — with filter bar + drawer detail
 * ================================================================== */

const LOG_ACTION_OPTIONS = [
  { value: 'create_admin', label: 'create_admin' },
  { value: 'disable_admin', label: 'disable_admin' },
  { value: 'update_user_status', label: 'update_user_status' },
  { value: 'trigger_settlement', label: 'trigger_settlement' },
  { value: 'recompute_apply', label: 'recompute_apply' },
  { value: 'create_config_version', label: 'create_config_version' },
  { value: 'activate_config_version', label: 'activate_config_version' },
];

export function LogsPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Row | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [range, setRange] = useState<TimeRange>(() => resolveRange('7d'));

  const { data, isLoading, isError, error: logsErr, refetch } = useQuery<Row>({
    queryKey: ['admin', 'logs', page, pageSize],
    queryFn: () => api.logs({ page, page_size: pageSize }),
    staleTime: 15_000,
  });
  const rawItems = (data?.['items'] as Row[]) ?? [];
  const total = toNumber((data?.['pagination'] as Row)?.['total']);

  const filtered = useMemo(() => {
    return filterByRange(rawItems, (row) => row['created_at'], range).filter((row) => {
      if (actionFilter && String(row['action']) !== actionFilter) return false;
      if (
        adminFilter &&
        !String(row['admin_user_id'] ?? '')
          .toLowerCase()
          .includes(adminFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        targetFilter &&
        !String(row['target_id'] ?? '')
          .toLowerCase()
          .includes(targetFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [rawItems, range, actionFilter, adminFilter, targetFilter]);

  const reset = () => {
    setActionFilter('');
    setAdminFilter('');
    setTargetFilter('');
    setRange(resolveRange('7d'));
  };

  return (
    <div>
      <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')} />
      <SectionCard
        icon={<ScrollText size={14} />}
        title={t('logs.title')}
        hint={t('logs.hint', 'Admin audit trail — click any row to see full JSON.')}
        timestamp={`${filtered.length}/${rawItems.length} ${t('logs.shown', 'shown')}`}
        filterSlot={
          <FilterBar bare onReset={reset} onRefresh={() => void refetch()}>
            <TimeRangeField
              value={range}
              onChange={setRange}
              label={t('filters.range', 'Range')}
            />
            <SelectField
              label={t('logs.filter.action', 'Action')}
              value={actionFilter}
              onChange={setActionFilter}
              options={LOG_ACTION_OPTIONS}
              minWidth={200}
            />
            <TextField
              label={t('logs.filter.admin', 'Admin')}
              value={adminFilter}
              onChange={setAdminFilter}
              placeholder={t('logs.filter.admin_placeholder', 'User id contains…')}
            />
            <TextField
              label={t('logs.filter.target', 'Target')}
              value={targetFilter}
              onChange={setTargetFilter}
              placeholder={t('logs.filter.target_placeholder', 'Target id contains…')}
            />
          </FilterBar>
        }
        padded={false}
      >
        {isError ? (
          <InlineError
            title={t('common.error')}
            description={logsErr instanceof Error ? logsErr.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
            compact
          />
        ) : (
        <DataTable<Row>
          rowKey={(r) => String(r['admin_log_id'] ?? Math.random())}
          dataSource={filtered}
          loading={isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(row) => ({
            onClick: () => setSelected(row),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('logs.col.when'),
              dataIndex: 'created_at',
              render: (v: unknown) => <TimeCell value={v} mode="relative" />,
            },
            {
              title: t('logs.col.admin'),
              dataIndex: 'admin_user_id',
              render: (v: string) =>
                v ? (
                  <span
                    className="px-mono"
                    style={{ fontSize: 11, color: 'var(--px-text-secondary)' }}
                    title={v}
                  >
                    {v.slice(0, 10)}
                  </span>
                ) : (
                  <span className="px-text-tertiary">—</span>
                ),
            },
            {
              title: t('logs.col.action'),
              dataIndex: 'action',
              render: (v: string) => (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 8px',
                    borderRadius: 'var(--px-radius-sm)',
                    background: 'var(--px-brand-soft)',
                    color: 'var(--px-text-link)',
                    fontFamily: 'var(--px-font-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  <Hash size={10} />
                  {v}
                </span>
              ),
            },
            { title: t('logs.col.target'), dataIndex: 'target_type' },
            {
              title: t('logs.col.target_id'),
              dataIndex: 'target_id',
              render: (v: string) =>
                v ? (
                  <span
                    className="px-mono"
                    style={{ fontSize: 11, color: 'var(--px-text-secondary)' }}
                    title={v}
                  >
                    {v.slice(0, 14)}
                  </span>
                ) : (
                  <span className="px-text-tertiary">—</span>
                ),
            },
          ]}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
        )}
      </SectionCard>

      <Drawer
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ScrollText size={14} />{' '}
            {selected
              ? String(selected['action'] ?? t('logs.title'))
              : t('logs.title')}
          </span>
        }
        open={!!selected}
        onClose={() => setSelected(null)}
        width={640}
      >
        {selected && (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid var(--px-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={12} style={{ color: 'var(--px-text-tertiary)' }} />
                <TimeCell value={selected['created_at']} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--px-text-tertiary)' }}>
                {String(selected['target_type'] ?? '—')} ·{' '}
                <span className="px-mono">{String(selected['target_id'] ?? '—')}</span>
              </div>
            </div>
            <JsonViewer value={selected} maxHeight={560} rootLabel="log" />
          </>
        )}
      </Drawer>
    </div>
  );
}

/* ==================================================================
 * Helpers
 * ================================================================== */

function formatSecondsAgo(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}
