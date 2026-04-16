/**
 * Admin Shell — hand-rolled layout for Phase 7 + Phase 5 collapse toggle.
 *
 * Replaces the ProLayout-based shell with a custom sidebar + topbar
 * that obeys our design tokens cleanly. Owns the global command
 * palette open/close state so `Ctrl+K` works anywhere in the app,
 * and (as of Phase 5) owns the sidebar collapse state so operators
 * can free up horizontal space on dense pages.
 *
 * Guarded by session — redirects to `/login` if unauthenticated.
 */
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { loadEnv } from '../../env';
import { loadSession } from '../../lib/session';

import { GlobalCommandPalette } from '../global-search/GlobalCommandPalette';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

import './Shell.css';

const COLLAPSE_STORAGE_KEY = 'posx.admin.sidebar.collapsed';

function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function Shell() {
  const env = loadEnv();
  const session = loadSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed());

  // Body class helps global styles key off the shell view vs the login
  // view (e.g. login uses its own background).
  useEffect(() => {
    document.body.classList.add('px-body--shell');
    return () => {
      document.body.classList.remove('px-body--shell');
    };
  }, []);

  // Reflect collapse state on the shell for CSS hooks and persist so
  // the preference survives a page refresh.
  useEffect(() => {
    document.body.classList.toggle('px-body--sidebar-collapsed', collapsed);
    saveCollapsed(collapsed);
  }, [collapsed]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`px-shell ${collapsed ? 'px-shell--sidebar-collapsed' : ''}`.trim()}>
      <Sidebar env={env.appEnv} collapsed={collapsed} onToggleCollapse={toggleSidebar} />
      <div className="px-shell__main">
        <Topbar
          env={env}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={collapsed}
        />
        <main className="px-shell__content">
          <Outlet />
        </main>
      </div>

      <GlobalCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
