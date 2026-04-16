/**
 * UserRelatedLinksCard — cross-module navigation footer.
 *
 * Turns the detail page into a real hub: six routed shortcut tiles
 * that lead the operator into the network, rewards, burn, and log
 * views scoped (where possible) to this wallet.
 */
import {
  ArrowUpRight,
  FileText,
  Flame,
  GitBranch,
  Network as NetworkIcon,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { SectionCard } from '../../components/shared';
import { useT } from '../../lib/i18n';

interface UserRelatedLinksCardProps {
  readonly walletAddress: string;
}

export const UserRelatedLinksCard: FC<UserRelatedLinksCardProps> = ({
  walletAddress,
}) => {
  const t = useT();
  const navigate = useNavigate();

  const links: {
    icon: ReactNode;
    label: string;
    subtitle: string;
    onClick: () => void;
  }[] = [
    {
      icon: <NetworkIcon size={14} />,
      label: t('users.related.tree'),
      subtitle: t('users.related.tree_hint'),
      onClick: () => navigate(`/users/${walletAddress}/tree`),
    },
    {
      icon: <GitBranch size={14} />,
      label: t('users.related.network'),
      subtitle: t('users.related.network_hint'),
      onClick: () => navigate('/network/team'),
    },
    {
      icon: <Wallet size={14} />,
      label: t('users.related.rewards_overview'),
      subtitle: t('users.related.rewards_overview_hint'),
      onClick: () => navigate('/rewards'),
    },
    {
      icon: <FileText size={14} />,
      label: t('users.related.reports'),
      subtitle: t('users.related.reports_hint'),
      onClick: () => navigate('/reports'),
    },
    {
      icon: <Flame size={14} />,
      label: t('users.related.burns'),
      subtitle: t('users.related.burns_hint'),
      onClick: () => navigate('/rewards/burns'),
    },
    {
      icon: <ShieldAlert size={14} />,
      label: t('users.related.logs'),
      subtitle: t('users.related.logs_hint'),
      onClick: () => navigate('/logs'),
    },
  ];

  return (
    <SectionCard
      title={t('users.related.title')}
      hint={t('users.related.hint')}
    >
      <div className="up-related-grid">
        {links.map((link, idx) => (
          <button
            key={idx}
            type="button"
            className="up-related-tile"
            onClick={link.onClick}
          >
            <span className="up-related-tile__icon">{link.icon}</span>
            <span className="up-related-tile__body">
              <span className="up-related-tile__label">{link.label}</span>
              <span className="up-related-tile__sub">{link.subtitle}</span>
            </span>
            <ArrowUpRight size={12} className="up-related-tile__arrow" />
          </button>
        ))}
      </div>
    </SectionCard>
  );
};
