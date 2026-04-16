/**
 * UserOverviewTab — "概览" tab content.
 *
 * Four structured SectionCards: Identity / Referral / Financial /
 * Qualification. This is NOT a rehash of the hero — it's the
 * full-field structured view meant to answer "what do we know
 * about this user" in one scroll.
 */
import type { FC } from 'react';

import {
  KeyValuePanel,
  SectionCard,
  StatusBadge,
  TierBadge,
  TimeCell,
  WalletCell,
  type KvItem,
} from '../../components/shared';
import { formatCompactUsdt, formatPercent, truncateHash } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { UserDetailViewModel } from '../../services/user/userViewModel';

interface UserOverviewTabProps {
  readonly vm: UserDetailViewModel;
}

export const UserOverviewTab: FC<UserOverviewTabProps> = ({ vm }) => {
  const t = useT();
  const { identity, referral, financial, qualification } = vm;

  const identityItems: KvItem[] = [
    { label: t('users.col.wallet'), value: <WalletCell value={identity.walletAddress} /> },
    { label: t('users.col.status'), value: <StatusBadge value={identity.status} /> },
    { label: t('users.col.tier'), value: <TierBadge value={identity.tier ?? 'none'} /> },
    {
      label: t('users.hero.created'),
      value: identity.createdAt ? <TimeCell value={identity.createdAt} /> : '—',
    },
    {
      label: t('users.hero.first_purchase'),
      value: identity.firstPurchaseAt ? <TimeCell value={identity.firstPurchaseAt} /> : '—',
    },
    {
      label: t('users.hero.last_active'),
      value: identity.lastActiveAt ? <TimeCell value={identity.lastActiveAt} /> : '—',
    },
  ];

  const referralItems: KvItem[] = [
    {
      label: t('users.hero.referrer'),
      value: referral.referrerAddress ? (
        <code>{truncateHash(referral.referrerAddress, 10, 8)}</code>
      ) : (
        <span className="up-overview__muted">{t('users.hero.root_user')}</span>
      ),
    },
    {
      label: t('users.hero.bound_at'),
      value: referral.boundAt ? <TimeCell value={referral.boundAt} /> : '—',
    },
    {
      label: t('users.hero.binding_source'),
      value: referral.bindingSource ?? '—',
    },
    {
      label: t('users.kpi.direct_count'),
      value: <span className="px-tabular">{referral.directReferralCount}</span>,
    },
    {
      label: t('users.kpi.team_size'),
      value: <span className="px-tabular">{referral.teamSize}</span>,
    },
  ];

  const financialItems: KvItem[] = [
    {
      label: t('users.kpi.cumulative_deposit'),
      value: (
        <span className="px-tabular">{formatCompactUsdt(financial.cumulativeDeposit)}</span>
      ),
    },
    {
      label: t('users.kpi.holding_value'),
      value: (
        <span className="px-tabular">{formatCompactUsdt(financial.holdingValueUsdt)}</span>
      ),
    },
    {
      label: t('users.kpi.team_performance'),
      value: (
        <span className="px-tabular">
          {formatCompactUsdt(financial.teamTotalPerformance)}
        </span>
      ),
    },
    {
      label: t('users.overview.buy_count'),
      value:
        financial.buyCount === null ? (
          <span className="up-overview__muted">—</span>
        ) : (
          <span className="px-tabular">{financial.buyCount}</span>
        ),
    },
  ];

  const qualItems: KvItem[] = [
    {
      label: t('users.qualification.reward_qualified'),
      value: qualification.rewardQualified ? (
        <span className="up-overview__yes">{t('common.yes')}</span>
      ) : (
        <span className="up-overview__no">{t('common.no')}</span>
      ),
    },
    {
      label: t('users.qualification.team_qualified'),
      value: qualification.teamRewardQualified ? (
        <span className="up-overview__yes">{t('common.yes')}</span>
      ) : (
        <span className="up-overview__no">{t('common.no')}</span>
      ),
    },
    {
      label: t('users.qualification.team_rate'),
      value: qualification.teamRate ? (
        <span className="px-tabular">
          {formatPercent(Number(qualification.teamRate), 1)}
        </span>
      ) : (
        '—'
      ),
    },
    {
      label: t('users.qualification.is_peer'),
      value: qualification.isPeer ? t('common.yes') : t('common.no'),
    },
  ];

  return (
    <div className="up-overview">
      <SectionCard title={t('users.overview.identity')} hint={t('users.overview.identity_hint')}>
        <KeyValuePanel items={identityItems} columns={2} />
      </SectionCard>
      <SectionCard title={t('users.overview.referral')} hint={t('users.overview.referral_hint')}>
        <KeyValuePanel items={referralItems} columns={2} />
      </SectionCard>
      <SectionCard
        title={t('users.overview.financial')}
        hint={t('users.overview.financial_hint')}
      >
        <KeyValuePanel items={financialItems} columns={2} />
      </SectionCard>
      <SectionCard
        title={t('users.overview.qualification')}
        hint={t('users.overview.qualification_hint')}
      >
        <KeyValuePanel items={qualItems} columns={2} />
      </SectionCard>
    </div>
  );
};
