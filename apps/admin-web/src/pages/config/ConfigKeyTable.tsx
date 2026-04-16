/**
 * ConfigKeyTable — list of config keys inside the selected group.
 *
 * One row per key (not per version). Each row summarises the current
 * version and calls out whether a future version is scheduled.
 * Clicking a row selects it and the ConfigDetailPanel expands below.
 *
 * Columns:
 *   - key (key id + Chinese label)
 *   - version_no (current)
 *   - effective_from
 *   - apply_scope
 *   - status (current version status)
 *   - future indicator
 *   - per-key risk chip
 */
import { Clock } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import {
  DataTable,
  StatusBadge,
  TimeCell,
} from '../../components/shared';
import { useT } from '../../lib/i18n';

import { getKeyMeta, type ConfigGroupMeta } from './configTaxonomy';
import { RiskChip } from './ConfigGroupNav';
import type { ConfigKeyBucket } from './derive';

interface ConfigKeyTableProps {
  readonly groupMeta: ConfigGroupMeta;
  readonly buckets: readonly ConfigKeyBucket[];
  readonly selectedKey: string | null;
  readonly onSelectKey: (key: string) => void;
}

export const ConfigKeyTable: FC<ConfigKeyTableProps> = ({
  groupMeta,
  buckets,
  selectedKey,
  onSelectKey,
}) => {
  const t = useT();

  return (
    <DataTable<ConfigKeyBucket>
      rowKey={(r) => `${r.group}:${r.key}`}
      dataSource={buckets as ConfigKeyBucket[]}
      onRow={(record) => ({
        onClick: () => onSelectKey(record.key),
        style: { cursor: 'pointer' },
      })}
      rowClassName={(record) =>
        record.key === selectedKey ? 'cfg-key-row cfg-key-row--selected' : 'cfg-key-row'
      }
      columns={[
        {
          title: t('config.col.key'),
          dataIndex: 'key',
          render: (_v: unknown, record: ConfigKeyBucket) => (
            <KeyCell bucket={record} />
          ),
        },
        {
          title: t('config.col.version'),
          dataIndex: 'version',
          align: 'right',
          width: 96,
          render: (_v: unknown, record: ConfigKeyBucket) => (
            <span className="px-tabular cfg-version-label">
              {record.current ? `v${record.current.version_no}` : '—'}
            </span>
          ),
        },
        {
          title: t('config.col.effective_from'),
          dataIndex: 'effective',
          width: 180,
          render: (_v: unknown, record: ConfigKeyBucket) =>
            record.current ? (
              <TimeCell value={record.current.effective_from} />
            ) : (
              <span className="px-text-tertiary">—</span>
            ),
        },
        {
          title: t('config.col.apply_scope'),
          dataIndex: 'scope',
          width: 160,
          render: (_v: unknown, record: ConfigKeyBucket) =>
            record.current ? (
              <ScopeTag scope={record.current.apply_scope} />
            ) : (
              <span className="px-text-tertiary">—</span>
            ),
        },
        {
          title: t('config.col.status'),
          dataIndex: 'status',
          width: 96,
          render: (_v: unknown, record: ConfigKeyBucket) => (
            <StatusBadge value={record.current?.status ?? 'draft'} />
          ),
        },
        {
          title: t('config.col.future'),
          dataIndex: 'future',
          width: 120,
          render: (_v: unknown, record: ConfigKeyBucket) =>
            record.future.length > 0 ? (
              <FutureBadge count={record.future.length} />
            ) : (
              <span className="px-text-tertiary cfg-inline-muted">—</span>
            ),
        },
        {
          title: t('config.col.risk'),
          dataIndex: 'risk',
          width: 96,
          render: (_v: unknown, record: ConfigKeyBucket) => {
            const meta = getKeyMeta(record.group, record.key);
            const level = meta?.riskOverride ?? groupMeta.risk;
            return <RiskChip level={level} size="sm" />;
          },
        },
      ]}
    />
  );
};

/* --------------------------------------------------------------------- */
/*  Sub-cells                                                            */
/* --------------------------------------------------------------------- */

const KeyCell: FC<{ bucket: ConfigKeyBucket }> = ({ bucket }) => {
  const meta = getKeyMeta(bucket.group, bucket.key);
  return (
    <div className="cfg-key-cell">
      <div className="cfg-key-cell__label">{meta?.labelZh ?? bucket.key}</div>
      <code className="cfg-key-cell__code">{bucket.key}</code>
    </div>
  );
};

const ScopeTag: FC<{ scope: string }> = ({ scope }) => {
  const t = useT();
  const labelKey = `config.scope.${scope}`;
  const label = t(labelKey, scope);
  return <span className={`cfg-scope-tag cfg-scope-tag--${scope}`}>{label}</span>;
};

const FutureBadge: FC<{ count: number }> = ({ count }) => {
  const t = useT();
  const suffix =
    count > 1
      ? ` × ${count}`
      : '';
  const label: ReactNode = t('config.col.future.scheduled');
  return (
    <span className="cfg-future-badge">
      <Clock size={11} />
      {label}
      {suffix}
    </span>
  );
};
