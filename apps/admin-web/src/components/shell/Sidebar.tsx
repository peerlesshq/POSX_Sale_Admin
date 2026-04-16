/**
 * Sidebar — grouped navigation.
 *
 * Hand-rolled to get total control over the fintech look: subtle
 * section headers, soft hover, active indicator chip, nested child
 * routes that expand in place. Everything reads from navConfig.ts.
 *
 * Phase 5 addition: a foot-row collapse toggle. The toggle lives in
 * the sidebar footer so the button travels with the thing it's
 * collapsing. Shell owns the actual state + persistence.
 */
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useT } from '../../lib/i18n';

import { NAV_SECTIONS, type NavLink } from './navConfig';

import './Sidebar.css';

interface SidebarProps {
  collapsed?: boolean;
  env?: string;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  collapsed = false,
  env,
  onNavigate,
  onToggleCollapse,
}: SidebarProps) {
  const t = useT();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    '/rewards': location.pathname.startsWith('/rewards'),
    '/network': location.pathname.startsWith('/network'),
  });

  const toggleGroup = (path: string) => {
    setOpenGroups((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const isActive = (path: string) => {
    if (path === '/network' || path === '/rewards' || path === '/dashboard') {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const renderLink = (link: NavLink) => {
    const active = isActive(link.path);
    const hasChildren = link.children && link.children.length > 0;
    const isGroupOpen = openGroups[link.path] ?? false;
    const anyChildActive = hasChildren && link.children!.some((c) => isActive(c.path));
    const Icon = link.icon;

    return (
      <li key={link.path} className="px-nav__item">
        {hasChildren ? (
          <button
            type="button"
            className={`px-nav__link ${anyChildActive ? 'px-nav__link--active-group' : ''}`}
            onClick={() => toggleGroup(link.path)}
          >
            {Icon && <Icon className="px-nav__icon" size={16} strokeWidth={2} />}
            {!collapsed && (
              <>
                <span className="px-nav__label">{t(link.labelKey)}</span>
                <ChevronDown
                  className={`px-nav__chevron ${isGroupOpen ? 'px-nav__chevron--open' : ''}`}
                  size={14}
                  strokeWidth={2.5}
                />
              </>
            )}
          </button>
        ) : (
          <Link
            to={link.path}
            className={`px-nav__link ${active ? 'px-nav__link--active' : ''}`}
            onClick={onNavigate}
          >
            {Icon && <Icon className="px-nav__icon" size={16} strokeWidth={2} />}
            {!collapsed && <span className="px-nav__label">{t(link.labelKey)}</span>}
            {active && <span className="px-nav__indicator" />}
          </Link>
        )}

        {hasChildren && !collapsed && isGroupOpen && (
          <ul className="px-nav__children">
            {link.children!.map((child) => {
              const childActive = isActive(child.path);
              return (
                <li key={child.path} className="px-nav__child">
                  <Link
                    to={child.path}
                    className={`px-nav__child-link ${
                      childActive ? 'px-nav__child-link--active' : ''
                    }`}
                    onClick={onNavigate}
                  >
                    <span className="px-nav__child-dot" />
                    <span>{t(child.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside className={`px-sidebar ${collapsed ? 'px-sidebar--collapsed' : ''}`}>
      <div className="px-sidebar__brand">
        <div className="px-sidebar__logo">
          <span className="px-sidebar__logo-mark">P</span>
        </div>
        {!collapsed && (
          <div className="px-sidebar__brand-text">
            <div className="px-sidebar__brand-name">{t('app.name')}</div>
            <div className="px-sidebar__brand-tag">{t('app.tagline')}</div>
          </div>
        )}
      </div>

      <nav className="px-sidebar__nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} className="px-nav__section">
            {!collapsed && (
              <div className="px-nav__section-title">{t(section.titleKey)}</div>
            )}
            <ul className="px-nav__list">{section.links.map(renderLink)}</ul>
          </div>
        ))}
      </nav>

      <div className="px-sidebar__foot">
        {!collapsed && env && (
          <div className="px-sidebar__env">
            <span className="px-sidebar__env-dot" data-env={env} />
            <span className="px-sidebar__env-label">{env.toUpperCase()}</span>
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            className="px-sidebar__collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? t('sidebar.expand', 'Expand sidebar') : t('sidebar.collapse', 'Collapse sidebar')}
            title={collapsed ? t('sidebar.expand', 'Expand sidebar') : t('sidebar.collapse', 'Collapse sidebar')}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            {!collapsed && <span>{t('sidebar.collapse', 'Collapse')}</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
