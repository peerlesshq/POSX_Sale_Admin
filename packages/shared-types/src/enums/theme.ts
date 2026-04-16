/**
 * UI theme choice.
 *
 * Source of truth: 09_config_center_spec.md §9.10 (display_rules.theme_options)
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];

export const THEME_VALUES = [
  Theme.Light,
  Theme.Dark,
] as const satisfies ReadonlyArray<Theme>;

export const isTheme = createEnumGuard(THEME_VALUES);
