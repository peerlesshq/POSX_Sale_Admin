/**
 * ConfigDiffViewer — two-version structured diff.
 *
 * Shows a user-switchable left/right pair of versions and the
 * field-level diff between them. High-risk keys render every
 * `changed` / `added` / `removed` row in stronger colour to draw
 * the operator's eye.
 *
 * Modes:
 *   - Full (default): user can pick either side from dropdowns
 *   - Readonly: picker is hidden, pair is locked from props
 *   - Compact: slimmer styling used by the Future tab's inline diff
 */
import { Select } from 'antd';
import { ArrowRight, Minus, Plus, TrendingUp } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { EmptyState, TimeCell } from '../../components/shared';
import { useT } from '../../lib/i18n';

import type { ConfigKeyBucket, ConfigVersionLike } from './derive';
import {
  diffConfigValue,
  keepChanged,
  summarizeDiff,
  type ConfigDiffEntry,
} from './diff';

interface ConfigDiffViewerProps {
  readonly bucket: ConfigKeyBucket;
  readonly defaultLeft: ConfigVersionLike | null;
  readonly defaultRight: ConfigVersionLike | null;
  readonly readonly?: boolean;
  readonly compact?: boolean;
  readonly highRisk?: boolean;
}

export const ConfigDiffViewer: FC<ConfigDiffViewerProps> = ({
  bucket,
  defaultLeft,
  defaultRight,
  readonly = false,
  compact = false,
  highRisk = false,
}) => {
  const t = useT();

  const allVersions = useMemo<readonly ConfigVersionLike[]>(() => {
    const list: ConfigVersionLike[] = [];
    for (const v of bucket.future) list.push(v);
    if (bucket.current) list.push(bucket.current);
    for (const v of bucket.history) list.push(v);
    return list;
  }, [bucket]);

  const [leftId, setLeftId] = useState<string | null>(
    defaultLeft?.config_version_id ?? null,
  );
  const [rightId, setRightId] = useState<string | null>(
    defaultRight?.config_version_id ?? null,
  );

  const left = useMemo(
    () => allVersions.find((v) => v.config_version_id === leftId) ?? null,
    [allVersions, leftId],
  );
  const right = useMemo(
    () => allVersions.find((v) => v.config_version_id === rightId) ?? null,
    [allVersions, rightId],
  );

  const entries = useMemo(() => {
    if (!left || !right) return [] as readonly ConfigDiffEntry[];
    return keepChanged(diffConfigValue(left.config_value, right.config_value));
  }, [left, right]);

  const summary = useMemo(() => summarizeDiff(entries), [entries]);

  if (allVersions.length < 2) {
    return (
      <div className="cfg-diff cfg-diff--empty">
        <EmptyState
          title={t('config.diff.empty_title')}
          subtitle={t('config.diff.empty_hint')}
        />
      </div>
    );
  }

  return (
    <div
      className={`cfg-diff ${compact ? 'cfg-diff--compact' : ''} ${highRisk ? 'cfg-diff--high-risk' : ''}`.trim()}
    >
      {!readonly && (
        <div className="cfg-diff__picker">
          <VersionPicker
            label={t('config.diff.left')}
            value={leftId}
            options={allVersions}
            onChange={setLeftId}
          />
          <div className="cfg-diff__picker-arrow">
            <ArrowRight size={14} />
          </div>
          <VersionPicker
            label={t('config.diff.right')}
            value={rightId}
            options={allVersions}
            onChange={setRightId}
          />
        </div>
      )}

      {left && right && (
        <>
          <div className="cfg-diff__summary">
            <SummaryChip
              label={t('config.diff.changed')}
              value={summary.changed}
              kind="changed"
            />
            <SummaryChip
              label={t('config.diff.added')}
              value={summary.added}
              kind="added"
            />
            <SummaryChip
              label={t('config.diff.removed')}
              value={summary.removed}
              kind="removed"
            />
            <div className="cfg-diff__summary-ver">
              <span>
                v{left.version_no} → v{right.version_no}
              </span>
            </div>
          </div>

          {summary.hasChanges ? (
            <div className="cfg-diff__table">
              <div className="cfg-diff__row cfg-diff__row--head">
                <span>{t('config.diff.path')}</span>
                <span>{t('config.diff.old')}</span>
                <span />
                <span>{t('config.diff.new')}</span>
              </div>
              {entries.map((entry, idx) => (
                <DiffRow key={`${entry.path}-${idx}`} entry={entry} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('config.diff.no_changes')}
              subtitle={t('config.diff.no_changes_hint')}
            />
          )}
        </>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Sub components                                                       */
/* --------------------------------------------------------------------- */

const VersionPicker: FC<{
  label: string;
  value: string | null;
  options: readonly ConfigVersionLike[];
  onChange: (id: string) => void;
}> = ({ label, value, options, onChange }) => {
  const t = useT();
  return (
    <div className="cfg-diff__picker-field">
      <label className="cfg-diff__picker-label">{label}</label>
      <Select<string>
        className="cfg-diff__picker-select"
        value={value ?? undefined}
        onChange={(next) => onChange(next)}
        options={options.map((v) => ({
          value: v.config_version_id,
          label: (
            <span className="cfg-diff__opt">
              <span className="cfg-diff__opt-ver">v{v.version_no}</span>
              <span className="cfg-diff__opt-status">
                · {t(`status.${v.status}`, v.status)}
              </span>
              <span className="cfg-diff__opt-time">
                · <TimeCell value={v.effective_from} />
              </span>
            </span>
          ),
        }))}
      />
    </div>
  );
};

const SummaryChip: FC<{
  label: string;
  value: number;
  kind: 'changed' | 'added' | 'removed';
}> = ({ label, value, kind }) => {
  const icon =
    kind === 'changed' ? (
      <TrendingUp size={12} />
    ) : kind === 'added' ? (
      <Plus size={12} />
    ) : (
      <Minus size={12} />
    );
  return (
    <span className={`cfg-diff__chip cfg-diff__chip--${kind}`}>
      {icon}
      <span className="cfg-diff__chip-label">{label}</span>
      <span className="cfg-diff__chip-value px-tabular">{value}</span>
    </span>
  );
};

const DiffRow: FC<{ entry: ConfigDiffEntry }> = ({ entry }) => {
  const sign =
    entry.kind === 'added' ? '+' : entry.kind === 'removed' ? '−' : '↔';
  return (
    <div className={`cfg-diff__row cfg-diff__row--${entry.kind}`}>
      <span className="cfg-diff__path">
        <code>{entry.path || '(root)'}</code>
      </span>
      <span className="cfg-diff__old">
        <ValueCell value={entry.oldValue} />
      </span>
      <span className="cfg-diff__sign">{sign}</span>
      <span className="cfg-diff__new">
        <ValueCell value={entry.newValue} />
      </span>
    </div>
  );
};

const ValueCell: FC<{ value: unknown }> = ({ value }) => {
  if (value === undefined) {
    return <span className="cfg-diff__muted">—</span>;
  }
  if (value === null) {
    return <span className="cfg-diff__muted">null</span>;
  }
  if (typeof value === 'object') {
    let content: ReactNode;
    try {
      content = JSON.stringify(value);
    } catch {
      content = '[object]';
    }
    return <code className="cfg-diff__code">{content}</code>;
  }
  return <code className="cfg-diff__code">{String(value)}</code>;
};
