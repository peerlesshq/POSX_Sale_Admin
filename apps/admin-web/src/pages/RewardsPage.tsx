/**
 * Rewards module — Phase 8 analytics enhancement.
 *
 * Exports:
 *   - RewardsOverviewPage — unchanged from Phase 7 (explicitly kept
 *     per the user's instruction). Cross-cutting global view.
 *   - RewardsDirectPage / TeamPage / EqualLevelPage / BurnsPage —
 *     previously flat list views; now upgraded to mini analytics
 *     pages with:
 *         GlobalFilterBar  (time range + wallet + tier + status)
 *         KPI strip        (3-4 delta KPI cards with sparklines)
 *         Trend chart      (area chart per day)
 *         Distribution     (per-tier, per-size, or top-N bar)
 *         Table + drill    (row click opens RewardDrillDrawer)
 *
 * Overview is left intact on purpose; all new code lives in the four
 * sub-page components below. No business logic changes, no API
 * contract changes.
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/endpoints';
import { BaseChart } from '../components/charts/BaseChart';
import {
  buildAreaChartOption,
  buildDonutOption,
  buildHBarOption,
  buildSankeyOption,
  buildVBarOption,
} from '../components/charts/options';
import {
  AmountCell,
  DataTable,
  EmptyHint,
  GlobalFilterBar,
  InlineError,
  KpiDeltaCard,
  KpiStatCard,
  PageHeader,
  RewardDrillDrawer,
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
  formatPercent,
  formatUsdt,
  toNumber,
  truncateHash,
} from '../lib/format';
import { t, useT } from '../lib/i18n';
import { previousRange } from '../lib/timeRange';

import './RewardsSubPages.css';

type Row = Record<string, unknown>;

/* ------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------ */

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function useRewardsListData(
  endpoint: (query: Record<string, string | number | undefined>) => Promise<Row>,
  page: number,
  pageSize: number,
  extra: Record<string, string | number | undefined>,
) {
  return useQuery({
    queryKey: ['admin', 'rewards', endpoint.name, page, pageSize, JSON.stringify(extra)],
    queryFn: () => endpoint({ page, page_size: pageSize, ...extra }),
    staleTime: 20_000,
  });
}

/* ==================================================================
 * OVERVIEW (Phase 7 — unchanged)
 * ================================================================== */

export function RewardsOverviewPage() {
  const t = useT();

  const queries = useQueries({
    queries: [
      { queryKey: ['admin', 'dashboard'], queryFn: () => api.dashboard(), staleTime: 60_000 },
      {
        queryKey: ['admin', 'rewards-overview', 'team-ranking'],
        queryFn: () => api.teamRanking({ page: 1, page_size: 10 }),
        staleTime: 60_000,
      },
    ],
  });

  const [dashQuery, rankingQuery] = queries;
  const isError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.error)?.error;
  const summary = (dashQuery.data?.['summary'] as Row) ?? {};
  const reward24h = (summary['reward_24h'] as Record<string, string>) ?? {};
  const trendRows = (dashQuery.data?.['trend'] as Row[]) ?? [];

  const directTotal = toNumber(reward24h['direct']);
  const teamTotal = toNumber(reward24h['team']);
  const equalTotal = toNumber(reward24h['equal_level']);
  const burnTotal = toNumber(summary['burn_today'] ?? summary['burn_total']);

  const totalGenerated = directTotal + teamTotal + equalTotal;

  const sankeyOption = useMemo(() => {
    const directClaim = directTotal * 0.82;
    const directBurn = directTotal * 0.18;
    const teamClaim = teamTotal * 0.78;
    const teamBurn = teamTotal * 0.22;
    const equalClaim = equalTotal * 0.8;
    const equalBurn = equalTotal * 0.2;

    return buildSankeyOption({
      nodes: [
        { name: t('dashboard.today_deposit') },
        { name: t('nav.rewards.direct') },
        { name: t('nav.rewards.team') },
        { name: t('nav.rewards.equal_level') },
        { name: t('rewards.overview.kpi.claimed') },
        { name: t('nav.rewards.burns') },
      ],
      links: [
        { source: t('dashboard.today_deposit'), target: t('nav.rewards.direct'), value: Math.max(1, directTotal) },
        { source: t('dashboard.today_deposit'), target: t('nav.rewards.team'), value: Math.max(1, teamTotal) },
        { source: t('dashboard.today_deposit'), target: t('nav.rewards.equal_level'), value: Math.max(1, equalTotal) },
        { source: t('nav.rewards.direct'), target: t('rewards.overview.kpi.claimed'), value: Math.max(1, directClaim) },
        { source: t('nav.rewards.direct'), target: t('nav.rewards.burns'), value: Math.max(1, directBurn) },
        { source: t('nav.rewards.team'), target: t('rewards.overview.kpi.claimed'), value: Math.max(1, teamClaim) },
        { source: t('nav.rewards.team'), target: t('nav.rewards.burns'), value: Math.max(1, teamBurn) },
        { source: t('nav.rewards.equal_level'), target: t('rewards.overview.kpi.claimed'), value: Math.max(1, equalClaim) },
        { source: t('nav.rewards.equal_level'), target: t('nav.rewards.burns'), value: Math.max(1, equalBurn) },
      ],
    });
  }, [directTotal, teamTotal, equalTotal, t]);

  const trendOption = useMemo(() => {
    const labels = trendRows.map((r) => asString(r['date']).slice(5));
    const deposit = trendRows.map((r) => toNumber(r['deposit']));
    const reward = trendRows.map((r) => toNumber(r['reward_total']));
    const burn = trendRows.map((r) => toNumber(r['burn_total']));
    return buildAreaChartOption({
      xLabels: labels,
      series: [
        { name: t('dashboard.today_deposit'), data: deposit },
        { name: t('nav.rewards'), data: reward },
        { name: t('nav.rewards.burns'), data: burn },
      ],
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [trendRows, t]);

  const donutOption = useMemo(
    () =>
      buildDonutOption({
        data: [
          { name: t('nav.rewards.direct'), value: Math.max(0.01, directTotal) },
          { name: t('nav.rewards.team'), value: Math.max(0.01, teamTotal) },
          { name: t('nav.rewards.equal_level'), value: Math.max(0.01, equalTotal) },
        ],
        centerValue: formatCompactUsdt(totalGenerated),
        centerLabel: t('rewards.overview.kpi.generated'),
      }),
    [directTotal, teamTotal, equalTotal, totalGenerated, t],
  );

  const leaders = ((rankingQuery.data?.['items'] as Row[]) ?? []).slice(0, 10);

  const leaderOption = useMemo(() => {
    if (leaders.length === 0) return undefined;
    return buildHBarOption({
      categories: leaders.map((r) => asString(r['wallet_address']).slice(0, 10)),
      values: leaders.map((r) => toNumber(r['team_total_performance'])),
      valueFormatter: (v) => formatCompactUsdt(v),
    });
  }, [leaders]);

  return (
    <div>
      <PageHeader
        title={t('rewards.overview.title')}
        subtitle={t('rewards.overview.subtitle')}
      />

      {isError ? (
        <InlineError
          title={t('common.error')}
          description={firstError instanceof Error ? firstError.message : undefined}
          onRetry={() => queries.forEach((q) => q.refetch())}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiStatCard
          label={t('rewards.overview.kpi.direct_total')}
          value={formatCompactUsdt(directTotal)}
          sub={t('dashboard.live_updated')}
          accent="var(--px-chart-1)"
          loading={dashQuery.isLoading}
        />
        <KpiStatCard
          label={t('rewards.overview.kpi.team_total')}
          value={formatCompactUsdt(teamTotal)}
          sub={t('dashboard.live_updated')}
          accent="var(--px-chart-2)"
          loading={dashQuery.isLoading}
        />
        <KpiStatCard
          label={t('rewards.overview.kpi.equal_total')}
          value={formatCompactUsdt(equalTotal)}
          sub={t('dashboard.live_updated')}
          accent="var(--px-chart-3)"
          loading={dashQuery.isLoading}
        />
        <KpiStatCard
          label={t('rewards.overview.kpi.burn_total')}
          value={formatCompactUsdt(burnTotal)}
          sub={t('dashboard.burn_total')}
          accent="var(--px-chart-5)"
          loading={dashQuery.isLoading}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <SectionCard
          title={t('rewards.overview.sankey.title')}
          hint={t('rewards.overview.sankey.hint')}
          padded
        >
          <BaseChart option={sankeyOption} height={320} loading={dashQuery.isLoading} />
        </SectionCard>
        <SectionCard title={t('dashboard.reward_mix')} padded>
          <BaseChart option={donutOption} height={320} loading={dashQuery.isLoading} />
        </SectionCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16,
        }}
      >
        <SectionCard
          title={t('rewards.overview.trend.title')}
          hint={t('rewards.overview.trend.hint')}
          padded
        >
          <BaseChart
            option={trendOption}
            height={280}
            loading={dashQuery.isLoading}
            empty={trendRows.length === 0}
          />
        </SectionCard>
        <SectionCard
          title={t('rewards.overview.top_receivers')}
          hint={t('rewards.overview.top_receivers_hint')}
          padded
          status={rankingQuery.isLoading ? 'loading' : leaders.length === 0 ? 'empty' : 'idle'}
        >
          {leaderOption && <BaseChart option={leaderOption} height={280} />}
        </SectionCard>
      </div>
      </>)}
    </div>
  );
}

/* ==================================================================
 * DIRECT REWARDS — analytics sub-page
 * ================================================================== */

interface DirectRow {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly rate: number;
  readonly date: string;
  readonly raw: Row;
}

export function RewardsDirectPage() {
  const t = useT();
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const [drill, setDrill] = useState<DrillRow | null>(null);

  const query = useRewardsListData(api.rewardsDirect, 1, 500, {});
  const items = (query.data?.['items'] as Row[]) ?? [];

  const rows: DirectRow[] = useMemo(
    () =>
      items.map((r) => ({
        id: String(r['direct_reward_id'] ?? ''),
        from: String(r['from_wallet_address'] ?? ''),
        to: String(r['to_wallet_address'] ?? ''),
        amount: toNumber(r['reward_amount']),
        rate: toNumber(r['reward_rate']),
        date: String(r['rewarded_at'] ?? ''),
        raw: r,
      })),
    [items],
  );

  const filtered = useMemo(
    () => filterDirectRows(rows, filters),
    [rows, filters],
  );
  const prevFiltered = useMemo(
    () =>
      filterDirectRows(rows, {
        ...filters,
        range: previousRange(filters.range),
      }),
    [rows, filters],
  );

  /* KPIs */
  const totalAmount = sumBy(filtered, (r) => r.amount);
  const prevTotalAmount = sumBy(prevFiltered, (r) => r.amount);
  const activeReferrers = countBy(filtered, (r) => r.from);
  const prevActiveReferrers = countBy(prevFiltered, (r) => r.from);
  const avgReward = averageBy(filtered, (r) => r.amount);
  const prevAvgReward = averageBy(prevFiltered, (r) => r.amount);

  const sparkTotal = useMemo(
    () => bucketByDay(filtered, (r) => r.date, (r) => r.amount, filters.range).map((p) => p.value),
    [filtered, filters.range],
  );

  /* Trend */
  const trendOption = useMemo(() => {
    const trend = bucketByDay(filtered, (r) => r.date, (r) => r.amount, filters.range);
    return buildAreaChartOption({
      xLabels: trend.map((p) => p.day.slice(5)),
      series: [{ name: t('rewards.direct.series'), data: trend.map((p) => p.value) }],
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered, filters.range, t]);

  /* Top referrers */
  const topReferrersOption = useMemo(() => {
    const byReferrer = new Map<string, number>();
    for (const r of filtered) {
      byReferrer.set(r.from, (byReferrer.get(r.from) ?? 0) + r.amount);
    }
    const top = Array.from(byReferrer, ([wallet, total]) => ({ wallet, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    if (top.length === 0) return undefined;
    return buildHBarOption({
      categories: top.map((u) => truncateHash(u.wallet, 6, 4)),
      values: top.map((u) => u.total),
      valueFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered]);

  const openDrill = (r: DirectRow) =>
    setDrill({
      kind: 'direct',
      id: r.id,
      wallet: r.to,
      counterpartyWallet: r.from,
      settleDate: r.date,
      rawAmount: r.amount,
      burnedAmount: 0,
      actualAmount: r.amount,
      rate: r.rate,
      status: 'claimable',
      reason: null,
      rewardType: 'direct',
      contributions: [
        { wallet: r.from, amount: r.amount, depth: 0 },
      ],
      raw: r.raw,
    });

  return (
    <div className="rw-page">
      <PageHeader title={t('rewards.direct.title')} subtitle={t('rewards.direct.subtitle')} />
      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={() => query.refetch()}
        showAmount
      />

      {query.isError ? (
        <InlineError
          title={t('common.error')}
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div className="rw-kpis">
        <KpiDeltaCard
          label={t('rewards.direct.kpi.total')}
          value={formatCompactUsdt(totalAmount)}
          current={totalAmount}
          previous={prevTotalAmount}
          trend={sparkTotal}
          tone="brand"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.direct.kpi.active_referrers')}
          value={formatInt(activeReferrers)}
          current={activeReferrers}
          previous={prevActiveReferrers}
          tone="success"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.direct.kpi.avg_reward')}
          value={formatUsdt(avgReward)}
          current={avgReward}
          previous={prevAvgReward}
          tone="neutral"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.direct.kpi.txn_count')}
          value={formatInt(filtered.length)}
          current={filtered.length}
          previous={prevFiltered.length}
          tone="brand"
          loading={query.isLoading}
        />
      </div>

      <div className="rw-charts">
        <SectionCard title={t('rewards.direct.chart.trend')} hint={t('rewards.direct.chart.trend_hint')}>
          <BaseChart option={trendOption} height={260} loading={query.isLoading} />
        </SectionCard>
        <SectionCard
          title={t('rewards.direct.chart.top_referrers')}
          hint={t('rewards.direct.chart.top_referrers_hint')}
          status={topReferrersOption ? 'idle' : 'empty'}
        >
          {topReferrersOption && <BaseChart option={topReferrersOption} height={260} loading={query.isLoading} />}
        </SectionCard>
      </div>

      <SectionCard
        title={t('rewards.direct.table.title')}
        hint={t('rewards.direct.table.hint')}
        padded={false}
      >
        <DataTable<DirectRow>
          rowKey={(r) => r.id}
          dataSource={filtered as DirectRow[]}
          loading={query.isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(record) => ({
            onClick: () => openDrill(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('rewards.col.from_wallet'),
              dataIndex: 'from',
              render: (_: unknown, r: DirectRow) => <WalletCell value={r.from} />,
            },
            {
              title: t('rewards.col.to_wallet'),
              dataIndex: 'to',
              render: (_: unknown, r: DirectRow) => <WalletCell value={r.to} />,
            },
            {
              title: t('rewards.col.amount'),
              dataIndex: 'amount',
              align: 'right' as const,
              sorter: (a: DirectRow, b: DirectRow) => a.amount - b.amount,
              render: (_: unknown, r: DirectRow) => <AmountCell value={r.amount} />,
            },
            {
              title: t('rewards.col.rate'),
              dataIndex: 'rate',
              align: 'right' as const,
              width: 100,
              render: (_: unknown, r: DirectRow) => (
                <span className="px-tabular">{formatPercent(r.rate, 2)}</span>
              ),
            },
            {
              title: t('rewards.col.date'),
              dataIndex: 'date',
              width: 160,
              sorter: (a: DirectRow, b: DirectRow) => Date.parse(a.date) - Date.parse(b.date),
              render: (_: unknown, r: DirectRow) => <TimeCell value={r.date} />,
            },
          ]}
        />
      </SectionCard>
      </>)}

      <RewardDrillDrawer open={!!drill} row={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function filterDirectRows(rows: readonly DirectRow[], filters: GlobalFilters): DirectRow[] {
  const byRange = filterByRange(rows, (r) => r.date, filters.range);
  const term = filters.wallet.trim().toLowerCase();
  const min = filters.amountMin.trim() === '' ? null : Number(filters.amountMin);
  const max = filters.amountMax.trim() === '' ? null : Number(filters.amountMax);
  return byRange.filter((r) => {
    if (term && !(r.from.toLowerCase().includes(term) || r.to.toLowerCase().includes(term)))
      return false;
    if (min !== null && Number.isFinite(min) && r.amount < min) return false;
    if (max !== null && Number.isFinite(max) && r.amount > max) return false;
    return true;
  });
}

/* ==================================================================
 * TEAM REWARDS — analytics sub-page
 * ================================================================== */

interface TeamRow {
  readonly id: string;
  readonly wallet: string;
  readonly date: string;
  readonly raw: number;
  readonly burned: number;
  readonly actual: number;
  readonly status: string;
  readonly original: Row;
}

export function RewardsTeamPage() {
  const t = useT();
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const [drill, setDrill] = useState<DrillRow | null>(null);

  const query = useRewardsListData(api.rewardsTeam, 1, 500, {});
  const items = (query.data?.['items'] as Row[]) ?? [];

  const rows: TeamRow[] = useMemo(
    () =>
      items.map((r) => ({
        id: String(r['team_reward_daily_id'] ?? ''),
        wallet: String(r['wallet_address'] ?? ''),
        date: String(r['settle_date'] ?? ''),
        raw: toNumber(r['raw_total']),
        burned: toNumber(r['burned_amount']),
        actual: toNumber(r['actual_total']),
        status: String(r['status'] ?? 'pending'),
        original: r,
      })),
    [items],
  );

  const filtered = useMemo(() => filterTeamRows(rows, filters), [rows, filters]);
  const prevFiltered = useMemo(
    () =>
      filterTeamRows(rows, {
        ...filters,
        range: previousRange(filters.range),
      }),
    [rows, filters],
  );

  const rawTotal = sumBy(filtered, (r) => r.raw);
  const prevRawTotal = sumBy(prevFiltered, (r) => r.raw);
  const actualTotal = sumBy(filtered, (r) => r.actual);
  const prevActualTotal = sumBy(prevFiltered, (r) => r.actual);
  const burnedTotal = sumBy(filtered, (r) => r.burned);
  const prevBurnedTotal = sumBy(prevFiltered, (r) => r.burned);
  const uniqueLeaders = countBy(filtered, (r) => r.wallet);
  const prevUniqueLeaders = countBy(prevFiltered, (r) => r.wallet);

  const sparkActual = useMemo(
    () => bucketByDay(filtered, (r) => r.date, (r) => r.actual, filters.range).map((p) => p.value),
    [filtered, filters.range],
  );

  const trendOption = useMemo(() => {
    const rawTrend = bucketByDay(filtered, (r) => r.date, (r) => r.raw, filters.range);
    const actualTrend = bucketByDay(filtered, (r) => r.date, (r) => r.actual, filters.range);
    const burnTrend = bucketByDay(filtered, (r) => r.date, (r) => r.burned, filters.range);
    return buildAreaChartOption({
      xLabels: rawTrend.map((p) => p.day.slice(5)),
      series: [
        { name: t('rewards.team.series.raw'), data: rawTrend.map((p) => p.value) },
        { name: t('rewards.team.series.actual'), data: actualTrend.map((p) => p.value) },
        { name: t('rewards.team.series.burned'), data: burnTrend.map((p) => p.value) },
      ],
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered, filters.range, t]);

  const topLeadersOption = useMemo(() => {
    const byWallet = new Map<string, number>();
    for (const r of filtered) {
      byWallet.set(r.wallet, (byWallet.get(r.wallet) ?? 0) + r.actual);
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

  const burnRatioOption = useMemo(() => {
    const buckets = bucketDistribution(
      filtered.filter((r) => r.raw > 0),
      (r) => (r.raw === 0 ? 0 : (r.burned / r.raw) * 100),
      6,
    );
    return buildVBarOption({
      categories: buckets.map((b) => `${b.label}%`),
      values: buckets.map((b) => b.count),
      valueFormatter: (v) => String(v),
    });
  }, [filtered]);

  const openDrill = (r: TeamRow) =>
    setDrill({
      kind: 'team',
      id: r.id,
      wallet: r.wallet,
      counterpartyWallet: null,
      settleDate: r.date,
      rawAmount: r.raw,
      burnedAmount: r.burned,
      actualAmount: r.actual,
      rate: null,
      status: r.status,
      reason: null,
      rewardType: 'team',
      contributions: [],
      raw: r.original,
    });

  return (
    <div className="rw-page">
      <PageHeader title={t('rewards.team.title')} subtitle={t('rewards.team.subtitle')} />
      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={() => query.refetch()}
        showAmount
      />

      {query.isError ? (
        <InlineError
          title={t('common.error')}
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div className="rw-kpis">
        <KpiDeltaCard
          label={t('rewards.team.kpi.raw_total')}
          value={formatCompactUsdt(rawTotal)}
          current={rawTotal}
          previous={prevRawTotal}
          tone="brand"
          trend={sparkActual}
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.team.kpi.actual_total')}
          value={formatCompactUsdt(actualTotal)}
          current={actualTotal}
          previous={prevActualTotal}
          tone="success"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.team.kpi.burned_total')}
          value={formatCompactUsdt(burnedTotal)}
          current={burnedTotal}
          previous={prevBurnedTotal}
          tone="danger"
          higherIsBetter={false}
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.team.kpi.leader_count')}
          value={formatInt(uniqueLeaders)}
          current={uniqueLeaders}
          previous={prevUniqueLeaders}
          tone="brand"
          loading={query.isLoading}
        />
      </div>

      <div className="rw-charts">
        <SectionCard title={t('rewards.team.chart.trend')} hint={t('rewards.team.chart.trend_hint')}>
          <BaseChart option={trendOption} height={260} loading={query.isLoading} />
        </SectionCard>
        <SectionCard
          title={t('rewards.team.chart.top_leaders')}
          hint={t('rewards.team.chart.top_leaders_hint')}
          status={topLeadersOption ? 'idle' : 'empty'}
        >
          {topLeadersOption && <BaseChart option={topLeadersOption} height={260} loading={query.isLoading} />}
        </SectionCard>
      </div>

      <div className="rw-charts rw-charts--single">
        <SectionCard
          title={t('rewards.team.chart.burn_ratio')}
          hint={t('rewards.team.chart.burn_ratio_hint')}
        >
          <BaseChart option={burnRatioOption} height={220} loading={query.isLoading} />
        </SectionCard>
      </div>

      <SectionCard
        title={t('rewards.team.table.title')}
        hint={t('rewards.team.table.hint')}
        padded={false}
      >
        <DataTable<TeamRow>
          rowKey={(r) => r.id}
          dataSource={filtered as TeamRow[]}
          loading={query.isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(record) => ({
            onClick: () => openDrill(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('rewards.col.wallet'),
              dataIndex: 'wallet',
              render: (_: unknown, r: TeamRow) => <WalletCell value={r.wallet} />,
            },
            { title: t('rewards.col.date'), dataIndex: 'date', width: 130, render: (v: unknown) => <TimeCell value={v} /> },
            {
              title: t('rewards.col.raw_total'),
              dataIndex: 'raw',
              align: 'right' as const,
              sorter: (a: TeamRow, b: TeamRow) => a.raw - b.raw,
              render: (_: unknown, r: TeamRow) => <AmountCell value={r.raw} />,
            },
            {
              title: t('rewards.col.burned'),
              dataIndex: 'burned',
              align: 'right' as const,
              sorter: (a: TeamRow, b: TeamRow) => a.burned - b.burned,
              render: (_: unknown, r: TeamRow) => <AmountCell value={r.burned} accent="down" />,
            },
            {
              title: t('rewards.col.actual'),
              dataIndex: 'actual',
              align: 'right' as const,
              sorter: (a: TeamRow, b: TeamRow) => a.actual - b.actual,
              render: (_: unknown, r: TeamRow) => <AmountCell value={r.actual} accent="up" />,
            },
            {
              title: t('common.status'),
              dataIndex: 'status',
              width: 110,
              render: (_: unknown, r: TeamRow) => <StatusBadge value={r.status} />,
            },
            {
              title: t('common.actions'),
              width: 80,
              render: (_: unknown, row: TeamRow) => (
                <Link to={`/rewards/team/${row.id}`} onClick={(e) => e.stopPropagation()}>
                  {t('common.view')}
                </Link>
              ),
            },
          ]}
        />
      </SectionCard>
      </>)}

      <RewardDrillDrawer open={!!drill} row={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function filterTeamRows(rows: readonly TeamRow[], filters: GlobalFilters): TeamRow[] {
  const byRange = filterByRange(rows, (r) => r.date, filters.range);
  const term = filters.wallet.trim().toLowerCase();
  const status = filters.status.trim().toLowerCase();
  const min = filters.amountMin.trim() === '' ? null : Number(filters.amountMin);
  const max = filters.amountMax.trim() === '' ? null : Number(filters.amountMax);
  return byRange.filter((r) => {
    if (term && !r.wallet.toLowerCase().includes(term)) return false;
    if (status && r.status.toLowerCase() !== status) return false;
    if (min !== null && Number.isFinite(min) && r.actual < min) return false;
    if (max !== null && Number.isFinite(max) && r.actual > max) return false;
    return true;
  });
}

/* ==================================================================
 * EQUAL-LEVEL — analytics sub-page
 * ================================================================== */

interface EqualRow {
  readonly id: string;
  readonly wallet: string;
  readonly date: string;
  readonly raw: number;
  readonly burned: number;
  readonly actual: number;
  readonly status: string;
  readonly original: Row;
}

export function RewardsEqualLevelPage() {
  const t = useT();
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const [drill, setDrill] = useState<DrillRow | null>(null);

  const query = useRewardsListData(api.rewardsEqualLevel, 1, 500, {});
  const items = (query.data?.['items'] as Row[]) ?? [];

  const rows: EqualRow[] = useMemo(
    () =>
      items.map((r) => ({
        id: String(r['equal_level_reward_id'] ?? ''),
        wallet: String(r['wallet_address'] ?? ''),
        date: String(r['settle_date'] ?? ''),
        raw: toNumber(r['raw_amount']),
        burned: toNumber(r['burned_amount']),
        actual: toNumber(r['actual_amount']),
        status: String(r['status'] ?? 'claimable'),
        original: r,
      })),
    [items],
  );

  const filtered = useMemo(
    () => filterEqualRows(rows, filters),
    [rows, filters],
  );
  const prevFiltered = useMemo(
    () =>
      filterEqualRows(rows, {
        ...filters,
        range: previousRange(filters.range),
      }),
    [rows, filters],
  );

  const triggerCount = filtered.length;
  const prevTriggerCount = prevFiltered.length;
  const actualTotal = sumBy(filtered, (r) => r.actual);
  const prevActualTotal = sumBy(prevFiltered, (r) => r.actual);
  const uniqueWallets = countBy(filtered, (r) => r.wallet);
  const prevUniqueWallets = countBy(prevFiltered, (r) => r.wallet);

  const sparkTriggers = useMemo(
    () => bucketByDay(filtered, (r) => r.date, () => 1, filters.range).map((p) => p.value),
    [filtered, filters.range],
  );

  const trendOption = useMemo(() => {
    const actualTrend = bucketByDay(filtered, (r) => r.date, (r) => r.actual, filters.range);
    const countTrend = bucketByDay(filtered, (r) => r.date, () => 1, filters.range);
    return buildAreaChartOption({
      xLabels: actualTrend.map((p) => p.day.slice(5)),
      series: [
        { name: t('rewards.equal.series.actual'), data: actualTrend.map((p) => p.value) },
        { name: t('rewards.equal.series.triggers'), data: countTrend.map((p) => p.value) },
      ],
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered, filters.range, t]);

  const topTriggeredOption = useMemo(() => {
    const byWallet = new Map<string, number>();
    for (const r of filtered) {
      byWallet.set(r.wallet, (byWallet.get(r.wallet) ?? 0) + 1);
    }
    const top = Array.from(byWallet, ([wallet, count]) => ({ wallet, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    if (top.length === 0) return undefined;
    return buildHBarOption({
      categories: top.map((u) => truncateHash(u.wallet, 6, 4)),
      values: top.map((u) => u.count),
      valueFormatter: (v) => String(v),
    });
  }, [filtered]);

  const openDrill = (r: EqualRow) =>
    setDrill({
      kind: 'equal_level',
      id: r.id,
      wallet: r.wallet,
      counterpartyWallet: null,
      settleDate: r.date,
      rawAmount: r.raw,
      burnedAmount: r.burned,
      actualAmount: r.actual,
      rate: null,
      status: r.status,
      reason: null,
      rewardType: 'equal_level',
      contributions: [],
      raw: r.original,
    });

  return (
    <div className="rw-page">
      <PageHeader
        title={t('rewards.equal_level.title')}
        subtitle={t('rewards.equal_level.subtitle')}
      />
      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={() => query.refetch()}
        showAmount
      />

      {query.isError ? (
        <InlineError
          title={t('common.error')}
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div className="rw-kpis">
        <KpiDeltaCard
          label={t('rewards.equal_level.kpi.triggers')}
          value={formatInt(triggerCount)}
          current={triggerCount}
          previous={prevTriggerCount}
          trend={sparkTriggers}
          tone="warn"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.equal_level.kpi.actual_total')}
          value={formatCompactUsdt(actualTotal)}
          current={actualTotal}
          previous={prevActualTotal}
          tone="success"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.equal_level.kpi.unique_wallets')}
          value={formatInt(uniqueWallets)}
          current={uniqueWallets}
          previous={prevUniqueWallets}
          tone="brand"
          loading={query.isLoading}
        />
      </div>

      <div className="rw-charts">
        <SectionCard title={t('rewards.equal_level.chart.trend')} hint={t('rewards.equal_level.chart.trend_hint')}>
          <BaseChart option={trendOption} height={260} loading={query.isLoading} />
        </SectionCard>
        <SectionCard
          title={t('rewards.equal_level.chart.top_triggered')}
          hint={t('rewards.equal_level.chart.top_triggered_hint')}
          status={topTriggeredOption ? 'idle' : 'empty'}
        >
          {topTriggeredOption && <BaseChart option={topTriggeredOption} height={260} loading={query.isLoading} />}
        </SectionCard>
      </div>

      <SectionCard
        title={t('rewards.equal_level.table.title')}
        hint={t('rewards.equal_level.table.hint')}
        padded={false}
      >
        <DataTable<EqualRow>
          rowKey={(r) => r.id}
          dataSource={filtered as EqualRow[]}
          loading={query.isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(record) => ({
            onClick: () => openDrill(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('rewards.col.wallet'),
              dataIndex: 'wallet',
              render: (_: unknown, r: EqualRow) => <WalletCell value={r.wallet} />,
            },
            { title: t('rewards.col.date'), dataIndex: 'date', width: 130, render: (v: unknown) => <TimeCell value={v} /> },
            {
              title: t('rewards.col.raw_total'),
              dataIndex: 'raw',
              align: 'right' as const,
              render: (_: unknown, r: EqualRow) => <AmountCell value={r.raw} />,
            },
            {
              title: t('rewards.col.burned'),
              dataIndex: 'burned',
              align: 'right' as const,
              render: (_: unknown, r: EqualRow) => <AmountCell value={r.burned} accent="down" />,
            },
            {
              title: t('rewards.col.actual'),
              dataIndex: 'actual',
              align: 'right' as const,
              sorter: (a: EqualRow, b: EqualRow) => a.actual - b.actual,
              render: (_: unknown, r: EqualRow) => <AmountCell value={r.actual} accent="up" />,
            },
          ]}
        />
      </SectionCard>
      </>)}

      <RewardDrillDrawer open={!!drill} row={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function filterEqualRows(rows: readonly EqualRow[], filters: GlobalFilters): EqualRow[] {
  const byRange = filterByRange(rows, (r) => r.date, filters.range);
  const term = filters.wallet.trim().toLowerCase();
  const min = filters.amountMin.trim() === '' ? null : Number(filters.amountMin);
  const max = filters.amountMax.trim() === '' ? null : Number(filters.amountMax);
  return byRange.filter((r) => {
    if (term && !r.wallet.toLowerCase().includes(term)) return false;
    if (min !== null && Number.isFinite(min) && r.actual < min) return false;
    if (max !== null && Number.isFinite(max) && r.actual > max) return false;
    return true;
  });
}

/* ==================================================================
 * BURNS — analytics sub-page
 * ================================================================== */

interface BurnRow {
  readonly id: string;
  readonly wallet: string;
  readonly date: string;
  readonly raw: number;
  readonly burned: number;
  readonly rewardType: string;
  readonly reason: string;
  readonly original: Row;
}

export function RewardsBurnsPage() {
  const t = useT();
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const [drill, setDrill] = useState<DrillRow | null>(null);

  const query = useRewardsListData(api.rewardsBurns, 1, 500, {});
  const items = (query.data?.['items'] as Row[]) ?? [];

  const rows: BurnRow[] = useMemo(
    () =>
      items.map((r) => ({
        id: String(r['burn_record_id'] ?? ''),
        wallet: String(r['wallet_address'] ?? ''),
        date: String(r['settle_date'] ?? ''),
        raw: toNumber(r['raw_amount']),
        burned: toNumber(r['burned_amount']),
        rewardType: String(r['reward_type'] ?? ''),
        reason: String(r['reason'] ?? ''),
        original: r,
      })),
    [items],
  );

  const filtered = useMemo(() => filterBurnRows(rows, filters), [rows, filters]);
  const prevFiltered = useMemo(
    () =>
      filterBurnRows(rows, {
        ...filters,
        range: previousRange(filters.range),
      }),
    [rows, filters],
  );

  const burnTotal = sumBy(filtered, (r) => r.burned);
  const prevBurnTotal = sumBy(prevFiltered, (r) => r.burned);
  const rawTotal = sumBy(filtered, (r) => r.raw);
  const prevRawTotal = sumBy(prevFiltered, (r) => r.raw);
  const burnRatio = rawTotal === 0 ? 0 : (burnTotal / rawTotal) * 100;
  const prevBurnRatio = prevRawTotal === 0 ? 0 : (prevBurnTotal / prevRawTotal) * 100;
  const affectedWallets = countBy(filtered, (r) => r.wallet);
  const prevAffectedWallets = countBy(prevFiltered, (r) => r.wallet);

  const sparkBurn = useMemo(
    () => bucketByDay(filtered, (r) => r.date, (r) => r.burned, filters.range).map((p) => p.value),
    [filtered, filters.range],
  );

  const trendOption = useMemo(() => {
    const burnTrend = bucketByDay(filtered, (r) => r.date, (r) => r.burned, filters.range);
    return buildAreaChartOption({
      xLabels: burnTrend.map((p) => p.day.slice(5)),
      series: [{ name: t('rewards.burns.series.burned'), data: burnTrend.map((p) => p.value) }],
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered, filters.range, t]);

  const reasonDonut = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.reason || 'unknown', (map.get(r.reason || 'unknown') ?? 0) + r.burned);
    }
    return buildDonutOption({
      data: Array.from(map, ([name, value]) => ({ name, value: Math.max(0.01, value) })),
      centerValue: formatCompactUsdt(burnTotal),
      centerLabel: t('rewards.burns.chart.total'),
    });
  }, [filtered, burnTotal, t]);

  const topBurnedOption = useMemo(() => {
    const byWallet = new Map<string, number>();
    for (const r of filtered) {
      byWallet.set(r.wallet, (byWallet.get(r.wallet) ?? 0) + r.burned);
    }
    const top = topNBy(
      Array.from(byWallet, ([wallet, total]) => ({ wallet, total })),
      (u) => u.total,
      10,
    );
    if (top.length === 0) return undefined;
    return buildHBarOption({
      categories: top.map((u) => truncateHash(u.wallet, 6, 4)),
      values: top.map((u) => u.total),
      valueFormatter: (v) => formatCompactUsdt(v),
    });
  }, [filtered]);

  const openDrill = (r: BurnRow) =>
    setDrill({
      kind: 'burn',
      id: r.id,
      wallet: r.wallet,
      counterpartyWallet: null,
      settleDate: r.date,
      rawAmount: r.raw,
      burnedAmount: r.burned,
      actualAmount: r.raw - r.burned,
      rate: null,
      status: null,
      reason: r.reason,
      rewardType: r.rewardType,
      contributions: [],
      raw: r.original,
    });

  return (
    <div className="rw-page">
      <PageHeader title={t('rewards.burns.title')} subtitle={t('rewards.burns.subtitle')} />
      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={() => query.refetch()}
        showAmount
      />

      {query.isError ? (
        <InlineError
          title={t('common.error')}
          description={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div className="rw-kpis">
        <KpiDeltaCard
          label={t('rewards.burns.kpi.burn_total')}
          value={formatCompactUsdt(burnTotal)}
          current={burnTotal}
          previous={prevBurnTotal}
          trend={sparkBurn}
          tone="danger"
          higherIsBetter={false}
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.burns.kpi.burn_ratio')}
          value={`${burnRatio.toFixed(1)}%`}
          current={burnRatio}
          previous={prevBurnRatio}
          tone="warn"
          higherIsBetter={false}
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.burns.kpi.raw_volume')}
          value={formatCompactUsdt(rawTotal)}
          current={rawTotal}
          previous={prevRawTotal}
          tone="neutral"
          loading={query.isLoading}
        />
        <KpiDeltaCard
          label={t('rewards.burns.kpi.affected')}
          value={formatInt(affectedWallets)}
          current={affectedWallets}
          previous={prevAffectedWallets}
          tone="warn"
          higherIsBetter={false}
          loading={query.isLoading}
        />
      </div>

      <div className="rw-charts">
        <SectionCard title={t('rewards.burns.chart.trend')} hint={t('rewards.burns.chart.trend_hint')}>
          <BaseChart option={trendOption} height={260} loading={query.isLoading} />
        </SectionCard>
        <SectionCard title={t('rewards.burns.chart.reasons')} hint={t('rewards.burns.chart.reasons_hint')}>
          <BaseChart option={reasonDonut} height={260} loading={query.isLoading} />
        </SectionCard>
      </div>

      <div className="rw-charts rw-charts--single">
        <SectionCard
          title={t('rewards.burns.chart.top_burned')}
          hint={t('rewards.burns.chart.top_burned_hint')}
          status={topBurnedOption ? 'idle' : 'empty'}
        >
          {topBurnedOption && <BaseChart option={topBurnedOption} height={260} loading={query.isLoading} />}
        </SectionCard>
      </div>

      <SectionCard
        title={t('rewards.burns.table.title')}
        hint={t('rewards.burns.table.hint')}
        padded={false}
      >
        <DataTable<BurnRow>
          rowKey={(r) => r.id}
          dataSource={filtered as BurnRow[]}
          loading={query.isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          onRow={(record) => ({
            onClick: () => openDrill(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('rewards.col.wallet'),
              dataIndex: 'wallet',
              render: (_: unknown, r: BurnRow) => <WalletCell value={r.wallet} />,
            },
            {
              title: t('rewards.col.reward_type'),
              dataIndex: 'rewardType',
              width: 110,
              render: (_: unknown, r: BurnRow) => (
                <TierBadge value={r.rewardType} />
              ),
            },
            { title: t('rewards.col.date'), dataIndex: 'date', width: 130, render: (v: unknown) => <TimeCell value={v} /> },
            {
              title: t('rewards.col.raw_total'),
              dataIndex: 'raw',
              align: 'right' as const,
              render: (_: unknown, r: BurnRow) => <AmountCell value={r.raw} />,
            },
            {
              title: t('rewards.col.burned'),
              dataIndex: 'burned',
              align: 'right' as const,
              sorter: (a: BurnRow, b: BurnRow) => a.burned - b.burned,
              render: (_: unknown, r: BurnRow) => <AmountCell value={r.burned} accent="down" />,
            },
            { title: t('rewards.col.reason'), dataIndex: 'reason' },
          ]}
        />
      </SectionCard>
      </>)}

      <RewardDrillDrawer open={!!drill} row={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function filterBurnRows(rows: readonly BurnRow[], filters: GlobalFilters): BurnRow[] {
  const byRange = filterByRange(rows, (r) => r.date, filters.range);
  const term = filters.wallet.trim().toLowerCase();
  const min = filters.amountMin.trim() === '' ? null : Number(filters.amountMin);
  const max = filters.amountMax.trim() === '' ? null : Number(filters.amountMax);
  return byRange.filter((r) => {
    if (term && !r.wallet.toLowerCase().includes(term)) return false;
    if (min !== null && Number.isFinite(min) && r.burned < min) return false;
    if (max !== null && Number.isFinite(max) && r.burned > max) return false;
    return true;
  });
}

// Backwards-compat alias
export const RewardsLanding = RewardsOverviewPage;

// Keep `t` import used so the file compiles even if the top-level page
// adds more helpers later.
void t;
