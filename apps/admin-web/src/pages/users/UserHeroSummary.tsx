/**
 * UserHeroSummary — Account Overview hero block on the detail page.
 *
 * Renders the primary identity, status, tier, and metadata row plus
 * the right-hand action cluster (change status / view network / view
 * rewards / view audit / copy link).
 *
 * This is NOT a KPI grid — quantitative metrics live in
 * `UserKpiGrid`. This block is the "first-impression" identity
 * summary.
 */
import { Clipboard, FileText, Link2, Network as NetworkIcon, ShieldAlert, Wallet } from 'lucide-react';
import type { FC } from 'react';

import {
  StatusBadge,
  TierBadge,
  TimeCell,
} from '../../components/shared';
import { formatRelativeTime, truncateHash } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { UserDetailViewModel } from '../../services/user/userViewModel';

interface UserHeroSummaryProps {
  readonly vm: UserDetailViewModel;
  readonly onChangeStatus: () => void;
  readonly onViewTree: () => void;
  readonly onViewRewards: () => void;
  readonly onViewAudit: () => void;
  readonly onCopyLink: () => void;
}

export const UserHeroSummary: FC<UserHeroSummaryProps> = ({
  vm,
  onChangeStatus,
  onViewTree,
  onViewRewards,
  onViewAudit,
  onCopyLink,
}) => {
  const t = useT();
  const { identity, referral } = vm;

  return (
    <section className="up-hero">
      <div className="up-hero__lead">
        <div className="up-hero__eyebrow">{t('users.detail.eyebrow')}</div>
        <div className="up-hero__wallet-row">
          <Wallet size={18} className="up-hero__wallet-icon" />
          <code className="up-hero__wallet" title={identity.walletAddress}>
            {truncateHash(identity.walletAddress, 14, 10)}
          </code>
          <button
            type="button"
            className="up-hero__copy"
            onClick={() => navigator.clipboard.writeText(identity.walletAddress)}
            title={t('common.copy')}
          >
            <Clipboard size={14} />
          </button>
        </div>

        <div className="up-hero__badges">
          <StatusBadge value={identity.status} />
          <TierBadge value={identity.tier ?? 'none'} />
        </div>

        <div className="up-hero__meta">
          <MetaItem
            label={t('users.hero.created')}
            value={identity.createdAt ? <TimeCell value={identity.createdAt} /> : '—'}
          />
          <MetaItem
            label={t('users.hero.first_purchase')}
            value={
              identity.firstPurchaseAt ? <TimeCell value={identity.firstPurchaseAt} /> : '—'
            }
          />
          <MetaItem
            label={t('users.hero.last_active')}
            value={identity.lastActiveAt ? formatRelativeTime(identity.lastActiveAt) : '—'}
          />
          <MetaItem
            label={t('users.hero.referrer')}
            value={
              referral.referrerAddress ? (
                <code className="up-hero__meta-code">
                  {truncateHash(referral.referrerAddress, 8, 6)}
                </code>
              ) : (
                <span className="up-hero__meta-muted">{t('users.hero.root_user')}</span>
              )
            }
          />
          <MetaItem
            label={t('users.hero.bound_at')}
            value={referral.boundAt ? <TimeCell value={referral.boundAt} /> : '—'}
          />
          <MetaItem
            label={t('users.hero.binding_source')}
            value={
              referral.bindingSource ? (
                <span>{referral.bindingSource}</span>
              ) : (
                <span className="up-hero__meta-muted">—</span>
              )
            }
          />
        </div>
      </div>

      <div className="up-hero__actions">
        <button
          type="button"
          className="ant-btn ant-btn-dangerous up-hero__action"
          onClick={onChangeStatus}
        >
          <ShieldAlert size={14} />
          {t('users.action.change_status')}
        </button>
        <button type="button" className="ant-btn up-hero__action" onClick={onViewTree}>
          <NetworkIcon size={14} />
          {t('users.action.tree')}
        </button>
        <button type="button" className="ant-btn up-hero__action" onClick={onViewRewards}>
          <FileText size={14} />
          {t('users.action.rewards')}
        </button>
        <button type="button" className="ant-btn up-hero__action" onClick={onViewAudit}>
          <FileText size={14} />
          {t('users.action.audit')}
        </button>
        <button type="button" className="ant-btn up-hero__action" onClick={onCopyLink}>
          <Link2 size={14} />
          {t('users.action.copy_link')}
        </button>
      </div>
    </section>
  );
};

const MetaItem: FC<{ label: React.ReactNode; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="up-hero__meta-item">
    <div className="up-hero__meta-label">{label}</div>
    <div className="up-hero__meta-value">{value}</div>
  </div>
);
