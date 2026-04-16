/**
 * ConfigVersionTimeline — vertical history timeline.
 *
 * Renders every non-current version (future + superseded + disabled
 * + older active) as a timeline entry with version number, status,
 * effective_from, apply_scope, creator, and note. Used in the
 * History tab of `ConfigDetailPanel`.
 */
import { Clock, History as HistoryIcon } from 'lucide-react';
import type { FC } from 'react';

import {
  EmptyState,
  StatusBadge,
  TimeCell,
} from '../../components/shared';
import { useT } from '../../lib/i18n';

import type { ConfigKeyBucket, ConfigVersionLike } from './derive';

interface ConfigVersionTimelineProps {
  readonly bucket: ConfigKeyBucket;
}

export const ConfigVersionTimeline: FC<ConfigVersionTimelineProps> = ({
  bucket,
}) => {
  const t = useT();

  // Combined timeline ordered by effective_from desc:
  //   future (already asc), then current, then history (already desc).
  // For display we reverse future so the soonest sits nearest to
  // current.
  const futureDesc = [...bucket.future].reverse();
  const items: TimelineItem[] = [
    ...futureDesc.map((v) => ({
      version: v,
      marker: 'future' as const,
    })),
    ...(bucket.current
      ? [{ version: bucket.current, marker: 'current' as const }]
      : []),
    ...bucket.history.map((v) => ({
      version: v,
      marker: 'history' as const,
    })),
  ];

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('config.history.empty')}
        subtitle={t('config.history.empty_hint')}
      />
    );
  }

  return (
    <div className="cfg-timeline">
      {items.map((it, idx) => (
        <TimelineRow
          key={it.version.config_version_id}
          item={it}
          isLast={idx === items.length - 1}
        />
      ))}
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Internal                                                             */
/* --------------------------------------------------------------------- */

interface TimelineItem {
  readonly version: ConfigVersionLike;
  readonly marker: 'future' | 'current' | 'history';
}

const TimelineRow: FC<{ item: TimelineItem; isLast: boolean }> = ({
  item,
  isLast,
}) => {
  const t = useT();
  const { version, marker } = item;

  return (
    <div
      className={`cfg-timeline__row cfg-timeline__row--${marker} ${isLast ? 'cfg-timeline__row--last' : ''}`.trim()}
    >
      <div className="cfg-timeline__rail">
        <div className="cfg-timeline__dot">
          {marker === 'future' ? (
            <Clock size={11} />
          ) : marker === 'current' ? null : (
            <HistoryIcon size={11} />
          )}
        </div>
        {!isLast && <div className="cfg-timeline__line" />}
      </div>
      <div className="cfg-timeline__card">
        <div className="cfg-timeline__top">
          <span className="cfg-timeline__version px-tabular">
            v{version.version_no}
          </span>
          <StatusBadge value={version.status} />
          <span className="cfg-timeline__marker">
            {marker === 'future' && t('config.history.scheduled')}
            {marker === 'current' && t('config.history.current')}
            {marker === 'history' && t('config.history.historical')}
          </span>
        </div>
        <div className="cfg-timeline__meta">
          <span>
            <span className="cfg-timeline__meta-label">
              {t('config.detail.field.effective_from')}:
            </span>{' '}
            <TimeCell value={version.effective_from} />
          </span>
          <span>
            <span className="cfg-timeline__meta-label">
              {t('config.detail.field.apply_scope')}:
            </span>{' '}
            <span className={`cfg-scope-tag cfg-scope-tag--${version.apply_scope}`}>
              {t(`config.scope.${version.apply_scope}`, version.apply_scope)}
            </span>
          </span>
          {version.created_by && (
            <span>
              <span className="cfg-timeline__meta-label">
                {t('config.detail.field.created_by')}:
              </span>{' '}
              <code className="cfg-timeline__code">{version.created_by}</code>
            </span>
          )}
        </div>
        {version.description && (
          <div className="cfg-timeline__note">{version.description}</div>
        )}
      </div>
    </div>
  );
};
