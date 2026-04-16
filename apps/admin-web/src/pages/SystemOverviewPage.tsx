/**
 * System overview — Phase 5 audit remediation (IA-03).
 *
 * Previously the system surface had four flat sibling pages
 * (`/system/health`, `/system/chain-sync`, `/system/jobs`, `/logs`)
 * with no overview connecting them. When chain sync fell behind the
 * operator had to navigate between four unrelated pages to
 * reconstruct the incident.
 *
 * This page aggregates a one-screen snapshot of all four domains
 * with links to drill into each one. Every tile is a status card
 * computed from the same queries the sub-pages use, so there is
 * zero extra backend work required.
 */
import { useQueries } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  ScrollText,
  Zap,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/endpoints';
import {
  InlineError,
  PageHeader,
  PageShell,
  SectionCard,
  StatusBadge,
  ThresholdCell,
  TimeCell,
  type SectionTone,
} from '../components/shared';
import { toNumber } from '../lib/format';
import { useT } from '../lib/i18n';

type AnyRow = Record<string, unknown>;
type HealthTone = 'success' | 'warn' | 'danger' | 'default';

export function SystemOverviewPage() {
  const t = useT();
  const navigate = useNavigate();

  const queries = useQueries({
    queries: [
      {
        queryKey: ['admin', 'system-overview', 'health'],
        queryFn: () => api.systemHealth(),
        staleTime: 30_000,
      },
      {
        queryKey: ['admin', 'system-overview', 'chain-sync'],
        queryFn: () => api.chainSync(),
        staleTime: 30_000,
      },
      {
        queryKey: ['admin', 'system-overview', 'jobs'],
        queryFn: () => api.jobRuns({ page: 1, page_size: 5 }),
        staleTime: 30_000,
      },
      {
        queryKey: ['admin', 'system-overview', 'logs'],
        queryFn: () => api.logs({ page: 1, page_size: 5 }),
        staleTime: 30_000,
      },
    ],
  });

  const [healthQuery, chainQuery, jobsQuery, logsQuery] = queries;
  const isError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.error)?.error;

  const healthSummary = useMemo(() => {
    const checks = (healthQuery.data?.['checks'] as AnyRow[]) ?? [];
    let ok = 0;
    let warn = 0;
    let err = 0;
    for (const c of checks) {
      const s = String(c['status'] ?? '');
      if (s === 'ok' || s === 'healthy') ok += 1;
      else if (s === 'err' || s === 'error' || s === 'down' || s === 'fail') err += 1;
      else warn += 1;
    }
    const tone: HealthTone =
      err > 0 ? 'danger' : warn > 0 ? 'warn' : ok > 0 ? 'success' : 'default';
    return { ok, warn, err, total: checks.length, tone };
  }, [healthQuery.data]);

  const chainSummary = useMemo(() => {
    const items = (chainQuery.data?.['items'] as AnyRow[]) ?? [];
    let worst: { lag: number; row: AnyRow } | null = null;
    let ok = 0;
    let warn = 0;
    let err = 0;
    for (const row of items) {
      const lag = Math.max(
        0,
        toNumber(row['last_scanned_block']) - toNumber(row['last_confirmed_block']),
      );
      if (lag > 20) err += 1;
      else if (lag > 5) warn += 1;
      else ok += 1;
      if (!worst || lag > worst.lag) worst = { lag, row };
    }
    const tone: HealthTone =
      err > 0 ? 'danger' : warn > 0 ? 'warn' : ok > 0 ? 'success' : 'default';
    return { total: items.length, ok, warn, err, worst, tone };
  }, [chainQuery.data]);

  const jobsSummary = useMemo(() => {
    const items = (jobsQuery.data?.['items'] as AnyRow[]) ?? [];
    let ok = 0;
    let running = 0;
    let failed = 0;
    for (const r of items) {
      const s = String(r['status'] ?? '');
      if (s === 'ok' || s === 'completed' || s === 'success') ok += 1;
      else if (s === 'running' || s === 'pending') running += 1;
      else if (s === 'failed' || s === 'err' || s === 'error') failed += 1;
    }
    const tone: HealthTone = failed > 0 ? 'danger' : running > 0 ? 'warn' : 'success';
    const latest = items[0];
    return { total: items.length, ok, running, failed, tone, latest };
  }, [jobsQuery.data]);

  const logsSummary = useMemo(() => {
    const items = (logsQuery.data?.['items'] as AnyRow[]) ?? [];
    return { total: items.length, latest: items[0], items };
  }, [logsQuery.data]);

  return (
    <PageShell>
      <PageHeader
        title={t('system.overview.title', 'System overview')}
        subtitle={t(
          'system.overview.subtitle',
          'Aggregated view of health, chain sync, jobs, and audit logs',
        )}
      />

      {isError && (
        <div style={{ marginBottom: 'var(--px-space-4)' }}>
          <InlineError
            title={t('common.error')}
            description={firstError instanceof Error ? firstError.message : undefined}
            onRetry={() => queries.forEach((q) => q.refetch())}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {!isError && (
      <div
        style={{
          display: 'grid',
          gap: 'var(--px-space-4)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}
      >
        <OverviewTile
          icon={<Activity size={14} />}
          tone={healthSummary.tone as SectionTone}
          title={t('system.health.title', 'Health')}
          statusPill={
            <TonePill
              tone={healthSummary.tone}
              count={healthSummary.total}
              label={
                healthSummary.tone === 'danger'
                  ? t('system.health.label.degraded', 'Degraded')
                  : healthSummary.tone === 'warn'
                    ? t('system.health.label.watching', 'Watching')
                    : t('system.health.label.healthy', 'Healthy')
              }
            />
          }
          actionLabel={t('common.view_all', 'View all')}
          onAction={() => navigate('/system/health')}
          loading={healthQuery.isLoading}
        >
          <KpiRow
            items={[
              {
                label: t('status.ok', 'OK'),
                value: healthSummary.ok,
                tone: 'success',
                icon: <CheckCircle2 size={12} />,
              },
              {
                label: t('status.warn', 'Warn'),
                value: healthSummary.warn,
                tone: 'warn',
                icon: <Activity size={12} />,
              },
              {
                label: t('status.err', 'Err'),
                value: healthSummary.err,
                tone: 'danger',
                icon: <Activity size={12} />,
              },
            ]}
          />
        </OverviewTile>

        <OverviewTile
          icon={<GitBranch size={14} />}
          tone={chainSummary.tone as SectionTone}
          title={t('system.chain_sync.title', 'Chain sync')}
          statusPill={
            <TonePill
              tone={chainSummary.tone}
              count={chainSummary.total}
              label={
                chainSummary.tone === 'danger'
                  ? t('system.chain_sync.status.degraded', 'Degraded')
                  : chainSummary.tone === 'warn'
                    ? t('system.chain_sync.status.watching', 'Watching')
                    : t('system.chain_sync.status.healthy', 'Healthy')
              }
            />
          }
          actionLabel={t('common.view_all', 'View all')}
          onAction={() => navigate('/system/chain-sync')}
          loading={chainQuery.isLoading}
        >
          {chainSummary.worst ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--px-font-mono)',
                    color: 'var(--px-text-secondary)',
                  }}
                >
                  #{String(chainSummary.worst.row['chain_id'])} ·{' '}
                  {String(chainSummary.worst.row['sync_key'] ?? '')}
                </span>
                <ThresholdCell
                  value={chainSummary.worst.lag}
                  thresholds={[5, 20]}
                  suffix={t('system.chain_sync.blocks', 'blocks')}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--px-text-tertiary)',
                }}
              >
                <TimeCell
                  value={chainSummary.worst.row['updated_at']}
                  mode="relative"
                />
              </div>
            </div>
          ) : (
            <PlaceholderRow>
              {t('common.empty.default_title', 'No data')}
            </PlaceholderRow>
          )}
        </OverviewTile>

        <OverviewTile
          icon={<Zap size={14} />}
          tone={jobsSummary.tone as SectionTone}
          title={t('system.jobs.title', 'Jobs')}
          statusPill={
            <TonePill
              tone={jobsSummary.tone}
              count={jobsSummary.total}
              label={
                jobsSummary.failed > 0
                  ? t('system.jobs.label.failed', 'Failing')
                  : jobsSummary.running > 0
                    ? t('system.jobs.label.running', 'Running')
                    : t('system.jobs.label.healthy', 'Healthy')
              }
            />
          }
          actionLabel={t('common.view_all', 'View all')}
          onAction={() => navigate('/system/jobs')}
          loading={jobsQuery.isLoading}
        >
          {jobsSummary.latest ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  color: 'var(--px-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {String(jobsSummary.latest['job_name'] ?? 'job')}
              </span>
              <StatusBadge value={String(jobsSummary.latest['status'] ?? 'unknown')} />
            </div>
          ) : (
            <PlaceholderRow>
              {t('common.empty.default_title', 'No data')}
            </PlaceholderRow>
          )}
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--px-text-tertiary)',
              marginTop: 6,
            }}
          >
            {jobsSummary.failed > 0 && (
              <span style={{ color: 'var(--px-status-err)', marginRight: 10 }}>
                {jobsSummary.failed} {t('status.failed', 'failed')}
              </span>
            )}
            {jobsSummary.running > 0 && (
              <span style={{ color: 'var(--px-status-info)', marginRight: 10 }}>
                {jobsSummary.running} {t('status.running', 'running')}
              </span>
            )}
            {jobsSummary.ok > 0 && (
              <span style={{ color: 'var(--px-status-ok)' }}>
                {jobsSummary.ok} {t('status.ok', 'ok')}
              </span>
            )}
          </div>
        </OverviewTile>

        <OverviewTile
          icon={<ScrollText size={14} />}
          tone="default"
          title={t('logs.title', 'Audit log')}
          statusPill={
            <TonePill
              tone="default"
              count={logsSummary.total}
              label={t('logs.recent', 'Recent')}
            />
          }
          actionLabel={t('common.view_all', 'View all')}
          onAction={() => navigate('/logs')}
          loading={logsQuery.isLoading}
        >
          {logsSummary.items.length > 0 ? (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 11.5,
              }}
            >
              {logsSummary.items.slice(0, 3).map((row, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingBottom: 4,
                    borderBottom: '1px dashed var(--px-border-subtle)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--px-font-mono)',
                      color: 'var(--px-text-link)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {String(row['action'] ?? '')}
                  </span>
                  <span
                    style={{
                      color: 'var(--px-text-tertiary)',
                      flexShrink: 0,
                    }}
                  >
                    <TimeCell value={row['created_at']} mode="relative" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <PlaceholderRow>
              {t('common.empty.default_title', 'No recent logs')}
            </PlaceholderRow>
          )}
        </OverviewTile>
      </div>
      )}

      <SectionCard
        icon={<Database size={14} />}
        title={t('system.overview.shortcuts', 'Sub-page shortcuts')}
        hint={t(
          'system.overview.shortcuts_hint',
          'Jump directly into any monitoring surface',
        )}
        padded
      >
        <div
          style={{
            display: 'grid',
            gap: 'var(--px-space-3)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          <ShortcutButton
            icon={<Activity size={14} />}
            label={t('system.health.title', 'Health')}
            onClick={() => navigate('/system/health')}
          />
          <ShortcutButton
            icon={<GitBranch size={14} />}
            label={t('system.chain_sync.title', 'Chain sync')}
            onClick={() => navigate('/system/chain-sync')}
          />
          <ShortcutButton
            icon={<Zap size={14} />}
            label={t('system.jobs.title', 'Jobs')}
            onClick={() => navigate('/system/jobs')}
          />
          <ShortcutButton
            icon={<ScrollText size={14} />}
            label={t('logs.title', 'Audit log')}
            onClick={() => navigate('/logs')}
          />
        </div>
      </SectionCard>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const OverviewTile: FC<{
  icon: ReactNode;
  tone: SectionTone;
  title: ReactNode;
  statusPill: ReactNode;
  actionLabel: ReactNode;
  onAction: () => void;
  loading?: boolean;
  children?: ReactNode;
}> = ({ icon, tone, title, statusPill, actionLabel, onAction, loading, children }) => (
  <SectionCard
    icon={icon}
    tone={tone}
    title={title}
    statusPill={statusPill}
    actions={
      <button
        type="button"
        onClick={onAction}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--px-text-link)',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        {actionLabel}
        <ArrowRight size={11} />
      </button>
    }
    status={loading ? 'loading' : 'idle'}
    loadingRows={2}
    padded
  >
    {children}
  </SectionCard>
);

const TonePill: FC<{
  tone: HealthTone;
  count: number;
  label: ReactNode;
}> = ({ tone, count, label }) => {
  const color =
    tone === 'success'
      ? 'var(--px-status-ok)'
      : tone === 'warn'
        ? 'var(--px-status-warn)'
        : tone === 'danger'
          ? 'var(--px-status-err)'
          : 'var(--px-text-tertiary)';
  const bg =
    tone === 'success'
      ? 'var(--px-status-ok-soft)'
      : tone === 'warn'
        ? 'var(--px-status-warn-soft)'
        : tone === 'danger'
          ? 'var(--px-status-err-soft)'
          : 'var(--px-bg-surface-raised)';
  return (
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
      {label} · {count}
    </span>
  );
};

const KpiRow: FC<{
  items: readonly {
    label: ReactNode;
    value: number;
    tone: 'success' | 'warn' | 'danger';
    icon: ReactNode;
  }[];
}> = ({ items }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: 8,
    }}
  >
    {items.map((item) => {
      const color =
        item.tone === 'success'
          ? 'var(--px-status-ok)'
          : item.tone === 'warn'
            ? 'var(--px-status-warn)'
            : 'var(--px-status-err)';
      return (
        <div
          key={String(item.label)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '8px 10px',
            border: '1px solid var(--px-border-subtle)',
            borderRadius: 'var(--px-radius-sm)',
            background: 'var(--px-bg-surface-raised)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: 'var(--px-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ color }}>{item.icon}</span>
            {item.label}
          </span>
          <span
            className="px-tabular"
            style={{ fontSize: 18, fontWeight: 600, color }}
          >
            {item.value}
          </span>
        </div>
      );
    })}
  </div>
);

const PlaceholderRow: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11.5,
      color: 'var(--px-text-tertiary)',
      fontStyle: 'italic',
    }}
  >
    <Clock size={11} />
    {children}
  </div>
);

const ShortcutButton: FC<{
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '10px 14px',
      background: 'var(--px-bg-surface-raised)',
      border: '1px solid var(--px-border-subtle)',
      borderRadius: 'var(--px-radius-md)',
      color: 'var(--px-text-primary)',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'var(--px-transition-base)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--px-brand)';
      e.currentTarget.style.color = 'var(--px-brand)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--px-border-subtle)';
      e.currentTarget.style.color = 'var(--px-text-primary)';
    }}
  >
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {icon}
      {label}
    </span>
    <ArrowRight size={12} />
  </button>
);
