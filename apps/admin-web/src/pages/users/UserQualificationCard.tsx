/**
 * UserQualificationCard — reward eligibility summary.
 *
 * Lives between the KPI grid and the tabs. Shows whether the user
 * is eligible for direct rewards, team rewards, and the equal-level
 * policy, plus their current team rate and peer flag.
 */
import { Tooltip } from 'antd';
import { Check, CircleSlash, Info, Star } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { SectionCard } from '../../components/shared';
import { formatPercent } from '../../lib/format';
import { t, useT } from '../../lib/i18n';
import type { UserDetailViewModel } from '../../services/user/userViewModel';

interface UserQualificationCardProps {
  readonly vm: UserDetailViewModel;
}

export const UserQualificationCard: FC<UserQualificationCardProps> = ({ vm }) => {
  const t = useT();
  const { qualification } = vm;

  return (
    <SectionCard
      title={t('users.qualification.title')}
      hint={t('users.qualification.hint')}
    >
      <div className="up-qual-grid">
        <QualBadge
          label={t('users.qualification.reward_qualified')}
          enabled={qualification.rewardQualified}
          tooltip={t('users.qualification.reward_tip')}
        />
        <QualBadge
          label={t('users.qualification.team_qualified')}
          enabled={qualification.teamRewardQualified}
          tooltip={t('users.qualification.team_tip')}
        />
        <QualStat
          label={t('users.qualification.team_rate')}
          value={
            qualification.teamRate !== null
              ? formatPercent(Number(qualification.teamRate), 1)
              : '—'
          }
        />
        <QualStat
          label={t('users.qualification.is_peer')}
          value={
            qualification.isPeer ? (
              <span className="up-qual-peer">
                <Star size={11} />
                {t('common.yes')}
              </span>
            ) : (
              <span className="up-qual-muted">{t('common.no')}</span>
            )
          }
        />
      </div>
    </SectionCard>
  );
};

interface QualBadgeProps {
  label: ReactNode;
  enabled: boolean;
  tooltip?: ReactNode;
}

const QualBadge: FC<QualBadgeProps> = ({ label, enabled, tooltip }) => (
  <div className={`up-qual-badge up-qual-badge--${enabled ? 'on' : 'off'}`}>
    <div className="up-qual-badge__icon">
      {enabled ? <Check size={13} /> : <CircleSlash size={13} />}
    </div>
    <div className="up-qual-badge__body">
      <div className="up-qual-badge__label">
        {label}
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <Info size={10} className="up-qual-badge__info" />
          </Tooltip>
        )}
      </div>
      <div className="up-qual-badge__state">
        {enabled ? <span>{t('qualification.eligible')}</span> : <span>{t('qualification.not_eligible')}</span>}
      </div>
    </div>
  </div>
);

const QualStat: FC<{ label: ReactNode; value: ReactNode }> = ({ label, value }) => (
  <div className="up-qual-stat">
    <div className="up-qual-stat__label">{label}</div>
    <div className="up-qual-stat__value px-tabular">{value}</div>
  </div>
);
