/**
 * UserKpiGrid — 12 metric cards organised into three bands:
 *
 *   A. 资产与行为    (Deposit / Holding / Vesting Locked)
 *   B. 团队结构      (Direct / Team size / Team performance)
 *   C. 奖励          (Direct / Team / Equal / Burned / Claimable / Claimed)
 *
 * `claimedTotal` is deliberately rendered as `—` when the view
 * model has no source for it — we surface a tooltip explaining
 * that a claim-records endpoint is needed, instead of fabricating
 * a value.
 *
 * Same applies to `vestingLocked` — when the vesting endpoint is
 * not available (the current state), the card shows `—` with an
 * "integration required" tooltip.
 */
import { Tooltip } from 'antd';
import { Info } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { formatCompactUsdt, formatInt } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { UserDetailViewModel } from '../../services/user/userViewModel';

interface UserKpiGridProps {
  readonly vm: UserDetailViewModel;
}

export const UserKpiGrid: FC<UserKpiGridProps> = ({ vm }) => {
  const t = useT();
  const { financial, referral, rewards, vesting } = vm;

  return (
    <div className="up-kpi-grid">
      {/* --- Band A: Assets & Behaviour --- */}
      <BandHeader label={t('users.kpi.band.assets')} />
      <KpiCard
        label={t('users.kpi.cumulative_deposit')}
        value={formatCompactUsdt(financial.cumulativeDeposit)}
        accent="var(--px-brand)"
      />
      <KpiCard
        label={t('users.kpi.holding_value')}
        value={formatCompactUsdt(financial.holdingValueUsdt)}
        accent="var(--px-chart-2)"
      />
      <KpiCard
        label={t('users.kpi.vesting_locked')}
        value={vesting.totalLocked !== null ? formatCompactUsdt(vesting.totalLocked) : '—'}
        missing={vesting.totalLocked === null}
        missingHint={t('users.vesting.integration_required')}
        accent="var(--px-chart-4)"
      />

      {/* --- Band B: Team Structure --- */}
      <BandHeader label={t('users.kpi.band.team')} />
      <KpiCard
        label={t('users.kpi.direct_count')}
        value={formatInt(referral.directReferralCount)}
        accent="var(--px-chart-3)"
      />
      <KpiCard
        label={t('users.kpi.team_size')}
        value={formatInt(referral.teamSize)}
        accent="var(--px-chart-3)"
      />
      <KpiCard
        label={t('users.kpi.team_performance')}
        value={formatCompactUsdt(financial.teamTotalPerformance)}
        accent="var(--px-chart-3)"
      />

      {/* --- Band C: Rewards --- */}
      <BandHeader label={t('users.kpi.band.rewards')} />
      <KpiCard
        label={t('users.kpi.reward_direct')}
        value={formatCompactUsdt(rewards.directTotal)}
        accent="var(--px-status-ok)"
      />
      <KpiCard
        label={t('users.kpi.reward_team')}
        value={formatCompactUsdt(rewards.teamTotal)}
        accent="var(--px-status-ok)"
      />
      <KpiCard
        label={t('users.kpi.reward_equal')}
        value={formatCompactUsdt(rewards.equalLevelTotal)}
        accent="var(--px-status-ok)"
      />
      <KpiCard
        label={t('users.kpi.reward_burned')}
        value={formatCompactUsdt(rewards.burnedTotal)}
        accent="var(--px-status-err)"
      />
      <KpiCard
        label={t('users.kpi.reward_claimable')}
        value={formatCompactUsdt(rewards.claimableTotal)}
        accent="var(--px-status-warn)"
      />
      <KpiCard
        label={t('users.kpi.reward_claimed')}
        value={rewards.claimedTotal !== null ? formatCompactUsdt(rewards.claimedTotal) : '—'}
        missing={rewards.claimedTotal === null}
        missingHint={t('users.kpi.reward_claimed_missing')}
        accent="var(--px-status-warn)"
      />
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Sub components                                                       */
/* --------------------------------------------------------------------- */

const BandHeader: FC<{ label: ReactNode }> = ({ label }) => (
  <div className="up-kpi-grid__band">{label}</div>
);

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  accent: string;
  missing?: boolean;
  missingHint?: string;
}

const KpiCard: FC<KpiCardProps> = ({ label, value, accent, missing, missingHint }) => (
  <div className={`up-kpi-card ${missing ? 'up-kpi-card--missing' : ''}`}>
    <span className="up-kpi-card__accent" style={{ background: accent }} />
    <div className="up-kpi-card__label">
      {label}
      {missing && missingHint && (
        <Tooltip title={missingHint} placement="top">
          <Info size={11} className="up-kpi-card__info" />
        </Tooltip>
      )}
    </div>
    <div className="up-kpi-card__value px-tabular">{value}</div>
  </div>
);
