/**
 * Supported locale set.
 *
 * Sources of truth:
 *   - 10_i_18_n_and_content_spec.md §3
 *   - 09_config_center_spec.md §9.10 (display_rules.enabled_languages)
 *
 * Fallback order for missing translations (10 §8):
 *   selected → zh-CN → en → safe placeholder (dev only)
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const Locale = {
  ZhCN: 'zh-CN',
  ZhTW: 'zh-TW',
  En: 'en',
  Ko: 'ko',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const LOCALE_VALUES = [
  Locale.ZhCN,
  Locale.ZhTW,
  Locale.En,
  Locale.Ko,
] as const satisfies ReadonlyArray<Locale>;

export const isLocale = createEnumGuard(LOCALE_VALUES);

export const DEFAULT_USER_LOCALE: Locale = Locale.ZhCN;
export const DEFAULT_ADMIN_LOCALE: Locale = Locale.En;

/**
 * Fallback chain (10 §8). Not to be mutated. Callers iterate from the
 * selected locale onward.
 */
export const LOCALE_FALLBACK_ORDER: ReadonlyArray<Locale> = [
  Locale.ZhCN,
  Locale.En,
];
