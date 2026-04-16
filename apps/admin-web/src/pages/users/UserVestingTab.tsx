/**
 * UserVestingTab — Vesting panel.
 *
 * IMPORTANT: The current API surface does NOT expose a per-user
 * vesting endpoint. Per spec §14 and the project decision to never
 * fabricate financial data, this tab renders a professional
 * "Integration required" placeholder whenever `vesting.available`
 * is false, and refuses to synthesize lots.
 *
 * When a vesting endpoint lands, `UserDetailViewModel.vesting` will
 * pick it up and the real summary + lots table will render
 * automatically.
 */
import { ArrowUpRight, Construction, Info } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import {
  DataTable,
  SectionCard,
  StatusBadge,
  TimeCell,
} from '../../components/shared';
import { formatCompactUsdt } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type {
  UserDetailViewModel,
  UserVestingLot,
} from '../../services/user/userViewModel';

interface UserVestingTabProps {
  readonly vm: UserDetailViewModel;
}

export const UserVestingTab: FC<UserVestingTabProps> = ({ vm }) => {
  const t = useT();
  const { vesting } = vm;

  if (!vesting.available) {
    return <VestingIntegrationPlaceholder />;
  }

  return (
    <div className="up-vesting">
      <div className="up-vesting__summary">
        <VestingKpi
          label={t('users.vesting.total_locked')}
          value={vesting.totalLocked !== null ? formatCompactUsdt(vesting.totalLocked) : '—'}
          accent="var(--px-chart-4)"
        />
        <VestingKpi
          label={t('users.vesting.total_released')}
          value={
            vesting.totalReleased !== null ? formatCompactUsdt(vesting.totalReleased) : '—'
          }
          accent="var(--px-status-ok)"
        />
        <VestingKpi
          label={t('users.vesting.total_withdrawable')}
          value={
            vesting.totalWithdrawable !== null
              ? formatCompactUsdt(vesting.totalWithdrawable)
              : '—'
          }
          accent="var(--px-status-warn)"
        />
        <VestingKpi
          label={t('users.vesting.total_withdrawn')}
          value={
            vesting.totalWithdrawn !== null ? formatCompactUsdt(vesting.totalWithdrawn) : '—'
          }
          accent="var(--px-brand)"
        />
      </div>

      <SectionCard
        title={t('users.vesting.lots')}
        hint={t('users.vesting.lots_hint')}
        padded={false}
        status={vesting.lots.length === 0 ? 'empty' : 'idle'}
      >
        <DataTable<UserVestingLot>
          rowKey={(lot) => lot.lotId}
          dataSource={vesting.lots as UserVestingLot[]}
          pagination={false}
          columns={[
            { title: t('users.vesting.col.lot_id'), dataIndex: 'lotId' },
            {
              title: t('users.vesting.col.start_time'),
              dataIndex: 'startTime',
              render: (_: unknown, r: UserVestingLot) =>
                r.startTime ? <TimeCell value={r.startTime} /> : '—',
            },
            {
              title: t('users.vesting.col.total_locked'),
              dataIndex: 'totalLocked',
              align: 'right' as const,
              render: (_: unknown, r: UserVestingLot) => (
                <span className="px-tabular">{formatCompactUsdt(r.totalLocked)}</span>
              ),
            },
            {
              title: t('users.vesting.col.released'),
              dataIndex: 'releasedAmount',
              align: 'right' as const,
              render: (_: unknown, r: UserVestingLot) => (
                <span className="px-tabular">{formatCompactUsdt(r.releasedAmount)}</span>
              ),
            },
            {
              title: t('users.vesting.col.withdrawable'),
              dataIndex: 'withdrawableAmount',
              align: 'right' as const,
              render: (_: unknown, r: UserVestingLot) => (
                <span className="px-tabular">
                  {formatCompactUsdt(r.withdrawableAmount)}
                </span>
              ),
            },
            {
              title: t('users.vesting.col.withdrawn'),
              dataIndex: 'withdrawnAmount',
              align: 'right' as const,
              render: (_: unknown, r: UserVestingLot) => (
                <span className="px-tabular">{formatCompactUsdt(r.withdrawnAmount)}</span>
              ),
            },
            {
              title: t('common.status'),
              dataIndex: 'status',
              render: (_: unknown, r: UserVestingLot) => <StatusBadge value={r.status} />,
            },
          ]}
        />
      </SectionCard>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Integration placeholder                                              */
/* --------------------------------------------------------------------- */

const VestingIntegrationPlaceholder: FC = () => {
  const t = useT();
  return (
    <div className="up-vesting-placeholder">
      <div className="up-vesting-placeholder__icon">
        <Construction size={28} />
      </div>
      <div className="up-vesting-placeholder__title">
        {t('users.vesting.integration_title')}
      </div>
      <div className="up-vesting-placeholder__body">
        {t('users.vesting.integration_body')}
      </div>
      <div className="up-vesting-placeholder__required">
        <Info size={13} />
        <span>{t('users.vesting.integration_required')}</span>
      </div>
      <div className="up-vesting-placeholder__checks">
        <Check label={`GET /admin/users/:wallet/vesting`} />
        <Check label={`GET /admin/users/:wallet/vesting/lots`} />
      </div>
      <div className="up-vesting-placeholder__note">
        <ArrowUpRight size={11} />
        <span>{t('users.vesting.integration_note')}</span>
      </div>
    </div>
  );
};

const Check: FC<{ label: string }> = ({ label }) => (
  <div className="up-vesting-placeholder__check">
    <code>{label}</code>
  </div>
);

const VestingKpi: FC<{ label: ReactNode; value: ReactNode; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div className="up-vesting-kpi">
    <span className="up-vesting-kpi__accent" style={{ background: accent }} />
    <div className="up-vesting-kpi__label">{label}</div>
    <div className="up-vesting-kpi__value px-tabular">{value}</div>
  </div>
);
