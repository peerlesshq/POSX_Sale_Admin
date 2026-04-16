/**
 * GlobalCommandPalette — the Ctrl+K command center.
 *
 * Built on `cmdk` for keyboard semantics + fuzzy matching, but styled
 * fully by us to fit the fintech dark theme. Results come from:
 *
 *   1. `flattenNav()` — every nav entry, always available even offline.
 *   2. `useGlobalSearch()` — live aggregate over users / config /
 *       settlement / logs endpoints when the query is non-empty.
 *
 * Keyboard contract:
 *   - `Ctrl/Cmd + K`   open/close
 *   - `↑ / ↓`          move selection
 *   - `Enter`          execute / navigate
 *   - `Esc`            close
 *
 * Accessibility: cmdk ships ARIA by default; we only style.
 */
import { Command } from 'cmdk';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Search as SearchIcon,
  Settings,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { flattenNav } from '../shell/navConfig';
import { useT } from '../../lib/i18n';
import { Kbd } from '../ui/primitives';

import { useGlobalSearch, type GroupKey, type SearchResult } from './useGlobalSearch';

import './GlobalCommandPalette.css';

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GROUP_ICON: Record<GroupKey, React.ReactNode> = {
  'search.group.users': <Users size={14} />,
  'search.group.settlement': <Zap size={14} />,
  'search.group.config': <Settings size={14} />,
  'search.group.logs': <FileText size={14} />,
  'search.group.navigation': <ClipboardList size={14} />,
};

export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  // Reset query when closing
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const navItems = useMemo(() => flattenNav(), []);
  const searchQuery = useGlobalSearch(query);

  const resultsByGroup = useMemo(() => {
    const hits = searchQuery.data ?? [];
    const grouped = new Map<GroupKey, SearchResult[]>();
    for (const hit of hits) {
      const list = grouped.get(hit.group) ?? [];
      list.push(hit);
      grouped.set(hit.group, list);
    }
    return grouped;
  }, [searchQuery.data]);

  const handleRun = useCallback(
    (path: string) => {
      onOpenChange(false);
      navigate(path);
    },
    [navigate, onOpenChange],
  );

  if (!open) return null;

  return (
    <div className="px-palette-backdrop" onClick={() => onOpenChange(false)}>
      <div className="px-palette-wrap" onClick={(e) => e.stopPropagation()}>
        <Command
          className="px-palette"
          label={t('search.placeholder')}
          loop
          shouldFilter={query.trim().length === 0}
        >
          <div className="px-palette__input-row">
            <SearchIcon size={16} className="px-palette__input-icon" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t('search.placeholder')}
              className="px-palette__input"
              autoFocus
            />
            <Kbd>Esc</Kbd>
          </div>

          <Command.List className="px-palette__list">
            {query.trim().length === 0 && (
              <div className="px-palette__empty-help">
                <div className="px-palette__empty-title">{t('search.empty_title')}</div>
                <div className="px-palette__empty-sub">{t('search.empty_subtitle')}</div>
              </div>
            )}

            {query.trim().length > 0 && searchQuery.isLoading && (
              <div className="px-palette__status">{t('common.loading')}</div>
            )}
            {query.trim().length > 0 && searchQuery.isError && (
              <div className="px-palette__status px-palette__status--err">
                {t('search.error')}
              </div>
            )}

            {/* Navigation group (always available) */}
            <Command.Group
              heading={
                <span className="px-palette__group-heading">
                  {GROUP_ICON['search.group.navigation']}
                  {t('search.group.navigation')}
                </span>
              }
            >
              {navItems.map((nav) => (
                <Command.Item
                  key={nav.path}
                  value={`${t(nav.labelKey)} ${nav.path}`}
                  onSelect={() => handleRun(nav.path)}
                  className="px-palette__item"
                >
                  <span className="px-palette__item-icon">
                    {nav.icon ? <nav.icon size={14} /> : <ArrowRight size={14} />}
                  </span>
                  <span className="px-palette__item-label">{t(nav.labelKey)}</span>
                  <span className="px-palette__item-meta">{nav.path}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Dynamic groups from server aggregation */}
            {Array.from(resultsByGroup.entries()).map(([group, items]) => (
              <Command.Group
                key={group}
                heading={
                  <span className="px-palette__group-heading">
                    {GROUP_ICON[group]}
                    {t(group)}
                  </span>
                }
              >
                {items.map((hit) => (
                  <Command.Item
                    key={hit.id}
                    value={`${hit.label} ${hit.meta ?? ''}`}
                    onSelect={() => handleRun(hit.path)}
                    className="px-palette__item"
                  >
                    <span className="px-palette__item-icon">{GROUP_ICON[group]}</span>
                    <span className="px-palette__item-label">{hit.label}</span>
                    {hit.meta && <span className="px-palette__item-meta">{hit.meta}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {query.trim().length > 0 && !searchQuery.isLoading && resultsByGroup.size === 0 && (
              <Command.Empty className="px-palette__no-result">
                {t('search.no_results')}
              </Command.Empty>
            )}
          </Command.List>

          <div className="px-palette__foot">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
            </span>
            <span>
              <Kbd>↵</Kbd> select
            </span>
            <span>
              <Kbd>Esc</Kbd> close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
