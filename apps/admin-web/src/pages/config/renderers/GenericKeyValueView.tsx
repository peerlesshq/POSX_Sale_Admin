/**
 * GenericKeyValueView — fallback renderer.
 *
 * Used for config keys that don't have a dedicated structured
 * renderer. It's still significantly better than dumping raw JSON:
 *
 *   - Walks the top level of the value and produces a labelled
 *     `KeyValuePanel` entry for each field.
 *   - Looks up field labels from the taxonomy `schemaFields`
 *     metadata so primitive keys like `effective_level_start` appear
 *     as "起始层（从 1 开始）".
 *   - Pretty-prints nested objects/arrays inline.
 *
 * The Raw JSON dump stays behind its own tab; this view is meant to
 * be the primary experience.
 */
import type { FC, ReactNode } from 'react';

import { KeyValuePanel, type KvItem } from '../../../components/shared';

import { getKeyMeta } from '../configTaxonomy';

interface GenericProps {
  value: Record<string, unknown>;
  group: string;
  configKey: string;
}

export const GenericKeyValueView: FC<GenericProps> = ({
  value,
  group,
  configKey,
}) => {
  const meta = getKeyMeta(group, configKey);
  const schemaFields = meta?.schemaFields ?? {};

  const items: KvItem[] = Object.entries(value).map(([k, v]) => ({
    label: schemaFields[k] ? (
      <span>
        <code className="cfg-generic__code">{k}</code>
        <span className="cfg-generic__hint"> · {schemaFields[k]}</span>
      </span>
    ) : (
      <code className="cfg-generic__code">{k}</code>
    ),
    value: renderValue(v),
  }));

  return (
    <div className="cfg-render cfg-render--generic">
      <KeyValuePanel items={items} columns={2} />
    </div>
  );
};

function renderValue(v: unknown): ReactNode {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') {
    return (
      <span className={`cfg-flag cfg-flag--${v ? 'yes' : 'no'}`}>
        {String(v)}
      </span>
    );
  }
  if (typeof v === 'number' || typeof v === 'string') {
    return <span className="px-tabular">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) {
      return (
        <span className="cfg-generic__tags">
          {v.map((item, idx) => (
            <span key={idx} className="cfg-tag cfg-tag--ok">
              {String(item)}
            </span>
          ))}
        </span>
      );
    }
    return <pre className="cfg-generic__pre">{JSON.stringify(v, null, 2)}</pre>;
  }
  if (typeof v === 'object') {
    return <pre className="cfg-generic__pre">{JSON.stringify(v, null, 2)}</pre>;
  }
  return String(v);
}
