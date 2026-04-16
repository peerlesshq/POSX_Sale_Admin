/**
 * admin-web i18n — Phase 7 dual-locale version.
 *
 * The admin console now ships with a full Simplified Chinese dictionary
 * as the default operator language, with English preserved for global
 * ops teams. Language switching is reactive: subscribe via
 * `useLocale()` / `subscribeLocale()` to re-render when it changes,
 * and the non-hook `t()` helper stays available for adapters that
 * run outside React (services, ECharts option builders, etc.).
 *
 * Rules:
 *   1. NEVER hardcode user-visible strings in components — always
 *      go through `t()` / `useT()`.
 *   2. Keys use a dotted path that matches the logical area
 *      (`nav.*`, `users.*`, `rewards.overview.*`, ...).
 *   3. Adding a new locale = one more JSON file + one more entry in
 *      `DICTS`. All other code is untouched.
 *   4. Number / date formatting reads from the active locale as well.
 */
import { useSyncExternalStore } from 'react';

import enDict from '../i18n/en.json';
import zhCNDict from '../i18n/zh-CN.json';

export type AdminLocale = 'zh-CN' | 'en';

export const DEFAULT_LOCALE: AdminLocale = 'zh-CN';

const DICTS: Record<AdminLocale, Record<string, string>> = {
  'zh-CN': zhCNDict as Record<string, string>,
  en: enDict as Record<string, string>,
};

const INTL_LOCALE: Record<AdminLocale, string> = {
  'zh-CN': 'zh-CN',
  en: 'en-US',
};

const STORAGE_KEY = 'posx.admin.locale';

/* ------------------------------------------------------------------
 * Runtime locale state (lives outside React so non-hook callers work).
 * ------------------------------------------------------------------ */
let currentLocale: AdminLocale = readInitialLocale();
const subscribers = new Set<() => void>();

function readInitialLocale(): AdminLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored in DICTS) return stored as AdminLocale;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): AdminLocale {
  return currentLocale;
}

export function getStoredLocale(): AdminLocale {
  return currentLocale;
}

export function saveLocale(locale: AdminLocale): void {
  if (!(locale in DICTS)) return;
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }
  subscribers.forEach((fn) => fn());
}

export function subscribeLocale(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/* ------------------------------------------------------------------
 * Translation helpers
 * ------------------------------------------------------------------ */

/**
 * Translate a dotted-path key. If the key is missing from the current
 * locale, falls through to English, then to the supplied fallback,
 * then the raw key itself.
 */
export function t(key: string, fallback?: string): string {
  const direct = DICTS[currentLocale]?.[key];
  if (direct !== undefined) return direct;
  const english = DICTS.en[key];
  if (english !== undefined) return english;
  return fallback ?? key;
}

/**
 * Interpolate `{name}` style placeholders.
 */
export function tp(key: string, params: Record<string, string | number>): string {
  const base = t(key);
  return base.replace(/\{(\w+)\}/g, (_, name: string) => {
    return params[name] !== undefined ? String(params[name]) : `{${name}}`;
  });
}

/**
 * React hook that subscribes to locale changes so the component
 * re-renders when the user toggles language.
 */
export function useLocale(): AdminLocale {
  return useSyncExternalStore(
    (notify) => subscribeLocale(notify),
    () => currentLocale,
    () => currentLocale,
  );
}

/**
 * Reactive `t`. Use inside components so they re-render on locale switch.
 * For non-component callers (adapters, chart option builders), keep
 * using the plain `t()` helper.
 */
export function useT(): (key: string, fallback?: string) => string {
  useLocale();
  return t;
}

/* ------------------------------------------------------------------
 * Formatters (read current locale so they switch with the UI)
 * ------------------------------------------------------------------ */
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[currentLocale], opts).format(value);
}

export function formatDate(value: Date | string | number, opts?: Intl.DateTimeFormatOptions): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(INTL_LOCALE[currentLocale], opts).format(d);
}

export const LOCALE_OPTIONS: readonly { value: AdminLocale; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];
