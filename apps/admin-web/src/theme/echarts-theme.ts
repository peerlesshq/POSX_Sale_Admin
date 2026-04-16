/**
 * ECharts theme registration for Phase 7 / audit remediation.
 *
 * History: the old registration registered ONE theme (`posx-dark`) and
 * captured the CSS variable values at module-import time. Toggling to
 * light mode never re-themed the charts because the theme config was
 * already frozen. This file now registers BOTH `posx-dark` and
 * `posx-light` up-front, with palettes resolved from the token layer,
 * and consumers pick the right name at render time.
 *
 * Rules:
 *   - Page-level ECharts options MUST NOT hard-code colors. Read them
 *     from `chartPalette()` / `cssVar()` or the theme takes care of it
 *     via the `color: [...]` array on the registered theme.
 *   - When the user flips the theme, consumers of BaseChart re-mount
 *     via a `key={theme}` so ECharts picks up the new theme by name.
 */
import * as echarts from 'echarts/core';

import type { AdminTheme } from './index';

type EchartsThemeConfig = Parameters<typeof echarts.registerTheme>[1];

let registered = false;

/**
 * Dark palette — matches `--px-chart-1..10` in tokens.css dark block.
 * Hard-coded so registration doesn't depend on whether the DOM has
 * been initialised with the right `data-theme` attribute yet.
 */
const DARK_CHART_COLORS = [
  '#5b5bff', // indigo
  '#38bdf8', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#a855f7', // violet
  '#22d3ee', // cyan
  '#84cc16', // lime
  '#ec4899', // pink
  '#fb923c', // orange
] as const;

/**
 * Light palette — deepened by ~15% from dark for readability on white.
 * The hue families match dark so brand continuity is preserved; the
 * lightness shifts down so shapes remain legible against #fff/#f6f7fb.
 */
const LIGHT_CHART_COLORS = [
  '#4444e6', // indigo-700
  '#0ea5e9', // sky-500
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#9333ea', // violet-600
  '#0891b2', // cyan-600
  '#65a30d', // lime-600
  '#db2777', // pink-600
  '#ea580c', // orange-600
] as const;

const FONT_STACK =
  "'Inter Variable','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif";

interface ThemePaletteInput {
  readonly colors: readonly string[];
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly gridLine: string;
  readonly axisLabel: string;
  readonly tooltipBg: string;
  readonly tooltipText: string;
  readonly tooltipShadow: string;
  readonly pieBorder: string;
  readonly dataZoomFill: string;
  readonly dataZoomHandle: string;
}

const DARK_PALETTE: ThemePaletteInput = {
  colors: DARK_CHART_COLORS,
  textPrimary: '#e6ebf5',
  textSecondary: '#a8b0c2',
  textTertiary: '#6b7386',
  border: 'rgba(255,255,255,0.1)',
  borderStrong: 'rgba(255,255,255,0.16)',
  gridLine: 'rgba(255,255,255,0.06)',
  axisLabel: '#6b7386',
  tooltipBg: '#1b2130',
  tooltipText: '#e6ebf5',
  tooltipShadow:
    'box-shadow: 0 12px 32px rgba(0,0,0,0.45), 0 6px 12px rgba(0,0,0,0.28); border-radius: 10px; padding: 10px 12px;',
  pieBorder: '#161b27',
  dataZoomFill: 'rgba(91,91,255,0.1)',
  dataZoomHandle: '#5b5bff',
};

const LIGHT_PALETTE: ThemePaletteInput = {
  colors: LIGHT_CHART_COLORS,
  textPrimary: '#0f172a',
  textSecondary: '#475467',
  textTertiary: '#667085',
  border: 'rgba(15,23,42,0.1)',
  borderStrong: 'rgba(15,23,42,0.16)',
  gridLine: 'rgba(15,23,42,0.06)',
  axisLabel: '#667085',
  tooltipBg: '#ffffff',
  tooltipText: '#0f172a',
  tooltipShadow:
    'box-shadow: 0 12px 32px rgba(15,23,42,0.14), 0 6px 12px rgba(15,23,42,0.06); border-radius: 10px; padding: 10px 12px;',
  pieBorder: '#ffffff',
  dataZoomFill: 'rgba(91,91,255,0.08)',
  dataZoomHandle: '#4444e6',
};

function buildTheme(p: ThemePaletteInput): EchartsThemeConfig {
  return {
    color: [...p.colors],
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: FONT_STACK,
      color: p.textSecondary,
      fontSize: 12,
    },
    title: {
      textStyle: { color: p.textPrimary, fontWeight: 600, fontSize: 14 },
      subtextStyle: { color: p.textTertiary, fontSize: 12 },
      left: 0,
      top: 0,
    },
    grid: { left: 48, right: 24, top: 24, bottom: 32, containLabel: false },
    xAxis: {
      axisLine: { lineStyle: { color: p.border } },
      axisTick: { show: false },
      axisLabel: { color: p.axisLabel, fontSize: 11, margin: 12 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.axisLabel, fontSize: 11 },
      splitLine: { lineStyle: { color: p.gridLine, type: 'dashed' } },
    },
    legend: {
      textStyle: { color: p.textSecondary, fontSize: 12 },
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 18,
      top: 0,
      right: 0,
    },
    tooltip: {
      backgroundColor: p.tooltipBg,
      borderColor: p.border,
      borderWidth: 1,
      textStyle: {
        color: p.tooltipText,
        fontSize: 12,
        fontFamily: FONT_STACK,
      },
      extraCssText: p.tooltipShadow,
      axisPointer: {
        lineStyle: { color: p.borderStrong },
        crossStyle: { color: p.borderStrong },
        shadowStyle: { color: 'rgba(91,91,255,0.04)' },
      },
    },
    line: {
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2 },
    },
    bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
    pie: { itemStyle: { borderWidth: 2, borderColor: p.pieBorder } },
    categoryAxis: {
      axisLine: { lineStyle: { color: p.border } },
      axisLabel: { color: p.axisLabel },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisLabel: { color: p.axisLabel },
      splitLine: { lineStyle: { color: p.gridLine, type: 'dashed' } },
    },
    visualMap: { textStyle: { color: p.textSecondary } },
    dataZoom: {
      backgroundColor: 'transparent',
      fillerColor: p.dataZoomFill,
      borderColor: p.border,
      handleStyle: { color: p.dataZoomHandle },
      textStyle: { color: p.textTertiary },
    },
  };
}

export function registerAdminEchartsTheme(): void {
  if (registered) return;
  echarts.registerTheme('posx-dark', buildTheme(DARK_PALETTE));
  echarts.registerTheme('posx-light', buildTheme(LIGHT_PALETTE));
  registered = true;
}

export function echartsThemeName(mode: AdminTheme): 'posx-dark' | 'posx-light' {
  return mode === 'light' ? 'posx-light' : 'posx-dark';
}

/**
 * Expose the raw palettes for adapters that need to draw outside an
 * ECharts option (custom SVG, fallbacks). Always prefer the registered
 * theme name when possible.
 */
export const ADMIN_CHART_PALETTES = {
  dark: DARK_CHART_COLORS,
  light: LIGHT_CHART_COLORS,
} as const;
