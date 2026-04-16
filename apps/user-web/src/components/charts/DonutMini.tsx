/**
 * DonutMini — dependency-free donut chart for user-web.
 *
 * Used for the Rewards claimable breakdown (direct / team / equal)
 * and other 2-5 segment displays. Renders as a ring of arcs with a
 * center label slot.
 *
 * Segments use Tailwind's brand palette + accent colors so the output
 * re-themes automatically on dark/light toggle.
 */
import { useId, useMemo } from 'react';
import type { FC, ReactNode } from 'react';

export interface DonutSegment {
  readonly key: string;
  readonly label: ReactNode;
  readonly value: number;
  /** Tailwind class name such as `fill-brand-500` or `fill-emerald-500`. */
  readonly tone?:
    | 'brand'
    | 'brand-light'
    | 'emerald'
    | 'amber'
    | 'rose'
    | 'violet'
    | 'sky';
}

interface DonutMiniProps {
  readonly segments: readonly DonutSegment[];
  readonly size?: number;
  readonly thickness?: number;
  readonly centerLabel?: ReactNode;
  readonly centerValue?: ReactNode;
  readonly showLegend?: boolean;
  readonly className?: string;
}

const TONE_FILL: Record<NonNullable<DonutSegment['tone']>, string> = {
  brand: 'fill-brand-600',
  'brand-light': 'fill-brand-400',
  emerald: 'fill-emerald-500',
  amber: 'fill-amber-500',
  rose: 'fill-rose-500',
  violet: 'fill-violet-500',
  sky: 'fill-sky-500',
};

const DEFAULT_TONES: readonly NonNullable<DonutSegment['tone']>[] = [
  'brand',
  'emerald',
  'amber',
  'violet',
  'sky',
  'rose',
  'brand-light',
];

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export const DonutMini: FC<DonutMiniProps> = ({
  segments,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
  showLegend = true,
  className = '',
}) => {
  const id = useId().replace(/[:]/g, '-');
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;

  const total = useMemo(() => segments.reduce((acc, s) => acc + s.value, 0), [segments]);

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let cursor = 0;
    return segments
      .filter((s) => s.value > 0)
      .map((s, i) => {
        const startDeg = (cursor / total) * 360;
        cursor += s.value;
        const endDegRaw = (cursor / total) * 360;
        // Leave a small gap between arcs (~1 degree)
        const endDeg = Math.max(startDeg + 0.5, endDegRaw - 0.6);
        return {
          key: s.key,
          tone: s.tone ?? DEFAULT_TONES[i % DEFAULT_TONES.length] ?? 'brand',
          path: describeArc(cx, cy, r, startDeg, endDeg),
          label: s.label,
          value: s.value,
          pct: (s.value / total) * 100,
        };
      });
  }, [segments, total, cx, cy, r]);

  const hasData = total > 0 && arcs.length > 0;

  return (
    <div
      className={['flex items-start gap-4', className].filter(Boolean).join(' ')}
    >
      <div className="flex-shrink-0 relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-hidden
        >
          <defs>
            <clipPath id={`donut-clip-${id}`}>
              <rect width={size} height={size} />
            </clipPath>
          </defs>
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          {/* Arcs */}
          {hasData &&
            arcs.map((a) => (
              <path
                key={a.key}
                d={a.path}
                fill="none"
                stroke="currentColor"
                strokeWidth={thickness}
                strokeLinecap="butt"
                className={TONE_FILL[a.tone].replace('fill-', 'stroke-')}
              />
            ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {centerValue && (
            <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {centerValue}
            </div>
          )}
          {centerLabel && (
            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-0.5">
              {centerLabel}
            </div>
          )}
        </div>
      </div>

      {showLegend && (
        <ul className="flex-1 min-w-0 space-y-2 text-xs">
          {hasData
            ? arcs.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={[
                        'inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0',
                        TONE_FILL[a.tone].replace('fill-', 'bg-'),
                      ].join(' ')}
                    />
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {a.label}
                    </span>
                  </span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                    {a.pct.toFixed(1)}%
                  </span>
                </li>
              ))
            : (
                <li className="text-slate-400 dark:text-slate-600 italic">—</li>
              )}
        </ul>
      )}
    </div>
  );
};
