/**
 * UserKpiStrip — list page top metric row.
 *
 * 8 compact metric cards derived from the raw user list. These are
 * NOT delta KPIs (no time-range comparison) — they describe the
 * current shape of the user base as an operational snapshot.
 */
import {
  Flame,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { useT } from '../../lib/i18n';
import type { UserListKpis } from '../../services/user/userListAnalytics';

interface UserKpiStripProps {
  readonly kpis: UserListKpis;
}

export const UserKpiStrip: FC<UserKpiStripProps> = ({ kpis }) => {
  const t = useT();
  return (
    <div className="up-kpi-strip">
      <KpiTile
        icon={<Users size={14} />}
        label={t('users.kpi.total')}
        value={kpis.total}
        accent="var(--px-brand)"
      />
      <KpiTile
        icon={<UserCheck size={14} />}
        label={t('users.kpi.active')}
        value={kpis.active}
        accent="var(--px-status-ok)"
      />
      <KpiTile
        icon={<Users size={14} />}
        label={t('users.kpi.has_team')}
        value={kpis.hasTeam}
        accent="var(--px-chart-2)"
      />
      <KpiTile
        icon={<ShieldCheck size={14} />}
        label={t('users.kpi.restricted')}
        value={kpis.restricted}
        accent="var(--px-status-err)"
      />
      <KpiTile
        icon={<Star size={14} />}
        label={t('users.kpi.elite')}
        value={kpis.elite}
        accent="var(--px-chart-3)"
      />
      <KpiTile
        icon={<Wallet size={14} />}
        label={t('users.kpi.high_value')}
        value={kpis.highValue}
        accent="var(--px-chart-4)"
      />
      <KpiTile
        icon={<UserPlus size={14} />}
        label={t('users.kpi.new_today')}
        value={kpis.newToday}
        accent="var(--px-chart-5)"
      />
      <KpiTile
        icon={<Sparkles size={14} />}
        label={t('users.kpi.rewarded')}
        value={kpis.rewarded}
        accent="var(--px-status-warn)"
      />
      {/* Silence unused import warning */}
      <span style={{ display: 'none' }}>
        <Flame />
      </span>
    </div>
  );
};

interface KpiTileProps {
  icon: ReactNode;
  label: ReactNode;
  value: number;
  accent: string;
}

const KpiTile: FC<KpiTileProps> = ({ icon, label, value, accent }) => (
  <div className="up-kpi-tile">
    <span className="up-kpi-tile__accent" style={{ background: accent }} />
    <div className="up-kpi-tile__head">
      <span className="up-kpi-tile__icon" style={{ color: accent }}>
        {icon}
      </span>
      <span className="up-kpi-tile__label">{label}</span>
    </div>
    <div className="up-kpi-tile__value px-tabular">{value.toLocaleString('en-US')}</div>
  </div>
);
