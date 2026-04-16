/**
 * useGlobalSearch — frontend aggregation hook for the command palette.
 *
 * Strategy:
 *   - When the query is empty, show recent items + quick navigation.
 *   - When the user types, run lightweight queries against 4 endpoints
 *     in parallel (users, logs, settlement jobs, config) and merge
 *     their top hits into grouped results.
 *   - Each result is a `{ id, group, label, meta, action }` tuple so
 *     the palette UI can render them uniformly.
 *
 * This is a frontend-only aggregate. Once the backend ships
 * `/admin/search?q=` we replace the implementation here with a single
 * fetch and keep the return type identical.
 */
import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/endpoints';
import { t } from '../../lib/i18n';

export type GroupKey =
  | 'search.group.users'
  | 'search.group.settlement'
  | 'search.group.config'
  | 'search.group.logs'
  | 'search.group.navigation';

export interface SearchResult {
  readonly id: string;
  readonly group: GroupKey;
  readonly label: string;
  readonly meta?: string;
  readonly path: string;
}

type Row = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

async function searchUsers(q: string): Promise<SearchResult[]> {
  try {
    const data = await api.listUsers({ page: 1, page_size: 8, search: q });
    const items = (data['items'] as Row[]) ?? [];
    return items.slice(0, 8).map((r) => {
      const wallet = asString(r['wallet_address']);
      return {
        id: `user-${wallet}`,
        group: 'search.group.users' as GroupKey,
        label: wallet,
        meta: `${t('users.col.tier')}: ${asString(r['current_tier'], '—')} · ${asString(r['status'], '—')}`,
        path: `/users/${wallet}`,
      };
    });
  } catch {
    return [];
  }
}

async function searchConfig(q: string): Promise<SearchResult[]> {
  try {
    const data = await api.listConfig({ page: 1, page_size: 8 });
    const items = (data['items'] as Row[]) ?? [];
    const lc = q.toLowerCase();
    return items
      .filter((r) => {
        const key = `${asString(r['config_group'])}.${asString(r['config_key'])}`;
        return key.toLowerCase().includes(lc) || asString(r['description']).toLowerCase().includes(lc);
      })
      .slice(0, 6)
      .map((r) => ({
        id: `config-${asString(r['config_version_id'], String(Math.random()))}`,
        group: 'search.group.config' as GroupKey,
        label: `${asString(r['config_group'])}.${asString(r['config_key'])}`,
        meta: `v${asString(r['version'], '1')} · ${asString(r['effective_from'])}`,
        path: '/config',
      }));
  } catch {
    return [];
  }
}

async function searchSettlement(q: string): Promise<SearchResult[]> {
  try {
    const data = await api.listSettlementJobs({ page: 1, page_size: 6 });
    const items = (data['items'] as Row[]) ?? [];
    const lc = q.toLowerCase();
    return items
      .filter((r) =>
        asString(r['settlement_date']).includes(lc) || asString(r['status']).includes(lc),
      )
      .slice(0, 6)
      .map((r) => ({
        id: `settlement-${asString(r['settlement_job_id'], String(Math.random()))}`,
        group: 'search.group.settlement' as GroupKey,
        label: `${asString(r['settlement_date'])} · ${asString(r['mode'])}`,
        meta: `${asString(r['status'])}`,
        path: '/settlement/jobs',
      }));
  } catch {
    return [];
  }
}

async function searchLogs(q: string): Promise<SearchResult[]> {
  try {
    const data = await api.logs({ page: 1, page_size: 6 });
    const items = (data['items'] as Row[]) ?? [];
    const lc = q.toLowerCase();
    return items
      .filter((r) =>
        asString(r['action']).toLowerCase().includes(lc) ||
        asString(r['target_type']).toLowerCase().includes(lc) ||
        asString(r['target_id']).toLowerCase().includes(lc),
      )
      .slice(0, 6)
      .map((r) => ({
        id: `log-${asString(r['admin_log_id'], String(Math.random()))}`,
        group: 'search.group.logs' as GroupKey,
        label: asString(r['action']),
        meta: `${asString(r['target_type'], '')} · ${asString(r['target_id'], '')}`,
        path: '/logs',
      }));
  } catch {
    return [];
  }
}

async function runAggregate(q: string): Promise<SearchResult[]> {
  const [users, config, settlement, logs] = await Promise.all([
    searchUsers(q),
    searchConfig(q),
    searchSettlement(q),
    searchLogs(q),
  ]);
  return [...users, ...config, ...settlement, ...logs];
}

export function useGlobalSearch(query: string) {
  return useQuery<SearchResult[]>({
    queryKey: ['admin', 'global-search', query],
    queryFn: () => runAggregate(query),
    enabled: query.trim().length > 0,
    staleTime: 20_000,
  });
}
