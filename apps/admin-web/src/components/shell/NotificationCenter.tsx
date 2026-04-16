/**
 * NotificationCenter — bell icon + drawer (PRO-04 audit remediation).
 *
 * Previously the Topbar had a disabled bell icon with no behaviour.
 * This component:
 *   1. Replaces the disabled icon with an active button
 *   2. Shows an unread dot when there's anything warn/err aggregated
 *      from the 3 data sources
 *   3. Opens a right-side Drawer when clicked with 3 tabs:
 *        - Alerts     — health checks with warn/err + chain sync lag
 *        - Jobs       — recent failed or long-running jobs
 *        - Audit      — last 10 admin log rows
 *   4. Live-refreshes every 45s using existing react-query
 *
 * This component owns NO new API endpoints — it composes existing
 * queries (`api.systemHealth`, `api.chainSync`, `api.jobRuns`,
 * `api.logs`) into a single operator-facing pane.
 */
import { useQueries } from '@tanstack/react-query';
import { Drawer, Tabs } from 'antd';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  GitBranch,
  ScrollText,
  Zap,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/endpoints';
import { useT } from '../../lib/i18n';
import { toNumber } from '../../lib/format';
import { TimeCell } from '../shared';

import './NotificationCenter.css';

type Row = Record<string, unknown>;

interface AlertRow {
  readonly id: string;
  readonly tone: 'warn' | 'danger';
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly timestamp: unknown;
  readonly path: string;
}

export const NotificationCenter: FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const queries = useQueries({
    queries: [
      {
        queryKey: ['admin', 'notifications', 'health'],
        queryFn: () => api.systemHealth(),
        staleTime: 30_000,
        refetchInterval: 45_000,
      },
      {
        queryKey: ['admin', 'notifications', 'chain-sync'],
        queryFn: () => api.chainSync(),
        staleTime: 30_000,
        refetchInterval: 45_000,
      },
      {
        queryKey: ['admin', 'notifications', 'jobs'],
        queryFn: () => api.jobRuns({ page: 1, page_size: 10 }),
        staleTime: 30_000,
        refetchInterval: 45_000,
      },
      {
        queryKey: ['admin', 'notifications', 'logs'],
        queryFn: () => api.logs({ page: 1, page_size: 10 }),
        staleTime: 30_000,
        refetchInterval: 45_000,
      },
    ],
  });

  const [healthQuery, chainQuery, jobsQuery, logsQuery] = queries;

  /* ----- Alerts: aggregated from health + chain sync ----- */
  const alerts = useMemo<AlertRow[]>(() => {
    const out: AlertRow[] = [];
    const checks = (healthQuery.data?.['checks'] as Row[]) ?? [];
    for (const c of checks) {
      const status = String(c['status'] ?? '');
      if (status === 'warn' || status === 'err' || status === 'error' || status === 'down') {
        const key = String(c['health_key'] ?? 'unknown');
        out.push({
          id: `health-${key}`,
          tone: status === 'warn' ? 'warn' : 'danger',
          icon: <Activity size={14} />,
          title: `${key}`,
          description:
            status === 'warn'
              ? t('notifications.alert.health_warn', 'Health check is in warning state.')
              : t('notifications.alert.health_err', 'Health check is failing.'),
          timestamp: c['checked_at'] ?? c['updated_at'],
          path: '/system/health',
        });
      }
    }
    const chainItems = (chainQuery.data?.['items'] as Row[]) ?? [];
    for (const row of chainItems) {
      const lag = Math.max(
        0,
        toNumber(row['last_scanned_block']) - toNumber(row['last_confirmed_block']),
      );
      if (lag > 20) {
        out.push({
          id: `chain-${row['chain_id']}-${row['sync_key']}`,
          tone: 'danger',
          icon: <GitBranch size={14} />,
          title: `Chain #${row['chain_id']} · ${String(row['sync_key'] ?? '')}`,
          description: t(
            'notifications.alert.chain_degraded',
            'Chain indexer lag is above the critical threshold.',
          ),
          timestamp: row['updated_at'],
          path: '/system/chain-sync',
        });
      } else if (lag > 5) {
        out.push({
          id: `chain-${row['chain_id']}-${row['sync_key']}`,
          tone: 'warn',
          icon: <GitBranch size={14} />,
          title: `Chain #${row['chain_id']} · ${String(row['sync_key'] ?? '')}`,
          description: t(
            'notifications.alert.chain_watching',
            'Chain indexer lag is rising.',
          ),
          timestamp: row['updated_at'],
          path: '/system/chain-sync',
        });
      }
    }
    return out;
  }, [healthQuery.data, chainQuery.data, t]);

  /* ----- Jobs: failed or error rows ----- */
  const failedJobs = useMemo(() => {
    const items = (jobsQuery.data?.['items'] as Row[]) ?? [];
    return items.filter((r) => {
      const s = String(r['status']);
      return s === 'failed' || s === 'err' || s === 'error';
    });
  }, [jobsQuery.data]);

  /* ----- Audit: last 10 rows ----- */
  const auditRows = useMemo(() => {
    return (logsQuery.data?.['items'] as Row[]) ?? [];
  }, [logsQuery.data]);

  const unreadCount = alerts.length + failedJobs.length;
  const hasUnread = unreadCount > 0;

  const handleOpenPath = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleRefresh = () => {
    queries.forEach((q) => void q.refetch());
  };

  return (
    <>
      <button
        className="px-topbar__icon-btn px-notif-btn"
        aria-label={t('notifications.open', 'Open notification center')}
        title={t('notifications.open', 'Open notification center')}
        onClick={() => setOpen(true)}
      >
        <Bell size={16} />
        {hasUnread && (
          <span className="px-notif-btn__dot" aria-hidden>
            <span className="px-notif-btn__dot-inner" />
          </span>
        )}
      </button>

      <Drawer
        title={
          <span className="px-notif-drawer__title">
            <Bell size={14} />
            {t('notifications.title', 'Notifications')}
            {hasUnread && (
              <span className="px-notif-drawer__count">{unreadCount}</span>
            )}
          </span>
        }
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={440}
        styles={{ body: { padding: '12px 16px 24px' } }}
        extra={
          <button
            type="button"
            className="px-notif-drawer__refresh"
            onClick={handleRefresh}
            title={t('common.refresh', 'Refresh')}
          >
            {t('common.refresh', 'Refresh')}
          </button>
        }
      >
        <Tabs
          defaultActiveKey="alerts"
          items={[
            {
              key: 'alerts',
              label: (
                <span className="px-notif-tab-label">
                  <AlertCircle size={12} />
                  {t('notifications.tab.alerts', 'Alerts')}
                  {alerts.length > 0 && (
                    <span className="px-notif-tab-badge">{alerts.length}</span>
                  )}
                </span>
              ),
              children: (
                <AlertsPanel
                  alerts={alerts}
                  loading={healthQuery.isLoading || chainQuery.isLoading}
                  onNavigate={handleOpenPath}
                  locale={t}
                />
              ),
            },
            {
              key: 'jobs',
              label: (
                <span className="px-notif-tab-label">
                  <Zap size={12} />
                  {t('notifications.tab.jobs', 'Jobs')}
                  {failedJobs.length > 0 && (
                    <span className="px-notif-tab-badge">{failedJobs.length}</span>
                  )}
                </span>
              ),
              children: (
                <JobsPanel
                  rows={failedJobs}
                  loading={jobsQuery.isLoading}
                  onNavigate={handleOpenPath}
                  locale={t}
                />
              ),
            },
            {
              key: 'audit',
              label: (
                <span className="px-notif-tab-label">
                  <ScrollText size={12} />
                  {t('notifications.tab.audit', 'Audit')}
                </span>
              ),
              children: (
                <AuditPanel
                  rows={auditRows}
                  loading={logsQuery.isLoading}
                  onNavigate={handleOpenPath}
                  locale={t}
                />
              ),
            },
          ]}
        />
      </Drawer>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Panels                                                              */
/* ------------------------------------------------------------------ */

const AlertsPanel: FC<{
  alerts: readonly AlertRow[];
  loading: boolean;
  onNavigate: (path: string) => void;
  locale: ReturnType<typeof useT>;
}> = ({ alerts, loading, onNavigate, locale: tFn }) => {
  if (loading && alerts.length === 0) return <PanelLoading />;
  if (alerts.length === 0) {
    return (
      <PanelEmpty
        icon={<CheckCircle2 size={18} />}
        title={tFn('notifications.empty.alerts_title', 'All clear')}
        description={tFn(
          'notifications.empty.alerts_body',
          'No active health or chain sync alerts.',
        )}
      />
    );
  }
  return (
    <ul className="px-notif-list">
      {alerts.map((a) => (
        <li key={a.id} className={`px-notif-row px-notif-row--${a.tone}`}>
          <button
            type="button"
            className="px-notif-row__btn"
            onClick={() => onNavigate(a.path)}
          >
            <span className="px-notif-row__icon">{a.icon}</span>
            <span className="px-notif-row__body">
              <span className="px-notif-row__title">{a.title}</span>
              <span className="px-notif-row__desc">{a.description}</span>
              <span className="px-notif-row__time">
                <TimeCell value={a.timestamp} mode="relative" />
              </span>
            </span>
            <span className="px-notif-row__arrow" aria-hidden>
              →
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

const JobsPanel: FC<{
  rows: readonly Row[];
  loading: boolean;
  onNavigate: (path: string) => void;
  locale: ReturnType<typeof useT>;
}> = ({ rows, loading, onNavigate, locale: tFn }) => {
  if (loading && rows.length === 0) return <PanelLoading />;
  if (rows.length === 0) {
    return (
      <PanelEmpty
        icon={<CheckCircle2 size={18} />}
        title={tFn('notifications.empty.jobs_title', 'No failing jobs')}
        description={tFn(
          'notifications.empty.jobs_body',
          'Everything in the job queue is running or completed successfully.',
        )}
      />
    );
  }
  return (
    <ul className="px-notif-list">
      {rows.map((r, idx) => (
        <li key={String(r['job_run_id'] ?? idx)} className="px-notif-row px-notif-row--danger">
          <button
            type="button"
            className="px-notif-row__btn"
            onClick={() => onNavigate('/system/jobs')}
          >
            <span className="px-notif-row__icon">
              <Zap size={14} />
            </span>
            <span className="px-notif-row__body">
              <span className="px-notif-row__title">{String(r['job_name'] ?? 'job')}</span>
              <span className="px-notif-row__desc">
                {String(r['error_message'] ?? tFn('notifications.jobs.failed', 'Job failed'))}
              </span>
              <span className="px-notif-row__time">
                <TimeCell value={r['started_at']} mode="relative" />
              </span>
            </span>
            <span className="px-notif-row__arrow" aria-hidden>
              →
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

const AuditPanel: FC<{
  rows: readonly Row[];
  loading: boolean;
  onNavigate: (path: string) => void;
  locale: ReturnType<typeof useT>;
}> = ({ rows, loading, onNavigate, locale: tFn }) => {
  if (loading && rows.length === 0) return <PanelLoading />;
  if (rows.length === 0) {
    return (
      <PanelEmpty
        icon={<ScrollText size={18} />}
        title={tFn('notifications.empty.audit_title', 'No recent activity')}
      />
    );
  }
  return (
    <ul className="px-notif-list">
      {rows.map((r, idx) => (
        <li key={String(r['admin_log_id'] ?? idx)} className="px-notif-row px-notif-row--info">
          <button
            type="button"
            className="px-notif-row__btn"
            onClick={() => onNavigate('/logs')}
          >
            <span className="px-notif-row__icon">
              <ScrollText size={14} />
            </span>
            <span className="px-notif-row__body">
              <span className="px-notif-row__title">
                {String(r['action'] ?? 'unknown')}
              </span>
              <span className="px-notif-row__desc">
                {String(r['target_type'] ?? '')} · {String(r['target_id'] ?? '').slice(0, 14)}
              </span>
              <span className="px-notif-row__time">
                <TimeCell value={r['created_at']} mode="relative" />
              </span>
            </span>
            <span className="px-notif-row__arrow" aria-hidden>
              →
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

const PanelLoading: FC = () => (
  <div className="px-notif-panel-loading">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="px-notif-panel-loading__row" />
    ))}
  </div>
);

const PanelEmpty: FC<{
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}> = ({ icon, title, description }) => (
  <div className="px-notif-panel-empty">
    <span className="px-notif-panel-empty__icon">{icon}</span>
    <div className="px-notif-panel-empty__title">{title}</div>
    {description && (
      <div className="px-notif-panel-empty__desc">{description}</div>
    )}
  </div>
);

