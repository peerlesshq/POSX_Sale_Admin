/**
 * Chart option builders. Each helper returns a fully-specced
 * `EChartsOption` ready to hand to `BaseChart`. Keeping these in one
 * file means our dashboard, rewards, network, and reports pages all
 * draw from identical base styling — no "one line chart with slightly
 * different tooltip than another" drift.
 *
 * ALL colors come from CSS variables via `tokens.ts`. Never hard-code.
 */
import type { EChartsOption } from 'echarts';

import { chartPalette, cssVar } from '../../theme/tokens';

const palette = () => chartPalette();

/** Multi-series area chart — dashboards, rewards trends, network. */
export function buildAreaChartOption(opts: {
  xLabels: readonly string[];
  series: readonly {
    name: string;
    data: readonly number[];
    color?: string;
  }[];
  yFormatter?: (value: number) => string;
  stacked?: boolean;
}): EChartsOption {
  const pal = palette();
  return {
    color: opts.series.map((s, i) => s.color ?? pal[i % pal.length]).filter((c): c is string => c !== undefined),
    grid: { left: 56, right: 24, top: 32, bottom: 36, containLabel: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
    },
    legend: {
      show: opts.series.length > 1,
      top: 0,
      right: 0,
    },
    xAxis: {
      type: 'category',
      data: opts.xLabels as string[],
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => (opts.yFormatter ? opts.yFormatter(value) : String(value)),
      },
    },
    series: opts.series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      stack: opts.stacked ? 'total' : undefined,
      areaStyle: {
        opacity: 0.22,
      },
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
      data: [...s.data],
    })),
  };
}

/** Horizontal bar list — team rankings, top leaders. */
export function buildHBarOption(opts: {
  categories: readonly string[];
  values: readonly number[];
  color?: string;
  valueFormatter?: (value: number) => string;
}): EChartsOption {
  const color = opts.color ?? cssVar('--px-chart-1');
  return {
    grid: { left: 16, right: 48, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: opts.valueFormatter as (value: unknown) => string,
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        formatter: opts.valueFormatter,
      },
      splitLine: { lineStyle: { color: cssVar('--px-chart-grid'), type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: [...opts.categories].reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: [...opts.values].reverse(),
        barWidth: 14,
        itemStyle: {
          color,
          borderRadius: [0, 4, 4, 0],
        },
        emphasis: { itemStyle: { color: cssVar('--px-brand') } },
      },
    ],
  };
}

/** Vertical bar — depth distribution, per-day counts. */
export function buildVBarOption(opts: {
  categories: readonly string[];
  values: readonly number[];
  color?: string;
  valueFormatter?: (value: number) => string;
}): EChartsOption {
  const color = opts.color ?? cssVar('--px-chart-1');
  return {
    grid: { left: 44, right: 24, top: 24, bottom: 32, containLabel: false },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: [...opts.categories],
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: opts.valueFormatter },
      splitLine: { lineStyle: { color: cssVar('--px-chart-grid'), type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: [...opts.values],
        barWidth: '50%',
        itemStyle: { color, borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
}

/** Donut — reward mix, status mix. */
export function buildDonutOption(opts: {
  data: readonly { name: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
}): EChartsOption {
  const pal = palette();
  return {
    color: [...pal],
    tooltip: { trigger: 'item' },
    legend: {
      show: opts.showLegend ?? true,
      orient: 'vertical',
      right: 0,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
    },
    title:
      opts.centerValue || opts.centerLabel
        ? {
            text: opts.centerValue,
            subtext: opts.centerLabel,
            left: '35%',
            top: '40%',
            textAlign: 'center',
            textStyle: {
              color: cssVar('--px-text-primary'),
              fontSize: 20,
              fontWeight: 600,
            },
            subtextStyle: {
              color: cssVar('--px-text-tertiary'),
              fontSize: 11,
            },
          }
        : undefined,
    series: [
      {
        type: 'pie',
        radius: ['60%', '82%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderWidth: 2,
          borderColor: cssVar('--px-bg-surface'),
        },
        data: opts.data as { name: string; value: number }[],
      },
    ],
  };
}

/** Sankey — reward flow. */
export function buildSankeyOption(opts: {
  nodes: readonly { name: string }[];
  links: readonly { source: string; target: string; value: number }[];
}): EChartsOption {
  const pal = palette();
  return {
    color: [...pal],
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
    },
    series: [
      {
        type: 'sankey',
        left: 16,
        right: 24,
        top: 16,
        bottom: 16,
        data: opts.nodes as { name: string }[],
        links: opts.links as { source: string; target: string; value: number }[],
        nodeWidth: 12,
        nodeGap: 14,
        emphasis: { focus: 'adjacency' },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.4,
        },
        label: {
          color: cssVar('--px-text-primary'),
          fontSize: 11,
        },
        itemStyle: {
          borderColor: 'transparent',
        },
      },
    ],
  };
}

/**
 * Tree — agent / referral network.
 *
 * The input is the flat node list the network provider produces. We
 * re-nest it here so ECharts can render it.
 */
export interface TreeNodeInput {
  readonly id: string;
  readonly parentId: string | null;
  readonly walletAddress: string;
  readonly directCount: number;
  readonly teamSize: number;
}

export function buildTreeOption(opts: {
  nodes: readonly TreeNodeInput[];
  layout?: 'orthogonal' | 'radial';
  direction?: 'LR' | 'TB';
}): EChartsOption {
  const root = nest(opts.nodes);
  const layout = opts.layout ?? 'orthogonal';
  return {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params) => {
        const data = (params as { data?: { walletAddress?: string; directCount?: number; teamSize?: number } }).data;
        if (!data) return '';
        return `
          <div style="font-family:var(--px-font-mono);font-size:11px;">${(data.walletAddress ?? '').slice(0, 10)}…</div>
          <div style="font-size:11px;margin-top:4px;color:var(--px-text-secondary);">Direct: ${data.directCount ?? 0}</div>
          <div style="font-size:11px;color:var(--px-text-secondary);">Team: ${data.teamSize ?? 0}</div>
        `;
      },
    },
    series: [
      {
        type: 'tree',
        data: root ? [root] : [],
        top: '4%',
        left: '8%',
        bottom: '4%',
        right: '16%',
        layout,
        orient: opts.direction ?? 'LR',
        symbol: 'circle',
        symbolSize: 10,
        initialTreeDepth: 3,
        expandAndCollapse: true,
        roam: true,
        animationDuration: 420,
        animationDurationUpdate: 520,
        lineStyle: {
          color: cssVar('--px-border-strong'),
          width: 1,
          curveness: 0.45,
        },
        itemStyle: {
          color: cssVar('--px-brand'),
          borderColor: cssVar('--px-bg-surface'),
          borderWidth: 2,
        },
        label: {
          position: layout === 'radial' ? 'right' : 'top',
          distance: 8,
          rotate: 0,
          color: cssVar('--px-text-secondary'),
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          formatter: (params) => {
            const addr = (params as { data?: { walletAddress?: string } }).data?.walletAddress ?? '';
            return addr.slice(0, 6) + '…';
          },
        },
        leaves: {
          label: {
            position: layout === 'radial' ? 'right' : 'bottom',
          },
        },
        emphasis: { focus: 'descendant' },
      },
    ],
  };
}

/* Internal — nest a flat {id,parentId} list into a tree structure. */
interface TreeNode {
  name: string;
  walletAddress: string;
  directCount: number;
  teamSize: number;
  children?: TreeNode[];
}

function nest(flat: readonly TreeNodeInput[]): TreeNode | null {
  if (flat.length === 0) return null;
  const map = new Map<string, TreeNode>();
  flat.forEach((n) => {
    map.set(n.id, {
      name: n.walletAddress.slice(0, 10),
      walletAddress: n.walletAddress,
      directCount: n.directCount,
      teamSize: n.teamSize,
      children: [],
    });
  });
  let root: TreeNode | null = null;
  flat.forEach((n) => {
    const node = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children!.push(node);
    } else if (!root) {
      root = node;
    }
  });
  return root ?? map.get(flat[0]!.id) ?? null;
}

/** Heatmap — depth × day activity. */
export function buildHeatmapOption(opts: {
  xCategories: readonly string[];
  yCategories: readonly string[];
  data: readonly { x: number; y: number; value: number }[];
}): EChartsOption {
  return {
    tooltip: { position: 'top' },
    grid: { left: 60, right: 16, top: 16, bottom: 48, containLabel: false },
    xAxis: {
      type: 'category',
      data: [...opts.xCategories],
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: [...opts.yCategories],
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: [cssVar('--px-bg-surface-raised'), cssVar('--px-brand')],
      },
      textStyle: { color: cssVar('--px-text-tertiary'), fontSize: 11 },
    },
    series: [
      {
        type: 'heatmap',
        data: opts.data.map((d) => [d.x, d.y, d.value]),
        itemStyle: { borderRadius: 3 },
        emphasis: { itemStyle: { shadowBlur: 4, shadowColor: 'rgba(91,91,255,0.4)' } },
        progressive: 500,
      },
    ],
  };
}
