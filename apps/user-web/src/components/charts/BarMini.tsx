/**
 * BarMini — dependency-free vertical bar chart for user-web.
 *
 * Used for team daily performance, invite-over-time, or any discrete
 * short series. Labels sit below each bar.
 */
import { useMemo } from 'react';
import type { FC } from 'react';

interface BarMiniProps {
  readonly values: readonly number[];
  readonly labels?: readonly string[];
  readonly height?: number;
  readonly tone?: 'brand' | 'success' | 'warning' | 'danger';
  readonly className?: string;
}

const TONE_FILL: Record<NonNullable<BarMiniProps['tone']>, string> = {
  brand: 'fill-brand-500 dark:fill-brand-500',
  success: 'fill-emerald-500',
  warning: 'fill-amber-500',
  danger: 'fill-rose-500',
};

export const BarMini: FC<BarMiniProps> = ({
  values,
  labels,
  height = 140,
  tone = 'brand',
  className = '',
}) => {
  const width = 320;
  const PAD_X = 8;
  const PAD_Y_TOP = 10;
  const PAD_Y_BOTTOM = labels?.length ? 18 : 6;

  const { bars, hasData } = useMemo(() => {
    if (values.length === 0) return { bars: [], hasData: false };
    const max = Math.max(...values, 0.0001);
    const n = values.length;
    const trackWidth = width - PAD_X * 2;
    const gap = 4;
    const barWidth = Math.max(4, (trackWidth - gap * (n - 1)) / n);
    const plotH = height - PAD_Y_TOP - PAD_Y_BOTTOM;
    const rows = values.map((v, i) => {
      const h = (v / max) * plotH;
      const x = PAD_X + i * (barWidth + gap);
      const y = PAD_Y_TOP + plotH - h;
      return { x, y, width: barWidth, height: h, value: v, label: labels?.[i] ?? '' };
    });
    return { bars: rows, hasData: true };
  }, [values, labels, height]);

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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {bars.map((b, i) => (
        <g key={b.label || i}>
          <rect
            x={b.x}
            y={b.y}
            width={b.width}
            height={Math.max(1, b.height)}
            rx={2}
            className={TONE_FILL[tone]}
            opacity={0.88}
          />
          {b.label && (
            <text
              x={b.x + b.width / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400"
              fontSize={9}
              fontFamily="system-ui, sans-serif"
            >
              {b.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};
