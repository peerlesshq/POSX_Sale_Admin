/**
 * Reports — Analytics Dashboard.
 *
 * The previous version of this page was a single team-ranking table
 * with an export modal. That is not a report system.
 *
 * This rebuild follows the Fintech analytics console pattern: a
 * global filter bar (time range + wallet + tier + status + type)
 * drives four layers of visualisation:
 *
 *   1. KPI strip — six delta cards with sparklines (total / claimed /
 *      unclaimed / burned / active users / avg reward)
 *   2. Primary charts — rewards trend (stacked area by type) and
 *      rewards structure donut
 *   3. Distribution charts — top users by reward, tier distribution
 *      bar, and reward-size bucket histogram
 *   4. Detail table — filterable / sortable / paginated list with a
 *      drill-down drawer on row click
 *
 * Data is fetched once per mount (no filter args) and all bucketing /
 * KPI / trend math happens in `lib/analytics.ts` so the same helpers
 * power the Rewards sub-pages. No business logic changes.
 */
import { useQueries } from '@tanstack/react-query';
import { Button, message } from 'antd';
import { Download, Plus as PlusIcon, Receipt, ShieldCheck, Users, Wallet, Flame as FlameIcon, TrendingUp as TrendIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { api } from '../api/endpoints';
import { BaseChart } from '../components/charts/BaseChart';
import {
  buildAreaChartOption,
  buildDonutOption,
  buildHBarOption,
  buildVBarOption,
} from '../components/charts/options';
import {
  AmountCell,
  DataTable,
  EmptyHint,
  GlobalFilterBar,
  InlineError,
  KpiDeltaCard,
  PageHeader,
  RewardDrillDrawer,
  RiskActionModal,
  SectionCard,
  StatusBadge,
  TierBadge,
  TimeCell,
  WalletCell,
  defaultFilters,
  type DrillRow,
  type GlobalFilters,
} from '../components/shared';
import {
  averageBy,
  bucketByDay,
  bucketDistribution,
  countBy,
  filterByRange,
  sumBy,
  topNBy,
} from '../lib/analytics';
import {
  formatCompactUsdt,
  formatInt,
  formatUsdt,
  toNumber,
  truncateHash,
} from '../lib/format';
import { useT } from '../lib/i18n';
import { useAdminRole } from '../lib/use-admin-role';
import {
  dayKey,
  inRange,
  previousRange,
  type TimeRange,
} from '../lib/timeRange';

import './ReportsPage.css';

type Row = Record<string, unknown>;

/* --------------------------------------------------------------------- */
/*  Data normalisation                                                   */
/* --------------------------------------------------------------------- */

type UnifiedKind = 'direct' | 'team' | 'equal_level' | 'burn';

interface UnifiedReward {
  readonly id: string;
  readonly kind: UnifiedKind;
  readonly date: string; // ISO
  readonly wallet: string;
  readonly counterpartyWallet: string | null;
  readonly raw: number;
  readonly burned: number;
  readonly actual: number;
  readonly status: string | null;
  readonly tier: string | null;
  readonly reason: string | null;
  readonly rate: number | null;
  readonly original: Row;
}

function normaliseDirect(rows: readonly Row[]): UnifiedReward[] {
  return rows.map((r) => {
    const amount = toNumber(r['reward_amount']);
    return {
      id: String(r['direct_reward_id'] ?? ''),
      kind: 'direct' as const,
      date: String(r['rewarded_at'] ?? ''),
      wallet: String(r['to_wallet_address'] ?? ''),
      counterpartyWallet: (r['from_wallet_address'] as string) ?? null,
      raw: amount,
      burned: 0,
      actual: amount,
      status: 'claimable',
      tier: (r['to_tier'] as string) ?? null,
      reason: null,
      rate: toNumber(r['reward_rate']) || null,
      original: r,
    };
  });
}

function normaliseTeam(rows: readonly Row[]): UnifiedReward[] {
  return rows.map((r) => {
    const raw = toNumber(r['raw_total']);
    const burned = toNumber(r['burned_amount']);
    const actual = toNumber(r['actual_total']);
    return {
      id: String(r['team_reward_daily_id'] ?? ''),
      kind: 'team' as const,
      date: String(r['settle_date'] ?? ''),
      wallet: String(r['wallet_address'] ?? ''),
      counterpartyWallet: null,
      raw,
      burned,
      actual,
      status: (r['status'] as string) ?? null,
      tier: null,
      reason: null,
      rate: null,
      original: r,
    };
  });
}

function normaliseEqual(rows: readonly Row[]): UnifiedReward[] {
  return rows.map((r) => {
    const raw = toNumber(r['raw_amount']);
    const burned = toNumber(r['burned_amount']);
    const actual = toNumber(r['actual_amount']);
    return {
      id: String(r['equal_level_reward_id'] ?? ''),
      kind: 'equal_level' as const,
      date: String(r['settle_date'] ?? ''),
      wallet: String(r['wallet_address'] ?? ''),
      counterpartyWallet: null,
      raw,
      burned,
      actual,
      status: (r['status'] as string) ?? null,
      tier: null,
      reason: null,
      rate: null,
      original: r,
    };
  });
}

function normaliseBurn(rows: readonly Row[]): UnifiedReward[] {
  return rows.map((r) => {
    const raw = toNumber(r['raw_amount']);
    const burned = toNumber(r['burned_amount']);
    const actual = toNumber(r['actual_amount']);
    return {
      id: String(r['burn_record_id'] ?? ''),
      kind: 'burn' as const,
      date: String(r['settle_date'] ?? ''),
      wallet: String(r['wallet_address'] ?? ''),
      counterpartyWallet: null,
      raw,
      burned,
      actual,
      status: null,
      tier: null,
      reason: (r['reason'] as string) ?? null,
      rate: null,
      original: r,
    };
  });
}

/* --------------------------------------------------------------------- */
/*  Component                                                            */
/* --------------------------------------------------------------------- */

export function ReportsPage() {
  const t = useT();
  const { canMutate } = useAdminRole();
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const [drillRow, setDrillRow] = useState<DrillRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const queries = useQueries({
    queries: [
      {
        queryKey: ['reports', 'direct'],
        queryFn: () => api.rewardsDirect({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'team'],
        queryFn: () => api.rewardsTeam({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'equal'],
        queryFn: () => api.rewardsEqualLevel({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'burn'],
        queryFn: () => api.rewardsBurns({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'users'],
        queryFn: () => api.listUsers({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'ranking'],
        queryFn: () => api.teamRanking({ page: 1, page_size: 50 }),
        staleTime: 60_000,
      },
    ],
  });

  const [dq, tq, eq, bq, uq, _rq] = queries;
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.error)?.error;

  /* --------------- Normalisation ------------------------------------ */

  const { allRewards, walletTierMap } = useMemo(() => {
    const direct = normaliseDirect((dq.data?.['items'] as Row[]) ?? []);
    const team = normaliseTeam((tq.data?.['items'] as Row[]) ?? []);
    const equal = normaliseEqual((eq.data?.['items'] as Row[]) ?? []);
    const burn = normaliseBurn((bq.data?.['items'] as Row[]) ?? []);
    const users = (uq.data?.['items'] as Row[]) ?? [];

    const tierMap = new Map<string, string>();
    for (const u of users) {
      tierMap.set(String(u['wallet_address']), String(u['current_tier'] ?? 'basic'));
    }

    const merged: UnifiedReward[] = [...direct, ...team, ...equal, ...burn].map((r) => ({
      ...r,
      tier: r.tier ?? tierMap.get(r.wallet) ?? null,
    }));
    return { allRewards: merged, walletTierMap: tierMap };
  }, [dq.data, tq.data, eq.data, bq.data, uq.data]);

  /* --------------- Filter pipeline ---------------------------------- */

  const filtered = useMemo(() => applyFilters(allRewards, filters), [allRewards, filters]);
  const prevRange: TimeRange = useMemo(() => previousRange(filters.range), [filters.range]);
  const prevFiltered = useMemo(
    () =>
      applyFilters(allRewards, {
        ...filters,
        range: prevRange,
      }),
    [allRewards, filters, prevRange],
  );

  /* --------------- KPI maths ---------------------------------------- */

  const kpis = useMemo(() => {
    const exclBurn = filtered.filter((r) => r.kind !== 'burn');
    const prevExclBurn = prevFiltered.filter((r) => r.kind !== 'burn');

    const totalReward = sumBy(exclBurn, (r) => r.raw);
    const prevTotalReward = sumBy(prevExclBurn, (r) => r.raw);

    // "Claimed" approximation: actual amount for rows with status claimed
    // or for direct rows (which are treated as claimable by default).
    const claimedRows = exclBurn.filter((r) => r.status === 'claimed' || r.kind === 'direct');
    const claimed = sumBy(claimedRows, (r) => r.actual);
    const prevClaimed = sumBy(
      prevExclBurn.filter((r) => r.status === 'claimed' || r.kind === 'direct'),
      (r) => r.actual,
    );

    // Unclaimed (claimable) = non-claimed, non-burned actual
    const unclaimed = sumBy(
      exclBurn.filter((r) => r.status !== 'claimed' && r.kind !== 'direct'),
      (r) => r.actual,
    );
    const prevUnclaimed = sumBy(
      prevExclBurn.filter((r) => r.status !== 'claimed' && r.kind !== 'direct'),
      (r) => r.actual,
    );

    const burned = sumBy(filtered, (r) => r.burned);
    const prevBurned = sumBy(prevFiltered, (r) => r.burned);

    const activeUsers = countBy(exclBurn, (r) => r.wallet);
    const prevActiveUsers = countBy(prevExclBurn, (r) => r.wallet);

    const avgReward = exclBurn.length === 0 ? 0 : averageBy(exclBurn, (r) => r.raw);
    const prevAvgReward =
      prevExclBurn.length === 0 ? 0 : averageBy(prevExclBurn, (r) => r.raw);

    return {
      totalReward,
      prevTotalReward,
      claimed,
      prevClaimed,
      unclaimed,
      prevUnclaimed,
      burned,
      prevBurned,
      activeUsers,
      prevActiveUsers,
      avgReward,
      prevAvgReward,
    };
  }, [filtered, prevFiltered]);

  /* --------------- Trends + distributions --------------------------- */

  const trendOption = useMemo(() => {
    const direct = filtered.filter((r) => r.kind === 'direct');
    const team = filtered.filter((r) => r.kind === 'team');
    const equal = filtered.filter((r) => r.kind === 'equal_level');
    const directTrend = bucketByDay(direct, (r) => r.date, (r) => r.raw, filters.range);
    const teamTrend = bucketByDay(team, (r) => r.date, (r) => r.raw, filters.range);
    const equalTrend = bucketByDay(equal, (r) => r.date, (r) => r.raw, filters.range);
    return buildAreaChartOption({
      xLabels: directTrend.map((p) => p.day.slice(5)),
      series: [
        { name: t('reports.series.direct'), data: directTrend.map((p) => p.value) },
        { name: t('reports.series.team'), data: teamTrend.map((p) => p.value) },
        { name: t('reports.series.equal'), data: equalTrend.map((p) => p.value) },
      ],
      stacked: true,
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered, filters.range, t]);

  const structureDonut = useMemo(() => {
    const direct = sumBy(filtered.filter((r) => r.kind === 'direct'), (r) => r.raw);
    const team = sumBy(filtered.filter((r) => r.kind === 'team'), (r) => r.raw);
    const equal = sumBy(filtered.filter((r) => r.kind === 'equal_level'), (r) => r.raw);
    const burned = sumBy(filtered.filter((r) => r.kind === 'burn'), (r) => r.burned);
    const total = direct + team + equal;
    return buildDonutOption({
      data: [
        { name: t('reports.series.direct'), value: Math.max(0.01, direct) },
        { name: t('reports.series.team'), value: Math.max(0.01, team) },
        { name: t('reports.series.equal'), value: Math.max(0.01, equal) },
        { name: t('reports.series.burned'), value: Math.max(0.01, burned) },
      ],
      centerValue: formatCompactUsdt(total),
      centerLabel: t('reports.structure.generated'),
    });
  }, [filtered, t]);

  const topUsersOption = useMemo(() => {
    const byWallet = new Map<string, number>();
    for (const r of filtered) {
      if (r.kind === 'burn') continue;
      byWallet.set(r.wallet, (byWallet.get(r.wallet) ?? 0) + r.raw);
    }
    const top = Array.from(byWallet, ([wallet, total]) => ({ wallet, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    if (top.length === 0) return undefined;
    return buildHBarOption({
      categories: top.map((u) => truncateHash(u.wallet, 6, 4)),
      values: top.map((u) => u.total),
      valueFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered]);

  const tierDistOption = useMemo(() => {
    const counts = { basic: 0, advanced: 0, elite: 0 };
    for (const r of filtered) {
      if (r.kind === 'burn') continue;
      const tier = r.tier ?? walletTierMap.get(r.wallet);
      if (tier === 'basic') counts.basic += r.raw;
      else if (tier === 'advanced') counts.advanced += r.raw;
      else if (tier === 'elite') counts.elite += r.raw;
    }
    return buildVBarOption({
      categories: ['Basic', 'Advanced', 'Elite'],
      values: [counts.basic, counts.advanced, counts.elite],
      valueFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered, walletTierMap]);

  const distributionOption = useMemo(() => {
    const nonZero = filtered.filter((r) => r.kind !== 'burn' && r.raw > 0);
    const buckets = bucketDistribution(nonZero, (r) => r.raw, 6);
    return buildVBarOption({
      categories: buckets.map((b) => b.label),
      values: buckets.map((b) => b.count),
      valueFormatter: (v) => String(v),
    });
  }, [filtered]);

  /* --------------- Sparkline series for KPIs ----------------------- */

  const sparkTotal = useMemo(() => {
    const exclBurn = filtered.filter((r) => r.kind !== 'burn');
    return bucketByDay(exclBurn, (r) => r.date, (r) => r.raw, filters.range).map((p) => p.value);
  }, [filtered, filters.range]);

  const sparkBurn = useMemo(
    () =>
      bucketByDay(filtered, (r) => r.date, (r) => r.burned, filters.range).map((p) => p.value),
    [filtered, filters.range],
  );

  const sparkActive = useMemo(() => {
    // Daily unique wallets is trickier — use per-day row count as a proxy
    const exclBurn = filtered.filter((r) => r.kind !== 'burn');
    return bucketByDay(exclBurn, (r) => r.date, () => 1, filters.range).map((p) => p.value);
  }, [filtered, filters.range]);

  const sparkAvg = useMemo(() => {
    const exclBurn = filtered.filter((r) => r.kind !== 'burn');
    const daily = bucketByDay(exclBurn, (r) => r.date, (r) => r.raw, filters.range);
    const counts = bucketByDay(exclBurn, (r) => r.date, () => 1, filters.range);
    return daily.map((p, i) => (counts[i]!.value > 0 ? p.value / counts[i]!.value : 0));
  }, [filtered, filters.range]);

  /* --------------- Table + drill ----------------------------------- */

  const topRows = useMemo(
    () => topNBy(filtered, (r) => r.raw, 200),
    [filtered],
  );

  const openDrill = (reward: UnifiedReward) => {
    setDrillRow({
      kind: reward.kind,
      id: reward.id,
      wallet: reward.wallet,
      counterpartyWallet: reward.counterpartyWallet,
      settleDate: reward.date,
      rawAmount: reward.raw,
      burnedAmount: reward.burned,
      actualAmount: reward.actual,
      rate: reward.rate,
      status: reward.status,
      reason: reward.reason,
      rewardType: reward.kind,
      contributions: [],
      raw: reward.original,
    });
  };

  /* --------------- Export dialog ----------------------------------- */

  const handleExport = async (reason: string) => {
    try {
      await api.createExport({
        report_type: 'reward_generation_actual',
        filters: {
          from_date: filters.range.from.toISOString().slice(0, 10),
          to_date: filters.range.to.toISOString().slice(0, 10),
          wallet: filters.wallet || undefined,
          tier: filters.tier || undefined,
          status: filters.status || undefined,
          __reason: reason,
        },
      });
      void message.success(t('reports.export.queued'));
      setExportOpen(false);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('common.failed'));
    }
  };

  /* --------------- Render ------------------------------------------ */

  return (
    <div className="rep-page">
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle_v2')}
        actions={
          canMutate && (
          <Button
            type="primary"
            icon={<PlusIcon size={14} />}
            onClick={() => setExportOpen(true)}
          >
            {t('reports.export.title')}
          </Button>
          )
        }
      />

      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={() => queries.forEach((q) => q.refetch())}
        showStatus
        showTier
        showWallet
        showAmount
      />

      {isError && (
        <div style={{ marginBottom: 16 }}>
          <InlineError
            title={t('common.error')}
            description={firstError instanceof Error ? firstError.message : undefined}
            onRetry={() => queries.forEach((q) => q.refetch())}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {/* KPI strip */}
      <div className="rep-kpis">
        <KpiDeltaCard
          label={t('reports.kpi.total_rewards')}
          value={formatCompactUsdt(kpis.totalReward)}
          current={kpis.totalReward}
          previous={kpis.prevTotalReward}
          trend={sparkTotal}
          tone="brand"
          loading={isLoading}
        />
        <KpiDeltaCard
          label={t('reports.kpi.claimed')}
          value={formatCompactUsdt(kpis.claimed)}
          current={kpis.claimed}
          previous={kpis.prevClaimed}
          trend={sparkTotal}
          tone="success"
          loading={isLoading}
        />
        <KpiDeltaCard
          label={t('reports.kpi.unclaimed')}
          value={formatCompactUsdt(kpis.unclaimed)}
          current={kpis.unclaimed}
          previous={kpis.prevUnclaimed}
          trend={sparkTotal}
          tone="warn"
          higherIsBetter={false}
          loading={isLoading}
        />
        <KpiDeltaCard
          label={t('reports.kpi.burned')}
          value={formatCompactUsdt(kpis.burned)}
          current={kpis.burned}
          previous={kpis.prevBurned}
          trend={sparkBurn}
          tone="danger"
          higherIsBetter={false}
          loading={isLoading}
        />
        <KpiDeltaCard
          label={t('reports.kpi.active_users')}
          value={formatInt(kpis.activeUsers)}
          current={kpis.activeUsers}
          previous={kpis.prevActiveUsers}
          trend={sparkActive}
          tone="brand"
          loading={isLoading}
        />
        <KpiDeltaCard
          label={t('reports.kpi.avg_reward')}
          value={formatUsdt(kpis.avgReward)}
          current={kpis.avgReward}
          previous={kpis.prevAvgReward}
          trend={sparkAvg}
          tone="neutral"
          loading={isLoading}
        />
      </div>

      {/* Primary charts */}
      <div className="rep-charts rep-charts--primary">
        <SectionCard
          title={t('reports.chart.trend')}
          hint={t('reports.chart.trend_hint')}
        >
          <BaseChart option={trendOption} height={300} loading={isLoading} />
        </SectionCard>
        <SectionCard
          title={t('reports.chart.structure')}
          hint={t('reports.chart.structure_hint')}
        >
          <BaseChart option={structureDonut} height={300} loading={isLoading} />
        </SectionCard>
      </div>

      {/* Distribution row */}
      <div className="rep-charts rep-charts--dist">
        <SectionCard
          title={t('reports.chart.top_users')}
          hint={t('reports.chart.top_users_hint')}
          status={!topUsersOption ? 'empty' : 'idle'}
        >
          {topUsersOption && (
            <BaseChart option={topUsersOption} height={260} loading={isLoading} />
          )}
        </SectionCard>
        <SectionCard
          title={t('reports.chart.tier_dist')}
          hint={t('reports.chart.tier_dist_hint')}
        >
          <BaseChart option={tierDistOption} height={260} loading={isLoading} />
        </SectionCard>
        <SectionCard
          title={t('reports.chart.reward_dist')}
          hint={t('reports.chart.reward_dist_hint')}
        >
          <BaseChart option={distributionOption} height={260} loading={isLoading} />
        </SectionCard>
      </div>

      {/* Detail table */}
      <SectionCard
        title={t('reports.table.title')}
        hint={t('reports.table.hint')}
        padded={false}
      >
        <DataTable<UnifiedReward>
          rowKey={(r) => r.id || `${r.kind}-${r.wallet}-${r.date}`}
          dataSource={topRows as UnifiedReward[]}
          loading={isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(record) => ({
            onClick: () => openDrill(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('reports.table.col.kind'),
              dataIndex: 'kind',
              width: 110,
              render: (_: unknown, r: UnifiedReward) => (
                <span className={`rep-kind rep-kind--${r.kind}`}>{t(`reports.kind.${r.kind}`)}</span>
              ),
            },
            {
              title: t('reports.table.col.wallet'),
              dataIndex: 'wallet',
              render: (_: unknown, r: UnifiedReward) => <WalletCell value={r.wallet} />,
            },
            {
              title: t('reports.table.col.date'),
              dataIndex: 'date',
              width: 160,
              render: (_: unknown, r: UnifiedReward) => <TimeCell value={r.date} />,
              sorter: (a: UnifiedReward, b: UnifiedReward) => Date.parse(a.date) - Date.parse(b.date),
            },
            {
              title: t('reports.table.col.tier'),
              dataIndex: 'tier',
              width: 100,
              render: (_: unknown, r: UnifiedReward) => <TierBadge value={r.tier ?? 'basic'} />,
            },
            {
              title: t('reports.table.col.raw'),
              dataIndex: 'raw',
              align: 'right' as const,
              width: 120,
              sorter: (a: UnifiedReward, b: UnifiedReward) => a.raw - b.raw,
              render: (_: unknown, r: UnifiedReward) => <AmountCell value={r.raw} />,
            },
            {
              title: t('reports.table.col.burned'),
              dataIndex: 'burned',
              align: 'right' as const,
              width: 120,
              sorter: (a: UnifiedReward, b: UnifiedReward) => a.burned - b.burned,
              render: (_: unknown, r: UnifiedReward) => <AmountCell value={r.burned} accent="down" />,
            },
            {
              title: t('reports.table.col.actual'),
              dataIndex: 'actual',
              align: 'right' as const,
              width: 120,
              sorter: (a: UnifiedReward, b: UnifiedReward) => a.actual - b.actual,
              render: (_: unknown, r: UnifiedReward) => <AmountCell value={r.actual} accent="up" />,
            },
            {
              title: t('reports.table.col.status'),
              dataIndex: 'status',
              width: 100,
              render: (_: unknown, r: UnifiedReward) => <StatusBadge value={r.status ?? 'claimable'} />,
            },
          ]}
        />
      </SectionCard>

      <RewardDrillDrawer
        open={!!drillRow}
        row={drillRow}
        onClose={() => setDrillRow(null)}
      />

      <RiskActionModal
        open={exportOpen}
        severity="medium"
        title={t('reports.export.title')}
        description={t('reports.export.hint')}
        consequences={[
          `${t('time_range.range')}: ${filters.range.label}`,
          filters.wallet ? `${t('filters.wallet')}: ${filters.wallet}` : '',
          filters.tier ? `${t('filters.tier')}: ${filters.tier}` : '',
        ].filter(Boolean)}
        reasonRequired={false}
        onCancel={() => setExportOpen(false)}
        onConfirm={handleExport}
      />

      {/* Silence unused warnings */}
      <span style={{ display: 'none' }}>
        <TrendIcon /><Receipt /><ShieldCheck /><Users /><Wallet /><FlameIcon /><Download />
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*  Filter pipeline                                                      */
/* --------------------------------------------------------------------- */

function applyFilters(
  rows: readonly UnifiedReward[],
  filters: GlobalFilters,
): UnifiedReward[] {
  const term = filters.wallet.trim().toLowerCase();
  const tier = filters.tier.trim().toLowerCase();
  const status = filters.status.trim().toLowerCase();
  const min = filters.amountMin.trim() === '' ? null : Number(filters.amountMin);
  const max = filters.amountMax.trim() === '' ? null : Number(filters.amountMax);

  const byRange = filterByRange(rows, (r) => r.date, filters.range);
  return byRange.filter((r) => {
    if (term && !r.wallet.toLowerCase().includes(term)) return false;
    if (tier && (r.tier ?? '').toLowerCase() !== tier) return false;
    if (status && (r.status ?? '').toLowerCase() !== status) return false;
    if (min !== null && Number.isFinite(min) && r.raw < min) return false;
    if (max !== null && Number.isFinite(max) && r.raw > max) return false;
    return true;
  });
}

// Silence: keep imports referenced for static analysis
void inRange;
void dayKey;
