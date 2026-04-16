/**
 * ConfigGroupHeader — right column header for the Config Center.
 *
 * Shows the currently-selected group's title, description, risk
 * badge, and a 4-tile KPI strip:
 *
 *   - Key count
 *   - Active version count (keys with a current version)
 *   - Scheduled version count (future versions across all keys)
 *   - Last updated (relative time)
 *
 * High-risk groups get a secondary "high risk" callout embedded in
 * the header, satisfying the requirement that the risk marker is
 * visible in both the nav AND the detail area.
 */
import { AlertTriangle, Clock, History, Layers } from 'lucide-react';
import type { FC } from 'react';

import { KpiStatCard } from '../../components/shared';
import { formatRelativeTime } from '../../lib/format';
import { useT } from '../../lib/i18n';

import type { ConfigGroupMeta, ConfigRiskLevel } from './configTaxonomy';
import { RiskChip } from './ConfigGroupNav';
import type { GroupIndexEntry } from './derive';

interface ConfigGroupHeaderProps {
  readonly meta: ConfigGroupMeta;
  readonly entry: GroupIndexEntry | undefined;
}

export const ConfigGroupHeader: FC<ConfigGroupHeaderProps> = ({ meta, entry }) => {
  const t = useT();

  const keyCount = entry?.keyCount ?? meta.keys.length;
  const futureCount = entry?.futureCount ?? 0;
  const activeCount =
    entry?.buckets.reduce(
      (acc, b) => acc + (b.current ? 1 : 0),
      0,
    ) ?? 0;
  const historyCount =
    entry?.buckets.reduce((acc, b) => acc + b.history.length, 0) ?? 0;
  const lastUpdated = entry?.lastUpdated;

  return (
    <section className="cfg-group-header">
      <div className="cfg-group-header__top">
        <div className="cfg-group-header__lead">
          <div className="cfg-group-header__eyebrow">{t('config.group.eyebrow')}</div>
          <div className="cfg-group-header__title-row">
            <h2 className="cfg-group-header__title">{meta.labelZh}</h2>
            <RiskChip level={meta.risk} size="md" />
          </div>
          <div className="cfg-group-header__description">
            {meta.descriptionZh}
          </div>
        </div>

        {meta.risk === 'high' && <HighRiskCallout level="high" />}
      </div>

      <div className="cfg-group-header__kpis">
        <KpiStatCard
          label={t('config.kpi.key_count')}
          value={String(keyCount)}
          icon={<Layers size={14} />}
        />
        <KpiStatCard
          label={t('config.kpi.active_count')}
          value={String(activeCount)}
          accent={activeCount > 0 ? 'var(--px-status-ok)' : 'var(--px-text-tertiary)'}
        />
        <KpiStatCard
          label={t('config.kpi.future_count')}
          value={String(futureCount)}
          accent={futureCount > 0 ? 'var(--px-status-warn)' : 'var(--px-text-tertiary)'}
          icon={<Clock size={14} />}
        />
        <KpiStatCard
          label={t('config.kpi.history_count')}
          value={String(historyCount)}
          icon={<History size={14} />}
        />
        <KpiStatCard
          label={t('config.kpi.last_updated')}
          value={lastUpdated ? formatRelativeTime(lastUpdated) : '—'}
        />
      </div>
    </section>
  );
};

/* --------------------------------------------------------------------- */
/*  High-risk callout                                                    */
/* --------------------------------------------------------------------- */

export const HighRiskCallout: FC<{ level: ConfigRiskLevel }> = ({ level }) => {
  const t = useT();
  if (level !== 'high') return null;
  return (
    <div className="cfg-risk-callout">
      <div className="cfg-risk-callout__icon">
        <AlertTriangle size={16} />
      </div>
      <div className="cfg-risk-callout__body">
        <div className="cfg-risk-callout__title">
          {t('config.risk.callout_title')}
        </div>
        <div className="cfg-risk-callout__desc">
          {t('config.risk.callout_body')}
        </div>
      </div>
    </div>
  );
};
