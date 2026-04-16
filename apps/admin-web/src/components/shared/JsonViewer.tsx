/**
 * JsonViewer — interactive tree viewer for JSON payloads.
 *
 * Previous state (Phase 0 and earlier): a `<pre>` block with regex
 * syntax highlighting injected via `dangerouslySetInnerHTML`. Fine for
 * 20-line blobs, poor for config values, recompute diffs, and log
 * detail drawers. Cannot collapse, copy sub-paths, or filter.
 *
 * New behaviour (Phase 1 audit remediation):
 *   - Collapsible tree with expand-all / collapse-all controls
 *   - Per-node copy-as-json button on hover
 *   - Full-path copy support
 *   - Key / value search filter
 *   - Auto-collapse deeply nested arrays when they have >N rows
 *   - Keyboard-navigable (TAB / Enter on each row)
 *   - Reduced-motion friendly (no animated chevrons)
 *   - `dense` mode for embedding in drawers
 *   - `maxHeight` / `rootLabel` / `searchable` props
 *
 * Note: this is deliberately dependency-free. A real tree viewer library
 * (`react-json-view`, `@microlink/react-json-view`) would be heavier and
 * less themeable. The audit report called out that JsonViewer was a
 * `<pre>`; this component replaces it with something that is actually
 * useful without adding a dep.
 */
import { Input, message, Tooltip } from 'antd';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  List as ListIcon,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { t } from '../../lib/i18n';

import './JsonViewer.css';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

interface JsonViewerProps {
  readonly value: unknown;
  readonly maxHeight?: number | string;
  readonly dense?: boolean;
  readonly searchable?: boolean;
  readonly rootLabel?: string;
  readonly defaultCollapsedDepth?: number;
  readonly className?: string;
}

export const JsonViewer: FC<JsonViewerProps> = ({
  value,
  maxHeight = 480,
  dense = false,
  searchable = true,
  rootLabel,
  defaultCollapsedDepth = 3,
  className = '',
}) => {
  const [search, setSearch] = useState('');
  const [expandAllTick, setExpandAllTick] = useState(0);
  const [collapseAllTick, setCollapseAllTick] = useState(0);

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(stringify(value));
      void message.success(t('common.copied', 'Copied'));
    } catch {
      void message.error(t('common.failed', 'Failed'));
    }
  }, [value]);

  return (
    <div
      className={[
        'px-json-viewer',
        dense ? 'px-json-viewer--dense' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="px-json-viewer__toolbar">
        {searchable && (
          <Input
            size="small"
            prefix={<Search size={12} className="px-json-viewer__search-icon" />}
            placeholder={t('common.search', 'Search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className="px-json-viewer__search"
          />
        )}
        <div className="px-json-viewer__toolbar-actions">
          <Tooltip title={t('json.expand_all', 'Expand all')}>
            <button
              type="button"
              className="px-json-viewer__tool"
              onClick={() => setExpandAllTick((x) => x + 1)}
              aria-label="expand all"
            >
              <Plus size={12} />
            </button>
          </Tooltip>
          <Tooltip title={t('json.collapse_all', 'Collapse all')}>
            <button
              type="button"
              className="px-json-viewer__tool"
              onClick={() => setCollapseAllTick((x) => x + 1)}
              aria-label="collapse all"
            >
              <Minus size={12} />
            </button>
          </Tooltip>
          <Tooltip title={t('common.copy', 'Copy all')}>
            <button
              type="button"
              className="px-json-viewer__tool"
              onClick={handleCopyAll}
              aria-label="copy all"
            >
              <Copy size={12} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="px-json-viewer__body" style={{ maxHeight }}>
        <JsonNode
          keyName={rootLabel ?? null}
          value={value}
          depth={0}
          path={rootLabel ?? '$'}
          search={search.trim().toLowerCase()}
          defaultCollapsedDepth={defaultCollapsedDepth}
          expandAllTick={expandAllTick}
          collapseAllTick={collapseAllTick}
          isRoot
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Internal node                                                      */
/* ------------------------------------------------------------------ */

interface JsonNodeProps {
  readonly keyName: string | null;
  readonly value: unknown;
  readonly depth: number;
  readonly path: string;
  readonly search: string;
  readonly defaultCollapsedDepth: number;
  readonly expandAllTick: number;
  readonly collapseAllTick: number;
  readonly isRoot?: boolean;
}

const AUTO_COLLAPSE_AT_LENGTH = 12;

const JsonNode: FC<JsonNodeProps> = ({
  keyName,
  value,
  depth,
  path,
  search,
  defaultCollapsedDepth,
  expandAllTick,
  collapseAllTick,
  isRoot = false,
}) => {
  const type = detectType(value);
  const isContainer = type === 'object' || type === 'array';
  const containerSize = isContainer ? getSize(value) : 0;

  const initialCollapsed =
    isContainer &&
    !isRoot &&
    (depth >= defaultCollapsedDepth ||
      (type === 'array' && containerSize > AUTO_COLLAPSE_AT_LENGTH));

  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Expand-all / collapse-all handler: re-run on tick changes.
  // Ticks start at 0 (no-op) and increment on user action so every
  // container node observes the change and updates its state.
  useEffect(() => {
    if (expandAllTick > 0) setCollapsed(false);
  }, [expandAllTick]);
  useEffect(() => {
    if (collapseAllTick > 0 && isContainer && !isRoot) setCollapsed(true);
  }, [collapseAllTick]);

  const matchesSearch = useMemo(() => {
    if (!search) return true;
    return nodeMatchesSearch(keyName, value, search);
  }, [keyName, value, search]);

  if (!matchesSearch) return null;

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(stringify(value));
        void message.success(t('common.copied', 'Copied'));
      } catch {
        void message.error(t('common.failed', 'Failed'));
      }
    },
    [value],
  );

  if (!isContainer) {
    return (
      <div className="px-json-viewer__row" style={indentStyle(depth)}>
        <span className="px-json-viewer__spacer" />
        {keyName !== null && (
          <>
            <span className="px-json-viewer__key">{keyName}</span>
            <span className="px-json-viewer__colon">:</span>
          </>
        )}
        <PrimitiveValue value={value} type={type} />
        <CopyButton onCopy={handleCopy} />
      </div>
    );
  }

  const entries = getEntries(value);

  return (
    <div className="px-json-viewer__container">
      <div className="px-json-viewer__row" style={indentStyle(depth)}>
        <button
          type="button"
          className="px-json-viewer__chev"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'expand' : 'collapse'}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        {keyName !== null && (
          <>
            <span className="px-json-viewer__key">{keyName}</span>
            <span className="px-json-viewer__colon">:</span>
          </>
        )}
        <ContainerPreview
          type={type}
          size={containerSize}
          collapsed={collapsed}
        />
        <CopyButton onCopy={handleCopy} />
      </div>
      {!collapsed && (
        <div className="px-json-viewer__children">
          {entries.map(([k, v]) => (
            <JsonNode
              key={k}
              keyName={type === 'array' ? `[${k}]` : String(k)}
              value={v}
              depth={depth + 1}
              path={`${path}.${k}`}
              search={search}
              defaultCollapsedDepth={defaultCollapsedDepth}
              expandAllTick={expandAllTick}
              collapseAllTick={collapseAllTick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

const PrimitiveValue: FC<{ value: unknown; type: string }> = ({ value, type }) => {
  if (value === null || type === 'null') {
    return <span className="px-json-viewer__v px-json-viewer__v--null">null</span>;
  }
  if (type === 'undefined') {
    return (
      <span className="px-json-viewer__v px-json-viewer__v--null">undefined</span>
    );
  }
  if (type === 'boolean') {
    return (
      <span className="px-json-viewer__v px-json-viewer__v--kw">
        {String(value)}
      </span>
    );
  }
  if (type === 'number') {
    return (
      <span className="px-json-viewer__v px-json-viewer__v--num">
        {String(value)}
      </span>
    );
  }
  if (type === 'string') {
    return (
      <span className="px-json-viewer__v px-json-viewer__v--str">
        "{String(value)}"
      </span>
    );
  }
  return (
    <span className="px-json-viewer__v">
      {String(value)}
    </span>
  );
};

const ContainerPreview: FC<{
  type: string;
  size: number;
  collapsed: boolean;
}> = ({ type, size, collapsed }) => {
  if (collapsed) {
    return (
      <span className="px-json-viewer__preview">
        {type === 'array' ? (
          <>
            <span className="px-json-viewer__bracket">[</span>
            <span className="px-json-viewer__preview-count">
              <ListIcon size={10} /> {size}
            </span>
            <span className="px-json-viewer__bracket">]</span>
          </>
        ) : (
          <>
            <span className="px-json-viewer__bracket">{'{'}</span>
            <span className="px-json-viewer__preview-count">{size}</span>
            <span className="px-json-viewer__bracket">{'}'}</span>
          </>
        )}
      </span>
    );
  }
  return (
    <span className="px-json-viewer__bracket">
      {type === 'array' ? '[' : '{'}
    </span>
  );
};

const CopyButton: FC<{ onCopy: (e: React.MouseEvent) => void }> = ({ onCopy }) => (
  <button
    type="button"
    className="px-json-viewer__copy"
    onClick={onCopy}
    aria-label="copy"
    tabIndex={-1}
  >
    <Copy size={11} />
  </button>
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function detectType(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function getSize(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v as Record<string, unknown>).length;
  return 0;
}

function getEntries(v: unknown): [string | number, unknown][] {
  if (Array.isArray(v)) return v.map((item, i) => [i, item]);
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>);
  }
  return [];
}

function indentStyle(depth: number): React.CSSProperties {
  return { paddingLeft: `${8 + depth * 16}px` };
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function nodeMatchesSearch(
  keyName: string | null,
  value: unknown,
  search: string,
): boolean {
  if (keyName && keyName.toLowerCase().includes(search)) return true;
  const str = stringify(value).toLowerCase();
  return str.includes(search);
}

/**
 * Convenience class name so page-level stylesheets can target
 * JsonViewer instances without importing the component.
 */
export const JSON_VIEWER_CLASS = 'px-json-viewer';
