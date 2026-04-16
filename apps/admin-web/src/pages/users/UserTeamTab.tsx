/**
 * UserTeamTab — team structure panel.
 *
 * Composes:
 *   - Team summary card (team_performance / direct / team_size / rate)
 *   - Upline path (if referrer exists)
 *   - Direct children table
 *   - Navigation shortcuts to /users/:wallet/tree and /network/team
 */
import { ArrowRight, Network as NetworkIcon } from 'lucide-react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AmountCell,
  CountCell,
  DataTable,
  KpiStatCard,
  SectionCard,
  StatusBadge,
  TierBadge,
  WalletCell,
} from '../../components/shared';
import { formatCompactUsdt, formatPercent, truncateHash } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type {
  UserDetailViewModel,
  UserTeamChild,
} from '../../services/user/userViewModel';

interface UserTeamTabProps {
  readonly vm: UserDetailViewModel;
}

export const UserTeamTab: FC<UserTeamTabProps> = ({ vm }) => {
  const t = useT();
  const navigate = useNavigate();
  const { financial, referral, qualification, teamChildren, identity } = vm;

  return (
    <div className="up-team">
      {/* Team summary strip */}
      <div className="up-team__summary">
        <KpiStatCard
          label={t('users.kpi.team_performance')}
          value={formatCompactUsdt(financial.teamTotalPerformance)}
          accent="var(--px-brand)"
        />
        <KpiStatCard
          label={t('users.kpi.direct_count')}
          value={referral.directReferralCount}
          accent="var(--px-chart-2)"
        />
        <KpiStatCard
          label={t('users.kpi.team_size')}
          value={referral.teamSize}
          accent="var(--px-chart-3)"
        />
        <KpiStatCard
          label={t('users.qualification.team_rate')}
          value={
            qualification.teamRate
              ? formatPercent(Number(qualification.teamRate), 1)
              : '—'
          }
          accent="var(--px-status-ok)"
        />
      </div>

      {/* Upline path */}
      <SectionCard
        title={t('users.team.upline')}
        hint={t('users.team.upline_hint')}
      >
        {referral.referrerAddress ? (
          <div className="up-team-path">
            <div className="up-team-path__node">
              <span className="up-team-path__badge">{t('users.team.upline_root')}</span>
              <code>{truncateHash(referral.referrerAddress, 8, 6)}</code>
              <button
                type="button"
                className="up-team-path__jump"
                onClick={() => navigate(`/users/${referral.referrerAddress}`)}
                title={t('users.team.open_upline')}
              >
                <ArrowRight size={12} />
              </button>
            </div>
            <div className="up-team-path__line" />
            <div className="up-team-path__node up-team-path__node--current">
              <span className="up-team-path__badge">{t('users.team.current')}</span>
              <code>{truncateHash(identity.walletAddress, 8, 6)}</code>
            </div>
          </div>
        ) : (
          <div className="up-team-root-note">
            <span>{t('users.team.is_root')}</span>
          </div>
        )}
      </SectionCard>

      {/* Direct children */}
      <SectionCard
        title={t('users.team.direct_children')}
        hint={t('users.team.direct_children_hint')}
        padded={false}
        status={teamChildren.length === 0 ? 'empty' : 'idle'}
        actions={
          <button
            type="button"
            className="ant-btn ant-btn-primary"
            onClick={() => navigate(`/users/${identity.walletAddress}/tree`)}
          >
            <NetworkIcon size={13} />
            {t('users.team.open_tree')}
          </button>
        }
      >
        <DataTable<UserTeamChild>
          rowKey={(r) => r.walletAddress}
          dataSource={teamChildren as UserTeamChild[]}
          onRow={(record) => ({
            onClick: () => navigate(`/users/${record.walletAddress}`),
            style: { cursor: 'pointer' },
          })}
          pagination={false}
          columns={[
            {
              title: t('users.col.wallet'),
              dataIndex: 'walletAddress',
              render: (_: unknown, r: UserTeamChild) => <WalletCell value={r.walletAddress} />,
            },
            {
              title: t('users.col.tier'),
              dataIndex: 'tier',
              width: 100,
              render: (_: unknown, r: UserTeamChild) => <TierBadge value={r.tier ?? 'none'} />,
            },
            {
              title: t('users.col.status'),
              dataIndex: 'status',
              width: 110,
              render: (_: unknown, r: UserTeamChild) => <StatusBadge value={r.status} />,
            },
            {
              title: t('users.col.deposit'),
              dataIndex: 'personalDeposit',
              align: 'right' as const,
              sorter: (a: UserTeamChild, b: UserTeamChild) =>
                Number(a.personalDeposit) - Number(b.personalDeposit),
              render: (_: unknown, r: UserTeamChild) => <AmountCell value={r.personalDeposit} />,
            },
            {
              title: t('users.col.team_performance'),
              dataIndex: 'teamPerformance',
              align: 'right' as const,
              sorter: (a: UserTeamChild, b: UserTeamChild) =>
                Number(a.teamPerformance) - Number(b.teamPerformance),
              render: (_: unknown, r: UserTeamChild) => <AmountCell value={r.teamPerformance} />,
            },
            {
              title: t('users.col.direct'),
              dataIndex: 'directCount',
              align: 'right' as const,
              render: (_: unknown, r: UserTeamChild) => <CountCell value={r.directCount} />,
            },
            {
              title: t('users.col.team_size'),
              dataIndex: 'teamSize',
              align: 'right' as const,
              render: (_: unknown, r: UserTeamChild) => <CountCell value={r.teamSize} />,
            },
          ]}
        />
      </SectionCard>
    </div>
  );
};
