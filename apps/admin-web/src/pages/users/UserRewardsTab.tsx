/**
 * UserRewardsTab — per-user reward analytics panel.
 *
 * Reuses Phase 8 analytics building blocks:
 *   - 6 summary KPI tiles (direct/team/equal/burned/claimable/claimed)
 *   - Reward trend area chart across the last 60 days
 *   - Reward type donut
 *   - Detail table with click → RewardDrillDrawer
 *
 * The `claimed_total` card stays `—` when the view model exposes
 * `null` — no synthesis.
 */
import { useMemo, useState } from 'react';
import type { FC } from 'react';

import { BaseChart } from '../../components/charts/BaseChart';
import {
  buildAreaChartOption,
  buildDonutOption,
} from '../../components/charts/options';
import {
  AmountCell,
  DataTable,
  RewardDrillDrawer,
  SectionCard,
  StatusBadge,
  TimeCell,
  type DrillRow,
} from '../../components/shared';
import { bucketByDay, sumBy } from '../../lib/analytics';
import { formatCompactUsdt } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { resolveRange } from '../../lib/timeRange';
import type { UserDetailViewModel, UserRewardRow } from '../../services/user/userViewModel';

interface UserRewardsTabProps {
  readonly vm: UserDetailViewModel;
}

export const UserRewardsTab: FC<UserRewardsTabProps> = ({ vm }) => {
  const t = useT();
  const [drill, setDrill] = useState<DrillRow | null>(null);

  // 90-day window — this tab does not own its own time range picker
  // in v1; it uses a fixed 90-day analytics window.
  const range = useMemo(() => resolveRange('90d'), []);

  const { rewards, rewardRows } = vm;

  /* Trend option */
  const trendOption = useMemo(() => {
    const direct = rewardRows.filter((r) => r.kind === 'direct');
    const team = rewardRows.filter((r) => r.kind === 'team');
    const equal = rewardRows.filter((r) => r.kind === 'equal_level');
    const directTrend = bucketByDay(direct, (r) => r.date, (r) => Number(r.rawAmount), range);
    const teamTrend = bucketByDay(team, (r) => r.date, (r) => Number(r.rawAmount), range);
    const equalTrend = bucketByDay(equal, (r) => r.date, (r) => Number(r.rawAmount), range);
    return buildAreaChartOption({
      xLabels: directTrend.map((p) => p.day.slice(5)),
      series: [
        { name: t('rewards.series.direct'), data: directTrend.map((p) => p.value) },
        { name: t('rewards.series.team'), data: teamTrend.map((p) => p.value) },
        { name: t('rewards.series.equal'), data: equalTrend.map((p) => p.value) },
      ],
      stacked: true,
      yFormatter: (v) => formatCompactUsdt(v),
    });
  }, [rewardRows, range, t]);

  /* Structure donut */
  const donutOption = useMemo(() => {
    const direct = sumBy(rewardRows.filter((r) => r.kind === 'direct'), (r) => Number(r.rawAmount));
    const team = sumBy(rewardRows.filter((r) => r.kind === 'team'), (r) => Number(r.rawAmount));
    const equal = sumBy(rewardRows.filter((r) => r.kind === 'equal_level'), (r) => Number(r.rawAmount));
    const burned = sumBy(rewardRows.filter((r) => r.kind === 'burn'), (r) => Number(r.burnedAmount));
    const total = direct + team + equal;
    return buildDonutOption({
      data: [
        { name: t('rewards.series.direct'), value: Math.max(0.01, direct) },
        { name: t('rewards.series.team'), value: Math.max(0.01, team) },
        { name: t('rewards.series.equal'), value: Math.max(0.01, equal) },
        { name: t('rewards.series.burned'), value: Math.max(0.01, burned) },
      ],
      centerValue: formatCompactUsdt(total),
      centerLabel: t('users.rewards.total'),
    });
  }, [rewardRows, t]);

  const openDrill = (row: UserRewardRow) =>
    setDrill({
      kind: row.kind,
      id: row.id,
      wallet: vm.identity.walletAddress,
      counterpartyWallet: row.counterpartyWallet,
      settleDate: row.date,
      rawAmount: row.rawAmount,
      burnedAmount: row.burnedAmount,
      actualAmount: row.actualAmount,
      rate: null,
      status: row.status,
      reason: row.reason,
      rewardType: row.kind,
      contributions: [],
      raw: row.original,
    });

  return (
    <div className="up-rewards">
      <div className="up-rewards__summary">
        <SummaryTile
          label={t('users.kpi.reward_direct')}
          value={formatCompactUsdt(rewards.directTotal)}
          accent="var(--px-status-ok)"
        />
        <SummaryTile
          label={t('users.kpi.reward_team')}
          value={formatCompactUsdt(rewards.teamTotal)}
          accent="var(--px-status-ok)"
        />
        <SummaryTile
          label={t('users.kpi.reward_equal')}
          value={formatCompactUsdt(rewards.equalLevelTotal)}
          accent="var(--px-status-ok)"
        />
        <SummaryTile
          label={t('users.kpi.reward_burned')}
          value={formatCompactUsdt(rewards.burnedTotal)}
          accent="var(--px-status-err)"
        />
        <SummaryTile
          label={t('users.kpi.reward_claimable')}
          value={formatCompactUsdt(rewards.claimableTotal)}
          accent="var(--px-status-warn)"
        />
        <SummaryTile
          label={t('users.kpi.reward_claimed')}
          value={rewards.claimedTotal !== null ? formatCompactUsdt(rewards.claimedTotal) : '—'}
          accent="var(--px-status-warn)"
          missingHint={rewards.claimedTotal === null ? t('users.kpi.reward_claimed_missing') : undefined}
        />
      </div>

      <div className="up-rewards__charts">
        <SectionCard
          title={t('users.rewards.trend')}
          hint={t('users.rewards.trend_hint')}
        >
          <BaseChart option={trendOption} height={240} />
        </SectionCard>
        <SectionCard title={t('users.rewards.structure')} hint={t('users.rewards.structure_hint')}>
          <BaseChart option={donutOption} height={240} />
        </SectionCard>
      </div>

      <SectionCard
        title={t('users.rewards.table')}
        hint={t('users.rewards.table_hint')}
        padded={false}
        status={rewardRows.length === 0 ? 'empty' : 'idle'}
      >
        <DataTable<UserRewardRow>
          rowKey={(r) => r.id || `${r.kind}-${r.date}`}
          dataSource={rewardRows as UserRewardRow[]}
          onRow={(record) => ({
            onClick: () => openDrill(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('users.rewards.col.kind'),
              dataIndex: 'kind',
              width: 100,
              render: (_: unknown, r: UserRewardRow) => (
                <span className={`up-rewards-kind up-rewards-kind--${r.kind}`}>
                  {t(`reports.kind.${r.kind}`)}
                </span>
              ),
            },
            {
              title: t('users.rewards.col.date'),
              dataIndex: 'date',
              width: 150,
              sorter: (a: UserRewardRow, b: UserRewardRow) => Date.parse(a.date) - Date.parse(b.date),
              render: (_: unknown, r: UserRewardRow) => <TimeCell value={r.date} />,
            },
            {
              title: t('users.rewards.col.raw'),
              dataIndex: 'raw',
              align: 'right' as const,
              render: (_: unknown, r: UserRewardRow) => <AmountCell value={r.rawAmount} />,
            },
            {
              title: t('users.rewards.col.burned'),
              dataIndex: 'burned',
              align: 'right' as const,
              render: (_: unknown, r: UserRewardRow) => (
                <AmountCell value={r.burnedAmount} accent="down" />
              ),
            },
            {
              title: t('users.rewards.col.actual'),
              dataIndex: 'actual',
              align: 'right' as const,
              render: (_: unknown, r: UserRewardRow) => (
                <AmountCell value={r.actualAmount} accent="up" />
              ),
            },
            {
              title: t('common.status'),
              dataIndex: 'status',
              width: 110,
              render: (_: unknown, r: UserRewardRow) =>
                r.status ? <StatusBadge value={r.status} /> : <span className="up-rewards__muted">—</span>,
            },
          ]}
        />
      </SectionCard>

      <RewardDrillDrawer open={!!drill} row={drill} onClose={() => setDrill(null)} />
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Summary tile                                                         */
/* --------------------------------------------------------------------- */

import { Tooltip } from 'antd';
import { Info } from 'lucide-react';

const SummaryTile: FC<{
  label: string;
  value: string;
  accent: string;
  missingHint?: string;
}> = ({ label, value, accent, missingHint }) => (
  <div className="up-rewards-summary-tile">
    <span className="up-rewards-summary-tile__accent" style={{ background: accent }} />
    <div className="up-rewards-summary-tile__label">
      {label}
      {missingHint && (
        <Tooltip title={missingHint} placement="top">
          <Info size={11} className="up-rewards-summary-tile__info" />
        </Tooltip>
      )}
    </div>
    <div className="up-rewards-summary-tile__value px-tabular">{value}</div>
  </div>
);
