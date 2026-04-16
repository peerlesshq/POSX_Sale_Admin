/**
 * KpiDeltaCard — analytics KPI with delta + sparkline.
 *
 * Composes the existing `KpiStatCard` primitive with two extras:
 *
 *   - A delta row driven by current / previous period values. Direction
 *     colour is derived through `computeDelta()` so "up is good" / "down
 *     is good" can be inverted (e.g. burn total should be green when it
 *     falls, not when it rises).
 *
 *   - A trailing `Sparkline` showing the shape of the current window.
 *
 * Intended as the building block for all analytics KPI strips in the
 * Reports page and Rewards sub-pages.
 */
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { computeDelta } from '../../lib/analytics';
import { useT } from '../../lib/i18n';

import { Sparkline } from './Sparkline';

import './KpiDeltaCard.css';

interface KpiDeltaCardProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** Numeric version of `value` used to compute the delta. */
  readonly current: number;
  /** Previous-period value, same unit as `current`. */
  readonly previous: number;
  /** Optional trend sparkline values for the current window. */
  readonly trend?: readonly number[];
  /** Unit label shown beside the value (e.g. `USDT`, `users`). */
  readonly unit?: ReactNode;
  /** `false` inverts the colour scale — falling is good. */
  readonly higherIsBetter?: boolean;
  /** Accent colour used by the delta bar and sparkline. */
  readonly accent?: string;
  /** Tone affects background colour intensity. */
  readonly tone?: 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
  readonly loading?: boolean;
}

const TONE_ACCENTS: Record<NonNullable<KpiDeltaCardProps['tone']>, string> = {
  neutral: 'var(--px-text-tertiary)',
  brand: 'var(--px-brand)',
  success: 'var(--px-status-ok)',
  warn: 'var(--px-status-warn)',
  danger: 'var(--px-status-err)',
};

export const KpiDeltaCard: FC<KpiDeltaCardProps> = ({
  label,
  value,
  current,
  previous,
  trend,
  unit,
  higherIsBetter = true,
  accent,
  tone = 'brand',
  loading = false,
}) => {
  const t = useT();
  const delta = computeDelta(current, previous);

  const effectiveAccent = accent ?? TONE_ACCENTS[tone];

  // Sentiment: "good" direction based on higherIsBetter.
  const sentiment: 'good' | 'bad' | 'flat' = (() => {
    if (delta.direction === 'flat') return 'flat';
    const up = delta.direction === 'up';
    const good = higherIsBetter ? up : !up;
    return good ? 'good' : 'bad';
  })();

  return (
    <div className={`px-kpi-delta px-kpi-delta--${tone}`}>
      <div className="px-kpi-delta__head">
        <span className="px-kpi-delta__label">{label}</span>
        {trend && trend.length > 1 && (
          <Sparkline values={trend} color={effectiveAccent} width={96} height={30} />
        )}
      </div>
      <div className="px-kpi-delta__value">
        {loading ? (
          <span className="px-kpi-delta__loading">—</span>
        ) : (
          <>
            <span className="px-tabular">{value}</span>
            {unit && <span className="px-kpi-delta__unit">{unit}</span>}
          </>
        )}
      </div>
      <div className={`px-kpi-delta__delta px-kpi-delta__delta--${sentiment}`}>
        {delta.direction === 'up' && <ArrowUp size={11} />}
        {delta.direction === 'down' && <ArrowDown size={11} />}
        {delta.direction === 'flat' && <Minus size={11} />}
        <span className="px-tabular">
          {delta.pct === null
            ? '—'
            : `${delta.pct > 0 ? '+' : ''}${(delta.pct * 100).toFixed(1)}%`}
        </span>
        <span className="px-kpi-delta__period">{t('analytics.vs_previous')}</span>
      </div>
      <span className="px-kpi-delta__accent" style={{ background: effectiveAccent }} />
    </div>
  );
};
