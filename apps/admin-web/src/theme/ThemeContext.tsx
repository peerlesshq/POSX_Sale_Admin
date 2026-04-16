/**
 * ThemeContext — reactive admin theme state.
 *
 * Previous architecture read `getStoredTheme()` once at `App` mount, so
 * toggling required a full page reload. That reload killed form state,
 * scroll position, and open modals — an anti-pattern on a core control.
 *
 * This context holds the theme in React state. `setTheme(next)`:
 *   1. updates state (triggers ConfigProvider re-render)
 *   2. persists to localStorage
 *   3. sets `data-theme` on <html> so CSS variables flip
 *   4. BaseChart consumers re-mount via a `key={theme}` so ECharts
 *      picks up the new registered theme
 *
 * Components should call `useAdminTheme()` instead of reading the
 * storage helpers directly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FC, ReactNode } from 'react';

import { applyTheme, getStoredTheme, saveTheme, type AdminTheme } from './index';

interface AdminThemeContextValue {
  readonly theme: AdminTheme;
  readonly setTheme: (next: AdminTheme) => void;
  readonly toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

interface AdminThemeProviderProps {
  readonly children: ReactNode;
}

export const AdminThemeProvider: FC<AdminThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<AdminTheme>(() => getStoredTheme());

  // Keep <html data-theme> in sync even if state was initialised from
  // storage before React mounted.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: AdminTheme) => {
    setThemeState(next);
    saveTheme(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: AdminTheme = prev === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
};

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (tests,
    // login screen). Returns the stored theme with no-op setters.
    const fallback = getStoredTheme();
    return {
      theme: fallback,
      setTheme: () => {
        /* noop outside provider */
      },
      toggleTheme: () => {
        /* noop outside provider */
      },
    };
  }
  return ctx;
}
