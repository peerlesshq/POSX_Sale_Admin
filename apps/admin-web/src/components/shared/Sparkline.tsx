/**
 * Sparkline — a dependency-free inline trend visual.
 *
 * SVG-based so it renders instantly without hitting ECharts. Designed
 * for the trailing slot in `KpiDeltaCard`: ~120×36 visual that gives
 * the operator a glance at the period's shape.
 *
 * Renders a smooth line path with an optional filled area. Endpoints
 * are decorated with a dot so the "latest" value is easy to spot.
 */
import type { FC } from 'react';

interface SparklineProps {
  readonly values: readonly number[];
  readonly width?: number;
  readonly height?: number;
  readonly color?: string;
  readonly fill?: boolean;
  readonly strokeWidth?: number;
}

export const Sparkline: FC<SparklineProps> = ({
  values,
  width = 120,
  height = 36,
  color = 'var(--px-brand)',
  fill = true,
  strokeWidth = 1.5,
}) => {
  if (!values || values.length === 0) {
    return (
      <svg width={width} height={height} className="px-sparkline px-sparkline--empty">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--px-border-subtle)"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;

  // Map every value to (x, y) in SVG space with a 2px vertical inset.
  const pad = 2;
  const innerH = height - pad * 2;
  const xs = values.map((_, i) => (n === 1 ? width / 2 : (i / (n - 1)) * width));
  const ys = values.map((v) => pad + innerH - ((v - min) / span) * innerH);

  // Smooth path via catmull-rom → bezier conversion. Keeping it inline
  // so we don't pull in d3.
  const path = buildSmoothPath(xs, ys);

  // Area path closes the smooth line back down to baseline.
  const areaPath = `${path} L ${xs[n - 1]} ${height} L ${xs[0]} ${height} Z`;

  const lastX = xs[n - 1]!;
  const lastY = ys[n - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="px-sparkline"
    >
      {fill && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.14}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
};

function buildSmoothPath(xs: readonly number[], ys: readonly number[]): string {
  if (xs.length === 0) return '';
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const x0 = i > 0 ? xs[i - 1]! : xs[i]!;
    const y0 = i > 0 ? ys[i - 1]! : ys[i]!;
    const x1 = xs[i]!;
    const y1 = ys[i]!;
    const x2 = xs[i + 1]!;
    const y2 = ys[i + 1]!;
    const x3 = i + 2 < xs.length ? xs[i + 2]! : x2;
    const y3 = i + 2 < xs.length ? ys[i + 2]! : y2;
    // Catmull-rom → cubic bezier control points (tension = 0.5)
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }
  return d;
}
