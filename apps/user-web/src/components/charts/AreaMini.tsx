/**
 * AreaMini — dependency-free area chart for user-web.
 *
 * Previously user-web had zero charts (CHT-02 in the audit). This is
 * a minimal SVG area + line primitive designed for simple display
 * series (7-day purchase history, 14-day vesting release, etc).
 *
 * Colors come from Tailwind brand / slate classes — no hardcoded hex.
 * Theme flips automatically via Tailwind's `dark:` variant.
 *
 * Intentionally NOT a chart library:
 *   - No tooltip (see AreaMini.hover if interaction is added later)
 *   - No legend
 *   - No axes with tick marks — just an optional baseline + y=0 line
 *
 * For anything more ambitious in the future, swap to recharts or
 * echarts-for-react — this primitive is deliberately scoped to
 * "trend-at-a-glance" visualisation.
 */
import { useId, useMemo } from 'react';
import type { FC } from 'react';

interface AreaMiniProps {
  readonly values: readonly number[];
  readonly labels?: readonly string[];
  readonly height?: number;
  readonly className?: string;
  readonly tone?: 'brand' | 'success' | 'warning' | 'danger';
  readonly showDots?: boolean;
  readonly showBaseline?: boolean;
}

const TONE_STROKE: Record<NonNullable<AreaMiniProps['tone']>, string> = {
  brand: 'stroke-brand-600 dark:stroke-brand-500',
  success: 'stroke-emerald-500 dark:stroke-emerald-400',
  warning: 'stroke-amber-500 dark:stroke-amber-400',
  danger: 'stroke-rose-500 dark:stroke-rose-400',
};

const TONE_FILL: Record<NonNullable<AreaMiniProps['tone']>, string> = {
  brand: 'fill-brand-500',
  success: 'fill-emerald-500',
  warning: 'fill-amber-500',
  danger: 'fill-rose-500',
};

export const AreaMini: FC<AreaMiniProps> = ({
  values,
  labels,
  height = 120,
  className = '',
  tone = 'brand',
  showDots = true,
  showBaseline = true,
}) => {
  const id = useId().replace(/[:]/g, '-');
  const width = 320; // viewBox width — SVG scales to container
  const PAD_X = 8;
  const PAD_Y = 10;

  const { pathLine, pathArea, dots, hasData } = useMemo(() => {
    if (values.length === 0) {
      return { pathLine: '', pathArea: '', dots: [], hasData: false };
    }
    const max = Math.max(...values, 0.0001);
    const n = values.length;
    const stepX = n > 1 ? (width - PAD_X * 2) / (n - 1) : 0;
    const plotH = height - PAD_Y * 2;
    const points = values.map((v, i) => ({
      x: PAD_X + i * stepX,
      y: PAD_Y + plotH - (v / max) * plotH,
      value: v,
    }));
    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');
    const area = `${line} L${points[n - 1]!.x},${PAD_Y + plotH} L${points[0]!.x},${PAD_Y + plotH} Z`;
    return {
      pathLine: line,
      pathArea: area,
      dots: points,
      hasData: true,
    };
  }, [values, height]);

  if (!hasData) {
    return (
      <div
        className={[
          'flex items-center justify-center text-xs text-slate-400 dark:text-slate-600',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ height }}
      >
        —
      </div>
    );
  }

  const baselineY = PAD_Y + (height - PAD_Y * 2);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={['overflow-visible', className].filter(Boolean).join(' ')}
      aria-hidden
    >
      <defs>
        <linearGradient id={`areaFill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            className={TONE_FILL[tone]}
            stopOpacity={0.3}
          />
          <stop
            offset="100%"
            className={TONE_FILL[tone]}
            stopOpacity={0}
          />
        </linearGradient>
      </defs>
      {showBaseline && (
        <line
          x1={PAD_X}
          y1={baselineY}
          x2={width - PAD_X}
          y2={baselineY}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      )}
      <path d={pathArea} fill={`url(#areaFill-${id})`} />
      <path
        d={pathLine}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={TONE_STROKE[tone]}
      />
      {showDots &&
        dots.map((p, i) => (
          <circle
            key={`${labels?.[i] ?? i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            className={[TONE_STROKE[tone], 'fill-white dark:fill-slate-950'].join(' ')}
            strokeWidth={1.5}
          />
        ))}
    </svg>
  );
};
