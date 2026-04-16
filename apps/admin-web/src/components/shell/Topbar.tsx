/**
 * Topbar — breadcrumb + global search launcher + theme toggle +
 * locale toggle + account menu. All content comes from i18n.
 *
 * The search launcher is the visible entry point for the Command
 * Palette. Pressing `⌘/Ctrl+K` anywhere in the app produces the same
 * result via the global shortcut handler in GlobalCommandPalette.
 */
import { Dropdown, Tag } from 'antd';
import {
  ChevronDown,
  Globe,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  User as UserIcon,
} from 'lucide-react';

import { NotificationCenter } from './NotificationCenter';
import { useLocation, useNavigate } from 'react-router-dom';

import type { loadEnv } from '../../env';
import { saveLocale, t, useLocale } from '../../lib/i18n';
import { clearSession, loadSession } from '../../lib/session';
import { api } from '../../api/endpoints';
import { useAdminTheme } from '../../theme';
import { Kbd } from '../ui/primitives';

import { pathToLabelKey } from './navConfig';

import './Topbar.css';

type Env = ReturnType<typeof loadEnv>;

interface TopbarProps {
  env: Env;
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

function useBreadcrumb(): { readonly segments: readonly { readonly label: string; readonly path: string }[] } {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  const out: { label: string; path: string }[] = [];
  let acc = '';
  for (const p of parts) {
    acc += `/${p}`;
    const key = pathToLabelKey(acc);
    out.push({ label: key ? t(key) : p, path: acc });
  }
  return { segments: out };
}

export function Topbar({ env, onOpenSearch, onToggleSidebar, sidebarCollapsed }: TopbarProps) {
  const session = loadSession();
  const navigate = useNavigate();
  const locale = useLocale();
  const { segments } = useBreadcrumb();
  const { theme: currentTheme, toggleTheme } = useAdminTheme();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    clearSession();
    navigate('/login');
  };

  const toggleLocale = () => {
    saveLocale(locale === 'zh-CN' ? 'en' : 'zh-CN');
  };

  const showDevBadge = env.useMockApi || env.enableAdminDevLogin;

  return (
    <header className="px-topbar">
      {/* Left — collapse toggle + breadcrumb */}
      <div className="px-topbar__left">
        {onToggleSidebar && (
          <button
            type="button"
            className="px-topbar__icon-btn px-topbar__sidebar-toggle"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? t('sidebar.expand', 'Expand sidebar') : t('sidebar.collapse', 'Collapse sidebar')}
            aria-label={sidebarCollapsed ? 'expand sidebar' : 'collapse sidebar'}
            aria-pressed={sidebarCollapsed ? 'true' : 'false'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        <nav className="px-topbar__crumbs" aria-label="breadcrumb">
          {segments.length === 0 ? (
            <span className="px-topbar__crumb-current">{t('nav.dashboard')}</span>
          ) : (
            segments.map((seg, i) => (
              <span key={seg.path} className="px-topbar__crumb">
                {i > 0 && <span className="px-topbar__crumb-sep">/</span>}
                {i === segments.length - 1 ? (
                  <span className="px-topbar__crumb-current">{seg.label}</span>
                ) : (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(seg.path);
                    }}
                  >
                    {seg.label}
                  </a>
                )}
              </span>
            ))
          )}
        </nav>
      </div>

      {/* Center — global search launcher */}
      <div className="px-topbar__center">
        <button type="button" className="px-search-launcher" onClick={onOpenSearch}>
          <Search size={14} className="px-search-launcher__icon" />
          <span className="px-search-launcher__placeholder">{t('search.placeholder')}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      {/* Right — badges + controls + account */}
      <div className="px-topbar__right">
        {showDevBadge && (
          <Tag color="gold" style={{ margin: 0 }}>
            {env.useMockApi ? t('dev.mock_api_badge') : t('dev.dev_login_badge')}
          </Tag>
        )}
        <span
          className="px-topbar__env-tag"
          data-env={env.appEnv}
          title={t('app.env_utc_label')}
        >
          {env.appEnv}
        </span>

        <button
          className="px-topbar__icon-btn"
          onClick={toggleLocale}
          title={t('locale.switch')}
          aria-label={t('locale.switch')}
        >
          <Globe size={16} />
          <span className="px-topbar__icon-btn-text">
            {locale === 'zh-CN' ? '中' : 'EN'}
          </span>
        </button>

        <button
          className="px-topbar__icon-btn"
          onClick={toggleTheme}
          title={t('theme.switch')}
          aria-label={t('theme.switch')}
        >
          {currentTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <NotificationCenter />

        <Dropdown
          menu={{
            items: [
              {
                key: 'logout',
                label: (
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <LogOut size={14} /> {t('auth.logout')}
                  </span>
                ),
                onClick: handleLogout,
              },
            ],
          }}
          placement="bottomRight"
          trigger={['click']}
        >
          <button className="px-topbar__account">
            <div className="px-topbar__avatar">
              <UserIcon size={14} />
            </div>
            <div className="px-topbar__account-text">
              <div className="px-topbar__account-name">{session?.name ?? '—'}</div>
              <div className="px-topbar__account-role">
                {t(`role.${session?.role ?? 'viewer'}`, session?.role)}
              </div>
            </div>
            <ChevronDown size={14} className="px-topbar__account-chev" />
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
