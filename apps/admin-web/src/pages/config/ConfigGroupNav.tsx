/**
 * ConfigGroupNav — left rail for the Config Center.
 *
 * Each row shows a config group's metadata: professional Chinese
 * label, short description, key count, future-scheduled indicator,
 * and a risk chip. The currently-selected row has a brand accent bar
 * on the left.
 *
 * Rows come from `CONFIG_TAXONOMY` so the nav lists every group the
 * platform knows about, even if the fixture has no rows for it yet.
 */
import { AlertTriangle, Clock, Layers } from 'lucide-react';
import type { FC } from 'react';

import { formatRelativeTime } from '../../lib/format';
import { tp, useT } from '../../lib/i18n';

import {
  CONFIG_TAXONOMY,
  type ConfigGroupMeta,
  type ConfigRiskLevel,
} from './configTaxonomy';
import type { GroupIndexEntry } from './derive';

interface ConfigGroupNavProps {
  readonly selectedGroup: string | null;
  readonly onSelect: (group: string) => void;
  readonly groupIndex: ReadonlyMap<string, GroupIndexEntry>;
}

export const ConfigGroupNav: FC<ConfigGroupNavProps> = ({
  selectedGroup,
  onSelect,
  groupIndex,
}) => {
  const t = useT();

  return (
    <nav className="cfg-nav" aria-label={t('config.nav.aria')}>
      <div className="cfg-nav__header">
        <div className="cfg-nav__title">
          <Layers size={14} />
          <span>{t('config.nav.title')}</span>
        </div>
        <div className="cfg-nav__hint">{t('config.nav.hint')}</div>
      </div>

      <ul className="cfg-nav__list">
        {CONFIG_TAXONOMY.map((meta) => {
          const entry = groupIndex.get(meta.group);
          const keyCount = entry?.keyCount ?? meta.keys.length;
          const futureCount = entry?.futureCount ?? 0;
          const lastUpdated = entry?.lastUpdated;
          const isSelected = selectedGroup === meta.group;

          return (
            <li key={meta.group}>
              <ConfigGroupNavItem
                meta={meta}
                selected={isSelected}
                keyCount={keyCount}
                futureCount={futureCount}
                lastUpdated={lastUpdated}
                onSelect={() => onSelect(meta.group)}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

interface NavItemProps {
  meta: ConfigGroupMeta;
  selected: boolean;
  keyCount: number;
  futureCount: number;
  lastUpdated?: string;
  onSelect: () => void;
}

const ConfigGroupNavItem: FC<NavItemProps> = ({
  meta,
  selected,
  keyCount,
  futureCount,
  lastUpdated,
  onSelect,
}) => {
  const t = useT();

  return (
    <button
      type="button"
      className={`cfg-nav__item ${selected ? 'cfg-nav__item--selected' : ''}`.trim()}
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
    >
      <span className="cfg-nav__accent" aria-hidden />

      <div className="cfg-nav__row-top">
        <span className="cfg-nav__label">{meta.labelZh}</span>
        <RiskChip level={meta.risk} size="sm" />
      </div>

      <div className="cfg-nav__desc">{meta.descriptionZh}</div>

      <div className="cfg-nav__row-bottom">
        <span className="cfg-nav__meta">
          {tp('config.nav.key_count', { count: keyCount })}
        </span>
        {futureCount > 0 && (
          <span className="cfg-nav__future">
            <Clock size={11} />
            {tp('config.nav.future_count', { count: futureCount })}
          </span>
        )}
        {lastUpdated && (
          <span className="cfg-nav__updated">
            {t('config.nav.updated')}
            {' · '}
            {formatRelativeTime(lastUpdated)}
          </span>
        )}
      </div>
    </button>
  );
};

/* --------------------------------------------------------------------- */
/*  Risk chip (shared small component)                                   */
/* --------------------------------------------------------------------- */

interface RiskChipProps {
  level: ConfigRiskLevel;
  size?: 'sm' | 'md';
}

export const RiskChip: FC<RiskChipProps> = ({ level, size = 'md' }) => {
  const t = useT();
  const labelKey =
    level === 'high'
      ? 'config.risk.high'
      : level === 'medium'
        ? 'config.risk.medium'
        : 'config.risk.low';
  return (
    <span className={`cfg-risk cfg-risk--${level} cfg-risk--${size}`}>
      {level === 'high' && <AlertTriangle size={10} />}
      {t(labelKey)}
    </span>
  );
};
