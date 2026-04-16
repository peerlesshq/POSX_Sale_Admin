/**
 * Agent Network — Phase 7.7 full implementation.
 *
 * Two pages:
 *   - NetworkOverviewPage — global KPIs + depth distribution + top
 *     leaders + 7-day activity heatmap + an aggregate-source footer
 *     that makes the client-aggregate origin obvious.
 *   - HierarchyAnalysisPage — focused on depth / width / activity
 *     with larger charts.
 *
 * Both pages read from `networkProvider` via React Query hooks. The
 * provider is swappable, so moving to a real `/admin/network/overview`
 * endpoint later is a single-file change.
 */
import { Info as InfoIcon } from 'lucide-react';
import { useMemo } from 'react';

import { BaseChart } from '../components/charts/BaseChart';
import {
  buildHBarOption,
  buildHeatmapOption,
  buildVBarOption,
} from '../components/charts/options';
import {
  AmountCell,
  Badge,
  CountCell,
  DataTable,
  InlineError,
  KpiStatCard,
  PageHeader,
  SectionCard,
  TierBadge,
  WalletCell,
} from '../components/shared';
import { formatCompactUsdt, formatInt, toNumber } from '../lib/format';
import { useT } from '../lib/i18n';
import {
  useHierarchyAnalysis,
  useNetworkOverview,
  type NetworkLeader,
} from '../services/network';

/* ==================================================================
 * Overview
 * ================================================================== */

export function NetworkOverviewPage() {
  const t = useT();
  const { data, isLoading, isError, error: err, refetch } = useNetworkOverview();

  const kpis = data?.kpis;
  const depths = data?.depthDistribution ?? [];
  const leaders = data?.topLeaders ?? [];
  const heatmap = data?.heatmap ?? [];

  const depthChartOption = useMemo(
    () =>
      buildVBarOption({
        categories: depths.map((d) => `L${d.depth}`),
        values: depths.map((d) => d.agentCount),
        color: 'var(--px-chart-1)',
        valueFormatter: (v) => formatInt(v),
      }),
    [depths],
  );

  const leaderChartOption = useMemo(() => {
    if (leaders.length === 0) return undefined;
    return buildHBarOption({
      categories: leaders.slice(0, 8).map((l) => l.walletAddress.slice(0, 10)),
      values: leaders.slice(0, 8).map((l) => toNumber(l.teamVolume)),
      valueFormatter: (v) => formatCompactUsdt(v),
    });
  }, [leaders]);

  const heatmapOption = useMemo(() => {
    if (heatmap.length === 0) return undefined;
    const days = Array.from(new Set(heatmap.map((h) => h.day))).sort();
    const depthList = Array.from(new Set(heatmap.map((h) => h.depth))).sort((a, b) => a - b);
    const xCats = days.map((d) => d.slice(5));
    const yCats = depthList.map((d) => `L${d}`);
    const dayIdx = new Map(days.map((d, i) => [d, i]));
    const depthIdx = new Map(depthList.map((d, i) => [d, i]));
    const data = heatmap.map((h) => ({
      x: dayIdx.get(h.day) ?? 0,
      y: depthIdx.get(h.depth) ?? 0,
      value: h.activity,
    }));
    return buildHeatmapOption({ xCategories: xCats, yCategories: yCats, data });
  }, [heatmap]);

  return (
    <div>
      <PageHeader
        title={t('network.overview.title')}
        subtitle={t('network.overview.subtitle')}
        actions={
          <Badge tone="warn">
            <InfoIcon size={11} style={{ marginRight: 4 }} />
            {t('network.aggregate_badge')}
          </Badge>
        }
      />

      {isError && (
        <div style={{ marginBottom: 20 }}>
          <InlineError
            title={t('common.error')}
            description={err instanceof Error ? err.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
          />
        </div>
      )}

      {/* KPI row */}
      {!isError && (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiStatCard
          label={t('network.kpi.total_agents')}
          value={formatInt(kpis?.totalAgents ?? 0)}
          sub={`${formatInt(kpis?.activeAgents ?? 0)} · ${t('network.kpi.active_agents')}`}
          accent="var(--px-chart-1)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('network.kpi.max_depth')}
          value={formatInt(kpis?.maxDepth ?? 0)}
          sub={t('network.hierarchy.depth_histogram')}
          accent="var(--px-chart-2)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('network.kpi.average_direct')}
          value={(kpis?.averageDirect ?? 0).toFixed(2)}
          sub={t('users.col.direct')}
          accent="var(--px-chart-3)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('network.kpi.top_leader_volume')}
          value={formatCompactUsdt(kpis?.topLeaderVolume ?? 0)}
          sub={t('network.section.top_leaders')}
          accent="var(--px-chart-4)"
          loading={isLoading}
        />
      </div>
      )}

      {!isError && (<>
      {/* Depth + Leaders */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <SectionCard
          title={t('network.section.depth_distribution')}
          hint={t('network.section.depth_hint')}
          padded
          status={isLoading ? 'loading' : depths.length === 0 ? 'empty' : 'idle'}
        >
          <BaseChart option={depthChartOption} height={260} />
        </SectionCard>
        <SectionCard
          title={t('network.section.top_leaders')}
          hint={t('network.section.top_leaders_hint')}
          padded
          status={isLoading ? 'loading' : leaders.length === 0 ? 'empty' : 'idle'}
        >
          {leaderChartOption && <BaseChart option={leaderChartOption} height={260} />}
        </SectionCard>
      </div>

      {/* Heatmap */}
      <SectionCard
        title={t('network.section.network_heatmap')}
        hint={t('network.section.network_heatmap_hint')}
        padded
        status={isLoading ? 'loading' : heatmap.length === 0 ? 'empty' : 'idle'}
      >
        {heatmapOption && <BaseChart option={heatmapOption} height={260} />}
      </SectionCard>

      {/* Leaders table */}
      <div style={{ marginTop: 20 }}>
        <SectionCard
          title={t('network.section.top_leaders')}
          hint={t('network.section.top_leaders_hint')}
          padded={false}
          status={isLoading ? 'loading' : leaders.length === 0 ? 'empty' : 'idle'}
        >
          <DataTable<NetworkLeader>
            rowKey={(r) => `${r.walletAddress}-${r.rank}`}
            dataSource={[...leaders]}
            pagination={false}
            columns={[
              {
                title: t('network.col.rank'),
                dataIndex: 'rank',
                width: 72,
                render: (v: number) => (
                  <span
                    className="px-tabular"
                    style={{
                      fontWeight: 600,
                      color:
                        v <= 3 ? 'var(--px-brand)' : 'var(--px-text-secondary)',
                    }}
                  >
                    #{v}
                  </span>
                ),
              },
              {
                title: t('network.col.wallet'),
                dataIndex: 'walletAddress',
                render: (v: string) => <WalletCell value={v} />,
              },
              {
                title: t('network.col.tier'),
                dataIndex: 'tier',
                render: (v: string) => <TierBadge value={v} />,
              },
              {
                title: t('network.col.team_size'),
                dataIndex: 'teamSize',
                align: 'right',
                render: (v: number) => <CountCell value={v} />,
              },
              {
                title: t('network.col.direct_count'),
                dataIndex: 'directCount',
                align: 'right',
                render: (v: number) => <CountCell value={v} />,
              },
              {
                title: t('network.col.team_volume'),
                dataIndex: 'teamVolume',
                align: 'right',
                render: (v: string) => <AmountCell value={v} />,
              },
            ]}
          />
        </SectionCard>
      </div>

      {/* Aggregate source footer */}
      <div
        style={{
          marginTop: 16,
          padding: '10px 14px',
          background: 'var(--px-bg-inset)',
          border: '1px solid var(--px-border-subtle)',
          borderRadius: 'var(--px-radius-md)',
          color: 'var(--px-text-tertiary)',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <InfoIcon size={13} />
        <span>{t('network.data_source_notice')}</span>
      </div>
      </>)}
    </div>
  );
}

/* ==================================================================
 * Hierarchy Analysis
 * ================================================================== */

export function HierarchyAnalysisPage() {
  const t = useT();
  const { data, isLoading, isError, error: hierErr, refetch } = useHierarchyAnalysis();

  const depths = data?.depthDistribution ?? [];

  const histogramOption = useMemo(
    () =>
      buildVBarOption({
        categories: depths.map((d) => `L${d.depth}`),
        values: depths.map((d) => d.agentCount),
        color: 'var(--px-chart-1)',
        valueFormatter: (v) => formatInt(v),
      }),
    [depths],
  );

  const activeOption = useMemo(
    () =>
      buildVBarOption({
        categories: depths.map((d) => `L${d.depth}`),
        values: depths.map((d) => d.activeCount),
        color: 'var(--px-chart-3)',
        valueFormatter: (v) => formatInt(v),
      }),
    [depths],
  );

  return (
    <div>
      <PageHeader
        title={t('network.hierarchy.title')}
        subtitle={t('network.hierarchy.subtitle')}
        actions={
          <Badge tone="warn">
            <InfoIcon size={11} style={{ marginRight: 4 }} />
            {t('network.aggregate_badge')}
          </Badge>
        }
      />

      {isError ? (
        <InlineError
          title={t('common.error')}
          description={hierErr instanceof Error ? hierErr.message : undefined}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiStatCard
          label={t('network.kpi.max_depth')}
          value={formatInt(data?.totalDepth ?? 0)}
          accent="var(--px-chart-1)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('network.hierarchy.max_width')}
          value={formatInt(data?.maxWidth ?? 0)}
          accent="var(--px-chart-2)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('network.hierarchy.average_children')}
          value={(data?.averageChildren ?? 0).toFixed(2)}
          accent="var(--px-chart-3)"
          loading={isLoading}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
        }}
      >
        <SectionCard
          title={t('network.hierarchy.depth_histogram')}
          hint={t('network.hierarchy.level_count')}
          padded
          status={isLoading ? 'loading' : depths.length === 0 ? 'empty' : 'idle'}
        >
          <BaseChart option={histogramOption} height={300} />
        </SectionCard>
        <SectionCard
          title={t('network.hierarchy.activity')}
          hint={t('network.kpi.active_agents')}
          padded
          status={isLoading ? 'loading' : depths.length === 0 ? 'empty' : 'idle'}
        >
          <BaseChart option={activeOption} height={300} />
        </SectionCard>
      </div>
      </>)}
    </div>
  );
}
