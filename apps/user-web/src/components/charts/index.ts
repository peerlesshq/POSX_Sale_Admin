/**
 * user-web chart primitives — pure SVG, no chart dependency.
 *
 * These are deliberately simple — designed for "trend at a glance"
 * display, not interactive analytics. For real analytics we already
 * have the admin panel on ECharts.
 */
export { AreaMini } from './AreaMini';
export { DonutMini } from './DonutMini';
export type { DonutSegment } from './DonutMini';
export { BarMini } from './BarMini';
