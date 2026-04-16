/**
 * BaseChart — thin wrapper around `echarts-for-react` that:
 *   - Registers our two themes once (idempotent).
 *   - Picks the active theme name from the admin theme context so
 *     charts re-theme reactively when the user toggles light/dark.
 *   - Forwards the option + sensible defaults.
 *   - Handles empty / loading states without every page repeating it.
 *   - Exposes a consistent `height` API.
 *
 * Page-level charts build an option object and hand it to this
 * component. They MUST NOT import `echarts-for-react` directly — that
 * keeps all chart styling funneled through our theme.
 */
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { CSSProperties } from 'react';

import { echartsThemeName, registerAdminEchartsTheme, useAdminTheme } from '../../theme';

import { EmptyState, LoadingState } from '../shared/states';

// Ensure both themes are registered even if main.tsx is bypassed (tests).
registerAdminEchartsTheme();

interface BaseChartProps {
  option: EChartsOption;
  height?: number | string;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  style?: CSSProperties;
  onEvents?: Record<string, (params: unknown) => void>;
}

export function BaseChart({
  option,
  height = 280,
  loading = false,
  empty = false,
  emptyTitle,
  emptySubtitle,
  style,
  onEvents,
}: BaseChartProps) {
  const { theme } = useAdminTheme();
  const themeName = echartsThemeName(theme);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState rows={3} />
      </div>
    );
  }
  if (empty) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      </div>
    );
  }

  return (
    <ReactECharts
      // `key` forces a full re-mount when the theme flips so ECharts
      // picks up the new registered theme. Re-rendering the same
      // instance with a new `theme` prop is a no-op in ECharts.
      key={themeName}
      theme={themeName}
      option={option}
      style={{ height, width: '100%', ...style }}
      notMerge
      lazyUpdate
      opts={{ renderer: 'canvas' }}
      onEvents={onEvents}
    />
  );
}
