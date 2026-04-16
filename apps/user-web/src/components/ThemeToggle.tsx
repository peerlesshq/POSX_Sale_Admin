/**
 * Three-state theme toggle button.
 *
 * Shows an icon representing the CURRENT mode (not resolved theme), so
 * the user always sees which setting they've chosen. Clicking cycles
 * light → dark → system → light.
 *
 * The resolved theme is what the UI actually paints — see
 * `lib/theme.tsx` for the light/dark/system resolution.
 */
import { useTheme, type ThemeMode } from '../lib/theme';
import { t, type Locale } from '../lib/i18n';

const ICON: Record<ThemeMode, string> = {
  light: '☀',
  dark: '☾',
  system: '◐',
};

export function ThemeToggle({ locale }: { locale: Locale }): JSX.Element {
  const { mode, cycleMode } = useTheme();

  const label = t(locale, `theme.mode.${mode}`);
  const aria = t(locale, 'theme.toggle_aria');

  return (
    <button
      type="button"
      onClick={cycleMode}
      aria-label={aria}
      title={`${aria}: ${label}`}
      className="inline-flex items-center gap-1 text-sm border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span aria-hidden className="text-base leading-none">
        {ICON[mode]}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
