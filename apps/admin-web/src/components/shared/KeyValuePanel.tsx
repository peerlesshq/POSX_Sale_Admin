/**
 * KeyValuePanel — vertical label/value list for detail panels.
 *
 * Used by UserDetailPage, settlement job detail drawer, config version
 * detail, etc. The list adapts to width: single column on narrow, two
 * columns on wider surfaces.
 */
import type { ReactNode } from 'react';

import './KeyValuePanel.css';

export interface KvItem {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly copyable?: boolean;
}

interface KeyValuePanelProps {
  items: readonly KvItem[];
  columns?: 1 | 2;
  compact?: boolean;
}

export function KeyValuePanel({ items, columns = 2, compact = false }: KeyValuePanelProps) {
  return (
    <dl
      className={`px-kv px-kv--cols-${columns} ${compact ? 'px-kv--compact' : ''}`.trim()}
    >
      {items.map((item, idx) => (
        <div key={idx} className="px-kv__item">
          <dt className="px-kv__label">{item.label}</dt>
          <dd className="px-kv__value">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
