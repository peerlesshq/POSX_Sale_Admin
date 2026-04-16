/**
 * Theme barrel — all theme surfaces in one import.
 *
 *   import {
 *     tokens,
 *     buildAdminAntdTheme,
 *     registerAdminEchartsTheme,
 *     echartsThemeName,
 *     AdminThemeProvider,
 *     useAdminTheme,
 *   } from './theme';
 *
 * Load order (see main.tsx):
 *   1. tokens.css      (variables)
 *   2. fonts.css       (font-family + tabular)
 *   3. globals.css     (reset + antd overrides)
 *   4. Inter font packages (side-effect)
 *   5. JetBrains Mono (side-effect)
 */
export * from './tokens';
export {
  adminDarkTheme,
  adminLightTheme,
  buildAdminAntdTheme,
} from './antd-theme';
export {
  registerAdminEchartsTheme,
  echartsThemeName,
  ADMIN_CHART_PALETTES,
} from './echarts-theme';

export type AdminTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'posx.admin.theme';

export function getStoredTheme(): AdminTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function saveTheme(theme: AdminTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: AdminTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

// Provider + hook (kept separate to avoid a circular import between
// this module and ThemeContext.tsx during module eval).
export { AdminThemeProvider, useAdminTheme } from './ThemeContext';
