/**
 * BurnPolicyView — renderer for `burn_rules.burn_policy`.
 *
 * Shows the disable threshold, cap basis, and applies/excludes sets
 * as readable tag groups instead of raw JSON arrays.
 */
import { Flame } from 'lucide-react';
import type { FC } from 'react';

import { formatCompactUsdt } from '../../../lib/format';
import { useT } from '../../../lib/i18n';

interface BurnPolicyValue {
  readonly burn_disable_threshold?: string;
  readonly cap_basis?: string;
  readonly applies_to?: readonly string[];
  readonly excludes?: readonly string[];
}

export const BurnPolicyView: FC<{ value: Record<string, unknown> }> = ({ value }) => {
  const t = useT();
  const v = value as BurnPolicyValue;

  return (
    <div className="cfg-render cfg-render--burn">
      <div className="cfg-render__legend">
        <Flame size={14} />
        <span>{t('config.render.burn.legend')}</span>
      </div>

      <div className="cfg-metric-grid">
        <MetricBlock
          label={t('config.render.burn.threshold')}
          value={v.burn_disable_threshold ? formatCompactUsdt(v.burn_disable_threshold) : '—'}
          hint={t('config.render.burn.threshold_hint')}
        />
        <MetricBlock
          label={t('config.render.burn.cap_basis')}
          value={v.cap_basis ?? '—'}
          hint={t('config.render.burn.cap_basis_hint')}
        />
      </div>

      <div className="cfg-tag-group">
        <div className="cfg-tag-group__label">{t('config.render.burn.applies_to')}</div>
        <div className="cfg-tag-group__tags">
          {(v.applies_to ?? []).map((name) => (
            <span key={name} className="cfg-tag cfg-tag--ok">
              {name}
            </span>
          ))}
          {(!v.applies_to || v.applies_to.length === 0) && (
            <span className="cfg-tag-group__empty">—</span>
          )}
        </div>
      </div>

      <div className="cfg-tag-group">
        <div className="cfg-tag-group__label">{t('config.render.burn.excludes')}</div>
        <div className="cfg-tag-group__tags">
          {(v.excludes ?? []).map((name) => (
            <span key={name} className="cfg-tag cfg-tag--muted">
              {name}
            </span>
          ))}
          {(!v.excludes || v.excludes.length === 0) && (
            <span className="cfg-tag-group__empty">—</span>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricBlock: FC<{ label: string; value: string; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="cfg-metric-block">
    <div className="cfg-metric-block__label">{label}</div>
    <div className="cfg-metric-block__value px-tabular">{value}</div>
    {hint && <div className="cfg-metric-block__hint">{hint}</div>}
  </div>
);
