/**
 * SectionCard — a titled surface block used everywhere.
 *
 * Header grammar (left to right):
 *   [icon] [title + subtitle stack] [headerTags]  →  [status pill] [timestamp] [actions] [collapse button]
 *
 * Backward-compat: `title / hint / actions / footer / padded / status`
 * still work exactly as before. All the new slots are optional — call
 * sites that don't set them render identically to the previous API.
 *
 * New slots (Phase 1 audit remediation):
 *   - `icon`          — small leading glyph next to the title
 *   - `headerTags`    — inline strip for `<Tag>` / `<Badge>` chips
 *   - `statusPill`    — small trailing pill (e.g. connection state)
 *   - `timestamp`     — last-updated indicator
 *   - `collapsible`   — turns the card into an expand/collapse affordance
 *   - `defaultCollapsed` — initial state for the expand/collapse
 *   - `onToggle`      — callback when the user toggles the body
 *   - `tone`          — 'default' | 'brand' | 'success' | 'warn' | 'danger'
 *                       (subtly tints the top edge to signal context)
 *   - `filterSlot`    — a row above the body for inline filter chrome
 *   - `dense`         — reduces header padding for inline usage
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from './states';

import './SectionCard.css';

export type SectionStatus = 'idle' | 'loading' | 'empty' | 'error';

export type SectionTone = 'default' | 'brand' | 'success' | 'warn' | 'danger';

interface SectionCardProps {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  status?: SectionStatus;
  loadingRows?: number;
  emptyTitle?: string;
  emptySubtitle?: string;
  errorTitle?: string;
  errorSubtitle?: string;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;

  // New slots
  icon?: ReactNode;
  headerTags?: ReactNode;
  statusPill?: ReactNode;
  timestamp?: ReactNode;
  filterSlot?: ReactNode;
  tone?: SectionTone;
  dense?: boolean;

  // Collapsible
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

export function SectionCard({
  title,
  hint,
  actions,
  footer,
  padded = true,
  status = 'idle',
  loadingRows = 3,
  emptyTitle,
  emptySubtitle,
  errorTitle,
  errorSubtitle,
  onRetry,
  className = '',
  children,
  icon,
  headerTags,
  statusPill,
  timestamp,
  filterSlot,
  tone = 'default',
  dense = false,
  collapsible = false,
  defaultCollapsed = false,
  onToggle,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const showHeader =
    title ||
    hint ||
    actions ||
    icon ||
    headerTags ||
    statusPill ||
    timestamp ||
    collapsible;

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onToggle?.(next);
  };

  const headerClass = [
    'px-section-card__header',
    dense ? 'px-section-card__header--dense' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={`px-section-card px-section-card--tone-${tone} ${className}`.trim()}
      data-collapsed={collapsed ? 'true' : undefined}
    >
      {showHeader && (
        <header className={headerClass}>
          <div className="px-section-card__heading">
            {icon && <span className="px-section-card__icon">{icon}</span>}
            <div className="px-section-card__heading-text">
              {title && (
                <div className="px-section-card__title">
                  <span>{title}</span>
                  {headerTags && (
                    <span className="px-section-card__tags">{headerTags}</span>
                  )}
                </div>
              )}
              {hint && <div className="px-section-card__hint">{hint}</div>}
            </div>
          </div>
          <div className="px-section-card__trailing">
            {statusPill && (
              <span className="px-section-card__status-pill">{statusPill}</span>
            )}
            {timestamp && (
              <span className="px-section-card__timestamp">{timestamp}</span>
            )}
            {actions && (
              <div className="px-section-card__actions">{actions}</div>
            )}
            {collapsible && (
              <button
                type="button"
                className="px-section-card__collapse"
                onClick={handleToggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'expand' : 'collapse'}
              >
                {collapsed ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            )}
          </div>
        </header>
      )}

      {filterSlot && !collapsed && (
        <div className="px-section-card__filter-slot">{filterSlot}</div>
      )}

      {!collapsed && (
        <div
          className={`px-section-card__body ${padded ? 'px-section-card__body--padded' : ''}`.trim()}
        >
          {status === 'loading' && <LoadingState rows={loadingRows} />}
          {status === 'empty' && (
            <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
          )}
          {status === 'error' && (
            <ErrorState
              title={errorTitle}
              subtitle={errorSubtitle}
              onRetry={onRetry}
            />
          )}
          {status === 'idle' && children}
        </div>
      )}

      {footer && !collapsed && (
        <footer className="px-section-card__footer">{footer}</footer>
      )}
    </section>
  );
}
