/**
 * Typed token accessors for TS consumers (charts, inline JSX, adapters).
 *
 * These pull from the live CSS variables so switching theme still works
 * at runtime. If called outside a browser (SSR / tests) they fall back
 * to the dark values so nothing crashes.
 *
 * Charts must read from here — NEVER hard-code hex values inside an
 * ECharts option.
 */
const DARK_FALLBACKS: Record<string, string> = {
  '--px-bg-app': '#0a0d14',
  '--px-bg-surface': '#10141e',
  '--px-bg-surface-raised': '#161b27',
  '--px-border': 'rgba(255,255,255,0.1)',
  '--px-border-subtle': 'rgba(255,255,255,0.06)',
  '--px-border-strong': 'rgba(255,255,255,0.16)',
  '--px-text-primary': '#e6ebf5',
  '--px-text-secondary': '#a8b0c2',
  '--px-text-tertiary': '#6b7386',
  '--px-text-muted': '#4b5163',
  '--px-brand': '#5b5bff',
  '--px-chart-1': '#5b5bff',
  '--px-chart-2': '#38bdf8',
  '--px-chart-3': '#10b981',
  '--px-chart-4': '#f59e0b',
  '--px-chart-5': '#f43f5e',
  '--px-chart-6': '#a855f7',
  '--px-chart-7': '#22d3ee',
  '--px-chart-8': '#84cc16',
  '--px-chart-9': '#ec4899',
  '--px-chart-10': '#fb923c',
  '--px-chart-grid': 'rgba(255,255,255,0.06)',
  '--px-chart-axis': 'rgba(255,255,255,0.5)',
  '--px-chart-axis-label': '#6b7386',
  '--px-status-ok': '#10b981',
  '--px-status-warn': '#f59e0b',
  '--px-status-err': '#f43f5e',
  '--px-status-info': '#38bdf8',
};

export function cssVar(name: string): string {
  if (typeof window === 'undefined' || !window.document) {
    return DARK_FALLBACKS[name] ?? '';
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || DARK_FALLBACKS[name] || '';
}

export const chartPalette = (): readonly string[] => [
  cssVar('--px-chart-1'),
  cssVar('--px-chart-2'),
  cssVar('--px-chart-3'),
  cssVar('--px-chart-4'),
  cssVar('--px-chart-5'),
  cssVar('--px-chart-6'),
  cssVar('--px-chart-7'),
  cssVar('--px-chart-8'),
  cssVar('--px-chart-9'),
  cssVar('--px-chart-10'),
];

export const tokens = {
  bg: {
    app: () => cssVar('--px-bg-app'),
    surface: () => cssVar('--px-bg-surface'),
    surfaceRaised: () => cssVar('--px-bg-surface-raised'),
  },
  border: {
    subtle: () => cssVar('--px-border-subtle'),
    base: () => cssVar('--px-border'),
    strong: () => cssVar('--px-border-strong'),
  },
  text: {
    primary: () => cssVar('--px-text-primary'),
    secondary: () => cssVar('--px-text-secondary'),
    tertiary: () => cssVar('--px-text-tertiary'),
    muted: () => cssVar('--px-text-muted'),
  },
  brand: () => cssVar('--px-brand'),
  chart: {
    palette: chartPalette,
    grid: () => cssVar('--px-chart-grid'),
    axis: () => cssVar('--px-chart-axis'),
    axisLabel: () => cssVar('--px-chart-axis-label'),
  },
  status: {
    ok: () => cssVar('--px-status-ok'),
    warn: () => cssVar('--px-status-warn'),
    err: () => cssVar('--px-status-err'),
    info: () => cssVar('--px-status-info'),
  },
};
