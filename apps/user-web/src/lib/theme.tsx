/**
 * Theme management for user-web.
 *
 * Contract:
 *   - Three theme modes: 'light' | 'dark' | 'system'
 *   - Persisted in localStorage under `posx.user.theme`
 *   - 'system' follows prefers-color-scheme and reacts to media-query changes
 *   - Tailwind dark mode strategy: 'class' — we toggle `dark` on <html>
 *
 * The theme provider is framework-light (React context + a hook) so the
 * rest of the app stays ignorant of how the class gets on <html>.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'posx.user.theme';
const DOM_CLASS = 'dark';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDomClass(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add(DOM_CLASS);
  } else {
    root.classList.remove(DOM_CLASS);
  }
  root.style.colorScheme = resolved;
}

export interface ThemeContextValue {
  /** The user-selected preference. */
  readonly mode: ThemeMode;
  /** The effective theme after resolving 'system'. */
  readonly resolved: ResolvedTheme;
  /** Persist a new mode and apply it. */
  readonly setMode: (mode: ThemeMode) => void;
  /** Cycle light → dark → system → light. Useful for a single-button toggle. */
  readonly cycleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => systemPrefersDark());

  // Subscribe to prefers-color-scheme so 'system' mode reacts live.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (ev: MediaQueryListEvent) => setSystemIsDark(ev.matches);
    if ('addEventListener' in mql) {
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
    // Older Safari fallback
    (mql as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(listener);
    return () => {
      (mql as unknown as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener(listener);
    };
  }, []);

  const resolved: ResolvedTheme = useMemo(() => {
    if (mode === 'system') return systemIsDark ? 'dark' : 'light';
    return mode;
  }, [mode, systemIsDark]);

  // Apply to <html> whenever resolved changes.
  useEffect(() => {
    applyDomClass(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / storage errors
    }
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const next: ThemeMode =
        current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, cycleMode }),
    [mode, resolved, setMode, cycleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
