/**
 * UserRowPreviewDrawer — right-side quick preview for a list row.
 *
 * Opened from the row `⋯` dropdown ("Quick preview"). Shows the
 * essential identity + tier + financial + team + rewards at a
 * glance without leaving the list. A primary "View full detail"
 * button routes to the detail page.
 */
import { Drawer } from 'antd';
import { ArrowRight, Network as NetworkIcon, Sparkles, Users } from 'lucide-react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  KeyValuePanel,
  SectionCard,
  StatusBadge,
  TierBadge,
  WalletCell,
  type KvItem,
} from '../../components/shared';
import { formatCompactUsdt, formatInt } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { UserListRow } from '../../services/user/userListAnalytics';

interface UserRowPreviewDrawerProps {
  readonly open: boolean;
  readonly row: UserListRow | null;
  readonly onClose: () => void;
}

export const UserRowPreviewDrawer: FC<UserRowPreviewDrawerProps> = ({
  open,
  row,
  onClose,
}) => {
  const t = useT();
  const navigate = useNavigate();

  const identityItems: KvItem[] = row
    ? [
        {
          label: t('users.col.wallet'),
          value: <WalletCell value={row.wallet_address} head={8} tail={6} />,
        },
        {
          label: t('users.col.status'),
          value: <StatusBadge value={row.status} />,
        },
        {
          label: t('users.col.tier'),
          value: <TierBadge value={row.current_tier ?? 'none'} />,
        },
      ]
    : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={null}
      className="up-preview-drawer"
      destroyOnHidden
    >
      {row ? (
        <div className="up-preview">
          <header className="up-preview__header">
            <div className="up-preview__eyebrow">{t('users.preview.eyebrow')}</div>
            <div className="up-preview__wallet">
              <WalletCell value={row.wallet_address} head={12} tail={8} />
            </div>
          </header>

          <SectionCard title={t('users.preview.identity')}>
            <KeyValuePanel items={identityItems} columns={1} compact />
          </SectionCard>

          <div className="up-preview__metrics">
            <PreviewMetric
              icon={<Sparkles size={13} />}
              label={t('users.preview.deposit')}
              value={formatCompactUsdt(row.cumulative_deposit)}
              tone="brand"
            />
            <PreviewMetric
              icon={<Sparkles size={13} />}
              label={t('users.preview.team_performance')}
              value={formatCompactUsdt(row.team_total_performance)}
              tone="warn"
            />
            <PreviewMetric
              icon={<Users size={13} />}
              label={t('users.preview.direct')}
              value={formatInt(row.direct_referral_count)}
              tone="neutral"
            />
            <PreviewMetric
              icon={<Users size={13} />}
              label={t('users.preview.team_size')}
              value={formatInt(row.team_size)}
              tone="neutral"
            />
          </div>

          <div className="up-preview__actions">
            <button
              type="button"
              className="ant-btn ant-btn-primary up-preview__primary"
              onClick={() => {
                onClose();
                navigate(`/users/${row.wallet_address}`);
              }}
            >
              {t('users.preview.open_detail')}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="ant-btn"
              onClick={() => {
                onClose();
                navigate(`/users/${row.wallet_address}/tree`);
              }}
            >
              <NetworkIcon size={13} />
              {t('users.preview.open_tree')}
            </button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
};

interface PreviewMetricProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  tone: 'brand' | 'warn' | 'neutral';
}

const PreviewMetric: FC<PreviewMetricProps> = ({ icon, label, value, tone }) => (
  <div className={`up-preview-metric up-preview-metric--${tone}`}>
    <div className="up-preview-metric__head">
      {icon}
      <span>{label}</span>
    </div>
    <div className="up-preview-metric__value px-tabular">{value}</div>
  </div>
);
