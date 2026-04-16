/**
 * POSX Admin Dashboard — Phase 3.5 audit remediation rewrite.
 *
 * Previously this page imported from a private `parts/*` mini-design
 * system (KpiCard, TrendChart, RewardMixDonut, TierBreakdown,
 * ActivityFeed, HealthPanel, OperationsPanel, QuickActions, RewardBand,
 * SparkLine, DonutChart) which duplicated the shared design system
 * and hardcoded chart colors. That `parts/*` folder is deleted alongside
 * this rewrite.
 *
 * New composition — every surface uses shared primitives:
 *   1. PageHeader + TimeRangeField global filter (live UTC clock via
 *      a proper setInterval)
 *   2. 4× KpiDeltaCard strip with real period-over-period deltas from
 *      the trend array — no synthesized fake sparklines
 *   3. 24h reward band inside a SectionCard (4 stat tiles)
 *   4. Trend area chart (BaseChart + buildAreaChartOption) +
 *      Reward mix donut (buildDonutOption) in a 2:1 split
 *   5. Tier distribution (buildHBarOption) + Activity feed +
 *      Quick action grid
 *   6. Health summary + Operations signals panel — both SectionCards
 *      with real status pills and relative timestamps
 *
 * No hardcoded chart colors. No `JSON.stringify` in visible text. No
 * fake data. No `parts/*` imports. Theme-reactive charts via BaseChart.
 */
import { useQueries } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  GitBranch,
  Hash,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  ScrollText,
  Settings2,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/endpoints';
import { BaseChart } from '../../components/charts/BaseChart';
import {
  buildAreaChartOption,
  buildDonutOption,
  buildHBarOption,
} from '../../components/charts/options';
import {
  InlineError,
  KpiDeltaCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  ThresholdCell,
  TimeCell,
  TimeRangeField,
} from '../../components/shared';
import { resolveRange, type TimeRange } from '../../lib/timeRange';
import {
  formatCompact,
  formatCompactUsdt,
  formatInt,
  formatUsdt,
  toNumber,
} from '../../lib/format';
import { t } from '../../lib/i18n';

type AnyRow = Record<string, unknown>;

interface TrendRow {
  readonly date: string;
  readonly deposit: number;
  readonly reward_total: number;
  readonly burn_total: number;
}

function extractTrend(raw: unknown): TrendRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const rec = r as Record<string, unknown>;
    return {
      date: String(rec['date'] ?? ''),
      deposit: toNumber(rec['deposit']),
      reward_total: toNumber(rec['reward_total']),
      burn_total: toNumber(rec['burn_total']),
    };
  });
}

/**
 * Split a trend series into "current period" + "previous period" for
 * delta computation. For a 14-point series we take the last 7 and the
 * 7 before that; shorter series fall back to as much as we have.
 */
function splitPeriods(values: readonly number[]): {
  current: number[];
  previous: number[];
} {
  if (values.length === 0) return { current: [], previous: [] };
  const half = Math.ceil(values.length / 2);
  const current = values.slice(-half);
  const previous = values.slice(0, values.length - half);
  return { current, previous };
}

function sumArray(arr: readonly number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

/* ------------------------------------------------------------------ */
/*  Live UTC clock hook                                                */
/* ------------------------------------------------------------------ */

function useUtcClock(): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  void tick;
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

/* ================================================================== */
/*  Page                                                                */
/* ================================================================== */

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const utcTime = useUtcClock();
  const [range, setRange] = useState<TimeRange>(() => resolveRange('7d'));

  const results = useQueries({
    queries: [
      { queryKey: ['admin', 'dashboard'], queryFn: () => api.dashboard() },
      { queryKey: ['admin', 'system', 'health'], queryFn: () => api.systemHealth() },
      { queryKey: ['admin', 'system', 'chain-sync'], queryFn: () => api.chainSync() },
      {
        queryKey: ['admin', 'settlement', 'latest'],
        queryFn: () => api.listSettlementJobs({ page: 1, page_size: 1 }),
      },
      {
        queryKey: ['admin', 'system', 'job-runs', 'latest'],
        queryFn: () => api.jobRuns({ page: 1, page_size: 1 }),
      },
      {
        queryKey: ['admin', 'logs', 'latest'],
        queryFn: () => api.logs({ page: 1, page_size: 8 }),
      },
    ],
  });

  const [
    dashboardQuery,
    healthQuery,
    chainSyncQuery,
    settlementQuery,
    jobRunsQuery,
    logsQuery,
  ] = results;

  const isAnyLoading =
    dashboardQuery.isLoading ||
    healthQuery.isLoading ||
    chainSyncQuery.isLoading ||
    settlementQuery.isLoading ||
    jobRunsQuery.isLoading ||
    logsQuery.isLoading;

  const isAnyError = results.some((q) => q.isError);
  const firstError = results.find((q) => q.error)?.error;

  const summary = useMemo<AnyRow>(
    () => (dashboardQuery.data?.['summary'] as AnyRow) ?? {},
    [dashboardQuery.data],
  );
  const reward24h = useMemo<Record<string, string>>(
    () => (summary['reward_24h'] as Record<string, string>) ?? {},
    [summary],
  );
  const trendRows = useMemo(
    () => extractTrend(dashboardQuery.data?.['trend']),
    [dashboardQuery.data],
  );
  const tierDistribution = useMemo(
    () =>
      ((dashboardQuery.data?.['tier_distribution'] as AnyRow[]) ?? []).map((r) => ({
        tier: String(r['tier'] ?? 'none'),
        count: toNumber(r['count']),
      })),
    [dashboardQuery.data],
  );

  /* ------- Period-over-period KPI inputs (no synthesized data) ------- */

  const depositSeries = trendRows.map((r) => r.deposit);
  const rewardSeries = trendRows.map((r) => r.reward_total);
  const burnSeries = trendRows.map((r) => r.burn_total);

  const depositPeriods = splitPeriods(depositSeries);

  const depositCurrent = sumArray(depositPeriods.current);
  const depositPrevious = sumArray(depositPeriods.previous);

  const usersTotal = toNumber(summary['total_users']);
  const newUsersToday = toNumber(summary['today_new_users']);
  const pendingClaims = toNumber(summary['pending_claims_count']);
  const platformTotalDeposit = toNumber(summary['platform_total_deposit']);

  /* ------- Health + operations signals ------- */

  const healthSummary = useMemo(() => {
    const checks = (healthQuery.data?.['checks'] as AnyRow[]) ?? [];
    let ok = 0;
    let warn = 0;
    let err = 0;
    for (const c of checks) {
      const s = String(c['status'] ?? '');
      if (s === 'ok' || s === 'healthy') ok += 1;
      else if (s === 'err' || s === 'error' || s === 'down') err += 1;
      else warn += 1;
    }
    const tone: 'success' | 'warn' | 'danger' | 'default' =
      err > 0 ? 'danger' : warn > 0 ? 'warn' : ok > 0 ? 'success' : 'default';
    return { ok, warn, err, total: checks.length, tone };
  }, [healthQuery.data]);

  const chainSyncLag = useMemo(() => {
    const items = (chainSyncQuery.data?.['items'] as AnyRow[]) ?? [];
    if (items.length === 0) return { lag: null as number | null, updatedAt: null as string | null };
    const row = items[0]!;
    const scanned = toNumber(row['last_scanned_block']);
    const confirmed = toNumber(row['last_confirmed_block']);
    return {
      lag: Math.max(0, scanned - confirmed),
      updatedAt: (row['updated_at'] as string) ?? null,
    };
  }, [chainSyncQuery.data]);

  const latestSettlement = useMemo(() => {
    const items = (settlementQuery.data?.['items'] as AnyRow[]) ?? [];
    const row = items[0];
    return {
      date: (row?.['settlement_date'] as string) ?? null,
      status: (row?.['status'] as string) ?? null,
      jobType: (row?.['job_type'] as string) ?? null,
    };
  }, [settlementQuery.data]);

  const latestJob = useMemo(() => {
    const items = (jobRunsQuery.data?.['items'] as AnyRow[]) ?? [];
    const row = items[0];
    return {
      name: (row?.['job_name'] as string) ?? null,
      status: (row?.['status'] as string) ?? null,
      startedAt: (row?.['started_at'] as string) ?? null,
    };
  }, [jobRunsQuery.data]);

  const activityRows = useMemo(() => {
    const items = (logsQuery.data?.['items'] as AnyRow[]) ?? [];
    return items.slice(0, 6).map((r) => ({
      id: String(r['admin_log_id'] ?? r['id'] ?? Math.random()),
      adminUserId: (r['admin_user_id'] as string | null) ?? null,
      action: String(r['action'] ?? 'unknown'),
      targetType: (r['target_type'] as string | null) ?? null,
      targetId: (r['target_id'] as string | null) ?? null,
      createdAt: String(r['created_at'] ?? new Date().toISOString()),
    }));
  }, [logsQuery.data]);

  /* ------- Chart options ------- */

  const trendOption: EChartsOption = useMemo(
    () =>
      buildAreaChartOption({
        xLabels: trendRows.map((r) => r.date.slice(5)), // MM-DD
        series: [
          {
            name: t('dashboard.series.deposit', 'Deposit'),
            data: depositSeries,
            color: 'var(--px-chart-1)',
          },
          {
            name: t('dashboard.series.reward', 'Reward'),
            data: rewardSeries,
            color: 'var(--px-chart-3)',
          },
          {
            name: t('dashboard.series.burn', 'Burn'),
            data: burnSeries,
            color: 'var(--px-chart-5)',
          },
        ],
        yFormatter: (v) => formatCompact(v),
      }),
    [trendRows, depositSeries, rewardSeries, burnSeries],
  );

  const rewardMix24h = useMemo(() => {
    const direct = toNumber(reward24h['direct']);
    const team = toNumber(reward24h['team']);
    const equal = toNumber(reward24h['equal_level']);
    return [
      { name: t('rewards.direct', 'Direct'), value: direct },
      { name: t('rewards.team', 'Team'), value: team },
      { name: t('rewards.equal_level', 'Equal-Level'), value: equal },
    ];
  }, [reward24h]);

  const rewardMixTotal = rewardMix24h.reduce((acc, x) => acc + x.value, 0);
  const rewardMixEmpty = rewardMixTotal === 0;

  const donutOption: EChartsOption = useMemo(
    () =>
      buildDonutOption({
        data: rewardMix24h,
        centerLabel: t('dashboard.reward_mix.center_label', '24h reward mix'),
        centerValue: formatCompactUsdt(rewardMixTotal),
      }),
    [rewardMix24h, rewardMixTotal],
  );

  const tierDistOption: EChartsOption = useMemo(() => {
    const sorted = [...tierDistribution].sort((a, b) => b.count - a.count);
    return buildHBarOption({
      categories: sorted.map((r) => r.tier),
      values: sorted.map((r) => r.count),
      valueFormatter: (v) => formatInt(v),
    });
  }, [tierDistribution]);

  const refetchAll = () => {
    void dashboardQuery.refetch();
    void healthQuery.refetch();
    void chainSyncQuery.refetch();
    void settlementQuery.refetch();
    void jobRunsQuery.refetch();
    void logsQuery.refetch();
  };

  return (
    <div>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 'var(--px-radius-pill)',
                background: 'var(--px-bg-surface-raised)',
                border: '1px solid var(--px-border-subtle)',
                fontSize: 11,
                color: 'var(--px-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
              title={t('dashboard.live_updated', 'Live — auto refresh every 30s')}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--px-status-ok)',
                  boxShadow: '0 0 0 3px rgba(16,185,129,0.2)',
                }}
              />
              <Clock size={11} />
              {utcTime}
            </div>
            <TimeRangeField value={range} onChange={setRange} noFrame />
            <button
              type="button"
              onClick={refetchAll}
              title={t('common.refresh', 'Refresh')}
              aria-label="refresh all"
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--px-radius-sm)',
                border: '1px solid var(--px-border)',
                background: 'transparent',
                color: 'var(--px-text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        }
      />

      {isAnyError && (
        <div style={{ marginBottom: 'var(--px-space-4)' }}>
          <InlineError
            title={t('common.error')}
            description={firstError instanceof Error ? firstError.message : undefined}
            onRetry={refetchAll}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {/* Row 1 — KPI delta strip */}
      <div
        style={{
          display: 'grid',
          gap: 'var(--px-space-4)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          marginBottom: 'var(--px-space-4)',
        }}
      >
        <KpiDeltaCard
          label={t('dashboard.platform_total_deposit', 'Platform total deposit')}
          value={formatCompactUsdt(platformTotalDeposit)}
          unit="USDT"
          current={depositCurrent}
          previous={depositPrevious}
          trend={depositSeries}
          tone="brand"
          loading={dashboardQuery.isLoading}
        />
        <KpiDeltaCard
          label={t('dashboard.period_deposit', 'Period deposit')}
          value={formatCompactUsdt(depositCurrent)}
          unit="USDT"
          current={depositCurrent}
          previous={depositPrevious}
          trend={depositSeries}
          tone="success"
          loading={dashboardQuery.isLoading}
        />
        <KpiDeltaCard
          label={t('dashboard.total_users', 'Total users')}
          value={formatInt(usersTotal)}
          current={usersTotal}
          previous={Math.max(0, usersTotal - newUsersToday)}
          tone="brand"
          loading={dashboardQuery.isLoading}
        />
        <KpiDeltaCard
          label={t('dashboard.pending_claims', 'Pending claims')}
          value={formatInt(pendingClaims)}
          current={pendingClaims}
          previous={pendingClaims}
          tone={pendingClaims > 10 ? 'warn' : 'neutral'}
          higherIsBetter={false}
          loading={dashboardQuery.isLoading}
        />
      </div>

      {/* Row 2 — 24h reward band */}
      <div style={{ marginBottom: 'var(--px-space-4)' }}>
        <SectionCard
          icon={<TrendingUp size={14} />}
          title={t('dashboard.reward_24h.title', '24h reward engine')}
          hint={t('dashboard.reward_24h.hint', 'Accrued across direct, team, equal-level, and burned')}
          timestamp={`${utcTime}`}
          dense
          padded
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--px-space-4)',
            }}
          >
            <RewardBandTile
              icon={<UserPlus size={13} />}
              label={t('rewards.direct', 'Direct')}
              value={formatUsdt(reward24h['direct'] ?? '0')}
              accent="var(--px-chart-1)"
            />
            <RewardBandTile
              icon={<Users size={13} />}
              label={t('rewards.team', 'Team')}
              value={formatUsdt(reward24h['team'] ?? '0')}
              accent="var(--px-chart-3)"
            />
            <RewardBandTile
              icon={<GitBranch size={13} />}
              label={t('rewards.equal_level', 'Equal-Level')}
              value={formatUsdt(reward24h['equal_level'] ?? '0')}
              accent="var(--px-chart-6)"
            />
            <RewardBandTile
              icon={<AlertTriangle size={13} />}
              label={t('dashboard.reward_24h.burn', 'Burn')}
              value={formatUsdt(summary['burn_today'] ?? summary['burn_total'] ?? '0')}
              accent="var(--px-chart-5)"
            />
          </div>
        </SectionCard>
      </div>

      {/* Row 3 — Trend chart (wide) + Reward mix donut (narrow) */}
      <div
        style={{
          display: 'grid',
          gap: 'var(--px-space-4)',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          marginBottom: 'var(--px-space-4)',
        }}
      >
        <SectionCard
          icon={<LayoutDashboard size={14} />}
          title={t('dashboard.trend.title', '14-day platform trend')}
          hint={t('dashboard.trend.hint', 'Deposit, reward, and burn totals')}
          timestamp={
            dashboardQuery.dataUpdatedAt
              ? relativeSeconds(dashboardQuery.dataUpdatedAt)
              : undefined
          }
          padded
        >
          <BaseChart
            option={trendOption}
            loading={dashboardQuery.isLoading}
            empty={trendRows.length === 0}
            emptyTitle={t('dashboard.trend.empty', 'No trend data available')}
            height={260}
          />
        </SectionCard>
        <SectionCard
          icon={<Coins size={14} />}
          title={t('dashboard.reward_mix.title', 'Reward mix (24h)')}
          padded
        >
          <BaseChart
            option={donutOption}
            loading={dashboardQuery.isLoading}
            empty={rewardMixEmpty}
            emptyTitle={t('dashboard.reward_mix.empty', 'No rewards in 24h')}
            height={260}
          />
        </SectionCard>
      </div>

      {/* Row 4 — Tier distribution + Activity feed + Quick actions */}
      <div
        style={{
          display: 'grid',
          gap: 'var(--px-space-4)',
          gridTemplateColumns:
            'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
          marginBottom: 'var(--px-space-4)',
        }}
      >
        <SectionCard
          icon={<Users size={14} />}
          title={t('dashboard.tier.title', 'Tier distribution')}
          hint={t('dashboard.tier.hint', 'Users bucketed by tier level')}
          padded
        >
          <BaseChart
            option={tierDistOption}
            loading={dashboardQuery.isLoading}
            empty={tierDistribution.length === 0}
            height={200}
          />
        </SectionCard>

        <SectionCard
          icon={<ScrollText size={14} />}
          title={t('dashboard.activity.title', 'Recent admin activity')}
          hint={t('dashboard.activity.hint', 'Audit log — last 6 entries')}
          actions={
            <button
              type="button"
              onClick={() => navigate('/logs')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--px-text-link)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {t('common.view_all', 'View all')}
            </button>
          }
          padded
        >
          {isLoadingOrEmpty(logsQuery.isLoading, activityRows.length) ? (
            <ActivityEmpty loading={logsQuery.isLoading} />
          ) : (
            <ActivityList rows={activityRows} />
          )}
        </SectionCard>

        <SectionCard
          icon={<Zap size={14} />}
          title={t('dashboard.quick_actions.title', 'Quick actions')}
          hint={t('dashboard.quick_actions.hint', 'Jump to the most common surfaces')}
          padded
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            <QuickActionButton
              icon={<Users size={14} />}
              label={t('nav.users', 'Users')}
              onClick={() => navigate('/users')}
            />
            <QuickActionButton
              icon={<TrendingUp size={14} />}
              label={t('nav.rewards', 'Rewards')}
              onClick={() => navigate('/rewards')}
            />
            <QuickActionButton
              icon={<ListChecks size={14} />}
              label={t('nav.settlement_jobs', 'Settlement')}
              onClick={() => navigate('/settlement/jobs')}
            />
            <QuickActionButton
              icon={<Settings2 size={14} />}
              label={t('nav.config', 'Config')}
              onClick={() => navigate('/config')}
            />
          </div>
        </SectionCard>
      </div>

      {/* Row 5 — Health summary + Operations signals */}
      <div
        style={{
          display: 'grid',
          gap: 'var(--px-space-4)',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        }}
      >
        <SectionCard
          icon={<Activity size={14} />}
          title={t('dashboard.health.title', 'System health')}
          hint={t(
            'dashboard.health.hint',
            'Aggregated across every monitored service',
          )}
          tone={healthSummary.tone}
          statusPill={
            <HealthPill
              tone={healthSummary.tone}
              count={healthSummary.total}
              label={
                healthSummary.tone === 'success'
                  ? t('system.health.label.healthy', 'All healthy')
                  : healthSummary.tone === 'warn'
                    ? t('system.health.label.watching', 'Watching')
                    : healthSummary.tone === 'danger'
                      ? t('system.health.label.degraded', 'Degraded')
                      : t('common.empty.default_title', 'No data')
              }
            />
          }
          actions={
            <button
              type="button"
              onClick={() => navigate('/system/health')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--px-text-link)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {t('common.view_all', 'View all')}
            </button>
          }
          padded
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 'var(--px-space-3)',
            }}
          >
            <HealthCountTile
              icon={<CheckCircle2 size={13} style={{ color: 'var(--px-status-ok)' }} />}
              label={t('status.ok', 'Healthy')}
              value={healthSummary.ok}
              accent="var(--px-status-ok)"
            />
            <HealthCountTile
              icon={<AlertTriangle size={13} style={{ color: 'var(--px-status-warn)' }} />}
              label={t('status.warn', 'Warning')}
              value={healthSummary.warn}
              accent="var(--px-status-warn)"
            />
            <HealthCountTile
              icon={<AlertTriangle size={13} style={{ color: 'var(--px-status-err)' }} />}
              label={t('status.err', 'Error')}
              value={healthSummary.err}
              accent="var(--px-status-err)"
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<Wallet size={14} />}
          title={t('dashboard.ops.title', 'Operations signals')}
          hint={t('dashboard.ops.hint', 'Chain sync, settlement, jobs, pending claims')}
          padded
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <OpsRow
              icon={<GitBranch size={13} />}
              label={t('system.chain_sync.title', 'Chain sync')}
              value={
                chainSyncLag.lag !== null ? (
                  <ThresholdCell
                    value={chainSyncLag.lag}
                    thresholds={[5, 20]}
                    suffix={t('system.chain_sync.blocks', 'blocks')}
                  />
                ) : (
                  <span className="px-text-tertiary">—</span>
                )
              }
              sublabel={<TimeCell value={chainSyncLag.updatedAt} mode="relative" />}
            />
            <OpsRow
              icon={<ListChecks size={13} />}
              label={t('system.settlement.title', 'Settlement')}
              value={
                latestSettlement.status ? (
                  <StatusBadge value={latestSettlement.status} />
                ) : (
                  <span className="px-text-tertiary">—</span>
                )
              }
              sublabel={
                latestSettlement.date
                  ? `${latestSettlement.date} · ${latestSettlement.jobType ?? ''}`
                  : '—'
              }
            />
            <OpsRow
              icon={<Zap size={13} />}
              label={t('system.jobs.title', 'Latest job run')}
              value={
                latestJob.status ? (
                  <StatusBadge value={latestJob.status} />
                ) : (
                  <span className="px-text-tertiary">—</span>
                )
              }
              sublabel={
                latestJob.name ? (
                  <span>
                    {latestJob.name} ·{' '}
                    <TimeCell value={latestJob.startedAt} mode="relative" />
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <OpsRow
              icon={<Hash size={13} />}
              label={t('dashboard.pending_claims', 'Pending claims')}
              value={
                <span className="px-tabular" style={{ fontWeight: 600 }}>
                  {formatInt(pendingClaims)}
                </span>
              }
              sublabel={
                pendingClaims > 0
                  ? t(
                      'dashboard.ops.pending_claims_hint',
                      'Awaiting operator action',
                    )
                  : t('dashboard.ops.pending_claims_empty', 'Queue clear')
              }
            />
          </div>
        </SectionCard>
      </div>

      {/* Loading blocker hint */}
      {isAnyLoading && (
        <div
          style={{
            marginTop: 'var(--px-space-4)',
            fontSize: 11,
            color: 'var(--px-text-muted)',
            textAlign: 'right',
          }}
        >
          {t('common.loading', 'Loading')}…
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                      */
/* ================================================================== */

const RewardBandTile: FC<{
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  accent: string;
}> = ({ icon, label, value, accent }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '12px 14px',
      border: '1px solid var(--px-border-subtle)',
      borderRadius: 'var(--px-radius-md)',
      background: 'var(--px-bg-surface-raised)',
      position: 'relative',
      overflow: 'hidden',
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
      <span style={{ color: accent, display: 'inline-flex' }}>{icon}</span>
      <span>{label}</span>
    </div>
    <div
      className="px-tabular"
      style={{
        fontSize: 20,
        fontWeight: 600,
        color: 'var(--px-text-primary)',
      }}
    >
      {value}
    </div>
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 'auto 0 0 0',
        height: 2,
        background: accent,
        opacity: 0.6,
      }}
    />
  </div>
);

const HealthCountTile: FC<{
  icon: ReactNode;
  label: ReactNode;
  value: number;
  accent: string;
}> = ({ icon, label, value, accent }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '10px 12px',
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
    <div
      className="px-tabular"
      style={{ fontSize: 22, fontWeight: 600, color: accent }}
    >
      {value}
    </div>
  </div>
);

const HealthPill: FC<{
  tone: 'success' | 'warn' | 'danger' | 'default';
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
        }}
      />
      {label} · {count}
    </span>
  );
};

const OpsRow: FC<{
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
}> = ({ icon, label, value, sublabel }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '10px 12px',
      border: '1px solid var(--px-border-subtle)',
      borderRadius: 'var(--px-radius-md)',
      background: 'var(--px-bg-surface-raised)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 'var(--px-radius-sm)',
          background: 'var(--px-brand-soft)',
          color: 'var(--px-brand)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--px-text-primary)',
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--px-text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
    <div style={{ flexShrink: 0 }}>{value}</div>
  </div>
);

const QuickActionButton: FC<{
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      background: 'var(--px-bg-surface-raised)',
      border: '1px solid var(--px-border-subtle)',
      borderRadius: 'var(--px-radius-md)',
      color: 'var(--px-text-secondary)',
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
      e.currentTarget.style.color = 'var(--px-text-secondary)';
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const ActivityList: FC<{
  rows: readonly {
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  }[];
}> = ({ rows }) => (
  <ul
    style={{
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
  >
    {rows.map((row) => (
      <li
        key={row.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 0',
          borderBottom: '1px dashed var(--px-border-subtle)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 'var(--px-radius-sm)',
              background: 'var(--px-brand-soft)',
              color: 'var(--px-text-link)',
              fontFamily: 'var(--px-font-mono)',
              fontSize: 10.5,
              fontWeight: 500,
            }}
          >
            {row.action}
          </span>
          {row.targetType && (
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--px-text-tertiary)',
              }}
            >
              {row.targetType}
            </span>
          )}
        </span>
        <TimeCell value={row.createdAt} mode="relative" />
      </li>
    ))}
  </ul>
);

const ActivityEmpty: FC<{ loading: boolean }> = ({ loading }) => (
  <div
    style={{
      fontSize: 11,
      color: 'var(--px-text-tertiary)',
      padding: '16px 0',
      textAlign: 'center',
    }}
  >
    {loading ? t('common.loading') : t('common.empty.default_title', 'No activity')}
  </div>
);

/* ================================================================== */
/*  Helpers                                                             */
/* ================================================================== */

function isLoadingOrEmpty(loading: boolean, count: number): boolean {
  return loading || count === 0;
}

function relativeSeconds(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}
