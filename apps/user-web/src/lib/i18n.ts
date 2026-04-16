/**
 * Tiny i18n implementation: static dictionaries keyed by dotted
 * path. Full solution (ICU, plurals) can slot in later — the
 * current surface is plain strings.
 */
import enDict from '../i18n/en.json';
import koDict from '../i18n/ko.json';
import zhCNDict from '../i18n/zh-CN.json';
import zhTWDict from '../i18n/zh-TW.json';

export type Locale = 'zh-CN' | 'zh-TW' | 'en' | 'ko';

const DICTS: Record<Locale, Record<string, string>> = {
  'zh-CN': zhCNDict as Record<string, string>,
  'zh-TW': zhTWDict as Record<string, string>,
  en: enDict as Record<string, string>,
  ko: koDict as Record<string, string>,
};

const LOCALE_KEY = 'posx.user.locale';
const FALLBACK_ORDER: Locale[] = ['zh-CN', 'en'];

export function getStoredLocale(defaultLocale: string): Locale {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored && stored in DICTS) return stored as Locale;
  }
  if (defaultLocale in DICTS) return defaultLocale as Locale;
  return 'zh-CN';
}

export function saveLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_KEY, locale);
  }
}

export function t(locale: Locale, key: string, fallback?: string): string {
  const direct = DICTS[locale]?.[key];
  if (direct !== undefined) return direct;
  for (const fb of FALLBACK_ORDER) {
    const v = DICTS[fb]?.[key];
    if (v !== undefined) return v;
  }
  return fallback ?? key;
}
