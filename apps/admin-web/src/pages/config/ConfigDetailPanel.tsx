/**
 * ConfigDetailPanel — the "expanded" view for a selected config key.
 *
 * Lives below the key table as a real detail panel (not a collapse).
 * Contains:
 *
 *   - Header: group · key · version badge · risk badge · created_by / at
 *   - Tabs:
 *       1. Current — structured renderer + metadata key/value panel
 *       2. Future  — scheduled versions with diff vs current
 *       3. History — vertical timeline of older versions
 *       4. Diff    — manual two-version compare with selectors
 *       5. Raw     — read-only JSON viewer with copy
 *
 * Loading / empty / error states are handled by the caller; this
 * component assumes a resolved `bucket` exists.
 */
import { Tabs } from 'antd';
import {
  CircleCheck,
  Clock,
  Code,
  GitCompare,
  History as HistoryIcon,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import {
  EmptyState,
  JsonViewer,
  KeyValuePanel,
  SectionCard,
  StatusBadge,
  TimeCell,
  type KvItem,
} from '../../components/shared';
import { useT } from '../../lib/i18n';

import { ConfigValueRenderer } from './ConfigValueRenderer';
import { ConfigDiffViewer } from './ConfigDiffViewer';
import { ConfigVersionTimeline } from './ConfigVersionTimeline';
import {
  effectiveRisk,
  getKeyMeta,
  type ConfigGroupMeta,
} from './configTaxonomy';
import { RiskChip } from './ConfigGroupNav';
import type { ConfigKeyBucket, ConfigVersionLike } from './derive';

interface ConfigDetailPanelProps {
  readonly groupMeta: ConfigGroupMeta;
  readonly bucket: ConfigKeyBucket;
}

type TabKey = 'current' | 'future' | 'history' | 'diff' | 'raw';

export const ConfigDetailPanel: FC<ConfigDetailPanelProps> = ({
  groupMeta,
  bucket,
}) => {
  const t = useT();
  const keyMeta = getKeyMeta(bucket.group, bucket.key);
  const risk = effectiveRisk(bucket.group, bucket.key);

  const [activeTab, setActiveTab] = useState<TabKey>('current');

  const current = bucket.current;
  const firstFuture = bucket.future[0];
  const latestHistory = bucket.history[0];

  // For the Diff tab we pre-select the best default pair.
  const diffDefault = useMemo(() => {
    if (current && firstFuture) {
      return { left: current, right: firstFuture };
    }
    if (current && latestHistory) {
      return { left: latestHistory, right: current };
    }
    return null;
  }, [current, firstFuture, latestHistory]);

  return (
    <section className="cfg-detail">
      <header className="cfg-detail__header">
        <div className="cfg-detail__head-lead">
          <div className="cfg-detail__eyebrow">
            {groupMeta.labelZh} · <code>{bucket.group}</code>
          </div>
          <h3 className="cfg-detail__title">
            {keyMeta?.labelZh ?? bucket.key}
            <code className="cfg-detail__key-code">{bucket.key}</code>
          </h3>
          {keyMeta?.descriptionZh && (
            <div className="cfg-detail__description">{keyMeta.descriptionZh}</div>
          )}
        </div>
        <div className="cfg-detail__head-tail">
          <RiskChip level={risk} size="md" />
          {current ? (
            <span className="cfg-detail__version-chip">
              {t('config.detail.current_version')} · v{current.version_no}
            </span>
          ) : (
            <span className="cfg-detail__version-chip cfg-detail__version-chip--muted">
              {t('config.detail.no_active')}
            </span>
          )}
        </div>
      </header>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        className="cfg-detail__tabs"
        items={[
          {
            key: 'current',
            label: (
              <span className="cfg-detail__tab-label">
                <CircleCheck size={13} />
                {t('config.tab.current')}
              </span>
            ),
            children: <CurrentTab version={current} groupMeta={groupMeta} bucket={bucket} />,
          },
          {
            key: 'future',
            label: (
              <span className="cfg-detail__tab-label">
                <Clock size={13} />
                {t('config.tab.future')}
                {bucket.future.length > 0 && (
                  <span className="cfg-detail__tab-count">{bucket.future.length}</span>
                )}
              </span>
            ),
            children: (
              <FutureTab
                groupMeta={groupMeta}
                bucket={bucket}
                future={bucket.future}
                current={current}
              />
            ),
          },
          {
            key: 'history',
            label: (
              <span className="cfg-detail__tab-label">
                <HistoryIcon size={13} />
                {t('config.tab.history')}
                {bucket.history.length > 0 && (
                  <span className="cfg-detail__tab-count">{bucket.history.length}</span>
                )}
              </span>
            ),
            children: <ConfigVersionTimeline bucket={bucket} />,
          },
          {
            key: 'diff',
            label: (
              <span className="cfg-detail__tab-label">
                <GitCompare size={13} />
                {t('config.tab.diff')}
              </span>
            ),
            children: (
              <ConfigDiffViewer
                bucket={bucket}
                defaultLeft={diffDefault?.left ?? null}
                defaultRight={diffDefault?.right ?? null}
                highRisk={risk === 'high'}
              />
            ),
          },
          {
            key: 'raw',
            label: (
              <span className="cfg-detail__tab-label">
                <Code size={13} />
                {t('config.tab.raw')}
              </span>
            ),
            children: <RawTab version={current} />,
          },
        ]}
      />
    </section>
  );
};

/* --------------------------------------------------------------------- */
/*  Tab contents                                                         */
/* --------------------------------------------------------------------- */

const CurrentTab: FC<{
  version: ConfigVersionLike | null;
  groupMeta: ConfigGroupMeta;
  bucket: ConfigKeyBucket;
}> = ({ version, bucket }) => {
  const t = useT();
  if (!version) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          title={t('config.detail.no_active')}
          subtitle={t('config.detail.no_active_hint')}
        />
      </SectionCard>
    );
  }
  return (
    <div className="cfg-detail__body">
      <SectionCard
        title={t('config.detail.metadata')}
        hint={t('config.detail.metadata_hint')}
      >
        <VersionMetadataPanel version={version} />
      </SectionCard>
      <SectionCard
        title={t('config.detail.structured_value')}
        hint={t('config.detail.structured_value_hint')}
      >
        <ConfigValueRenderer
          group={bucket.group}
          configKey={bucket.key}
          value={version.config_value}
        />
      </SectionCard>
    </div>
  );
};

const FutureTab: FC<{
  groupMeta: ConfigGroupMeta;
  bucket: ConfigKeyBucket;
  future: readonly ConfigVersionLike[];
  current: ConfigVersionLike | null;
}> = ({ bucket, future, current }) => {
  const t = useT();
  if (future.length === 0) {
    return (
      <SectionCard padded={false}>
        <EmptyState
          title={t('config.detail.future_empty')}
          subtitle={t('config.detail.future_empty_hint')}
        />
      </SectionCard>
    );
  }

  return (
    <div className="cfg-detail__body">
      {future.map((v) => (
        <SectionCard
          key={v.config_version_id}
          title={
            <span>
              v{v.version_no} · {t('config.detail.scheduled_for')}{' '}
              <TimeCell value={v.effective_from} />
            </span>
          }
          hint={v.description ?? t('config.detail.no_description')}
        >
          <VersionMetadataPanel version={v} />
          <div className="cfg-detail__divider" />
          <ConfigValueRenderer
            group={bucket.group}
            configKey={bucket.key}
            value={v.config_value}
          />
          {current && (
            <>
              <div className="cfg-detail__divider" />
              <div className="cfg-detail__section-label">
                {t('config.detail.diff_vs_current')}
              </div>
              <ConfigDiffViewer
                bucket={bucket}
                defaultLeft={current}
                defaultRight={v}
                readonly
                highRisk={false}
                compact
              />
            </>
          )}
        </SectionCard>
      ))}
    </div>
  );
};

const RawTab: FC<{ version: ConfigVersionLike | null }> = ({ version }) => {
  const t = useT();
  if (!version) {
    return (
      <SectionCard padded={false}>
        <EmptyState title={t('config.detail.no_active')} />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={t('config.tab.raw')}
      hint={t('config.detail.raw_hint')}
    >
      <JsonViewer value={version.config_value} maxHeight={480} />
    </SectionCard>
  );
};

/* --------------------------------------------------------------------- */
/*  Shared metadata panel                                                */
/* --------------------------------------------------------------------- */

export const VersionMetadataPanel: FC<{ version: ConfigVersionLike }> = ({
  version,
}) => {
  const t = useT();

  const items: KvItem[] = [
    {
      label: t('config.detail.field.version'),
      value: (
        <span className="px-tabular">v{version.version_no}</span>
      ) as ReactNode,
    },
    {
      label: t('config.detail.field.status'),
      value: <StatusBadge value={version.status} />,
    },
    {
      label: t('config.detail.field.effective_from'),
      value: <TimeCell value={version.effective_from} />,
    },
    {
      label: t('config.detail.field.apply_scope'),
      value: (
        <span className={`cfg-scope-tag cfg-scope-tag--${version.apply_scope}`}>
          {t(`config.scope.${version.apply_scope}`, version.apply_scope)}
        </span>
      ),
    },
    {
      label: t('config.detail.field.created_by'),
      value: version.created_by ?? '—',
    },
    {
      label: t('config.detail.field.created_at'),
      value: version.created_at ? <TimeCell value={version.created_at} /> : '—',
    },
    {
      label: t('config.detail.field.description'),
      value: version.description ? (
        <span>{version.description}</span>
      ) : (
        <span className="px-text-tertiary">—</span>
      ),
    },
  ];

  return <KeyValuePanel items={items} columns={2} />;
};
