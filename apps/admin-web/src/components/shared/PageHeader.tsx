/**
 * PageHeader — consistent top-of-page block.
 *
 * Every admin page must use this. Provides:
 *   - Title + optional subtitle
 *   - Optional breadcrumb (auto-read from router or passed-in)
 *   - Right-side action slot
 *   - Tabbed sub-navigation (optional)
 */
import type { ReactNode } from 'react';

import './PageHeader.css';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, actions, tabs }: PageHeaderProps) {
  return (
    <div className="px-page-header">
      <div className="px-page-header__top">
        <div className="px-page-header__text">
          {breadcrumb && <div className="px-page-header__crumb">{breadcrumb}</div>}
          <h1 className="px-page-header__title">{title}</h1>
          {subtitle && <div className="px-page-header__subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="px-page-header__actions">{actions}</div>}
      </div>
      {tabs && <div className="px-page-header__tabs">{tabs}</div>}
    </div>
  );
}
