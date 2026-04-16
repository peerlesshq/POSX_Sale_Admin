/**
 * Config Center — `/config`
 *
 * Professional, version-aware configuration management surface.
 * Replaces the old flat-table page with:
 *
 *   - 12-group left navigation with risk chips, future indicators
 *   - per-group KPI strip and high-risk callout
 *   - per-key table with current version, future marker, risk chip
 *   - expandable detail panel with 5 tabs:
 *       current / future / history / diff / raw
 *   - 3-step "Create New Version" wizard with structured editor,
 *     live preview, and review + risk confirmation
 *
 * The page does not contain business logic — all bucketing happens
 * in `pages/config/derive.ts` and diffs in `pages/config/diff.ts`,
 * both pure functions that operate on the raw API contract.
 */
import { useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { AlertTriangle, Plus as PlusIcon, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api/endpoints';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionCard,
} from '../components/shared';
import { useT } from '../lib/i18n';
import { useAdminRole } from '../lib/use-admin-role';

import {
  CONFIG_TAXONOMY,
  getGroupMeta,
  type ConfigRiskLevel,
} from './config/configTaxonomy';
import { ConfigDetailPanel } from './config/ConfigDetailPanel';
import { ConfigGroupHeader } from './config/ConfigGroupHeader';
import { ConfigGroupNav } from './config/ConfigGroupNav';
import { ConfigKeyTable } from './config/ConfigKeyTable';
import {
  CreateConfigVersionModal,
  type CreatePayload,
} from './config/CreateConfigVersionModal';
import {
  deriveGroupIndex,
  findBucket,
  groupIndexMap,
  type ConfigVersionLike,
} from './config/derive';

import './ConfigPage.css';

/* --------------------------------------------------------------------- */
/*  Component                                                            */
/* --------------------------------------------------------------------- */

export function ConfigPage() {
  const t = useT();
  const { canMutate } = useAdminRole();

  const [selectedGroup, setSelectedGroup] = useState<string>(
    CONFIG_TAXONOMY[0]!.group,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [futureOnly, setFutureOnly] = useState(false);
  const [riskOnly, setRiskOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{
    items: readonly ConfigVersionLike[];
  }>({
    queryKey: ['admin', 'config', 'center'],
    queryFn: async () => {
      const res = (await api.listConfig()) as { items: ConfigVersionLike[] };
      return res;
    },
    staleTime: 30_000,
  });

  const versions = data?.items ?? [];

  const groupEntries = useMemo(
    () => deriveGroupIndex(versions, Date.now()),
    [versions],
  );
  const groupIndex = useMemo(() => groupIndexMap(groupEntries), [groupEntries]);

  // Filter logic for the key table — applies within the selected group.
  const selectedEntry = groupIndex.get(selectedGroup);
  const selectedMeta = getGroupMeta(selectedGroup);

  const filteredBuckets = useMemo(() => {
    if (!selectedEntry || !selectedMeta) return [];
    const term = search.trim().toLowerCase();
    return selectedEntry.buckets.filter((bucket) => {
      if (futureOnly && bucket.future.length === 0) return false;
      if (riskOnly) {
        const keyMeta = selectedMeta.keys.find((k) => k.key === bucket.key);
        const risk: ConfigRiskLevel = keyMeta?.riskOverride ?? selectedMeta.risk;
        if (risk !== 'high') return false;
      }
      if (term) {
        const hay = `${bucket.key} ${selectedMeta.labelZh}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [selectedEntry, selectedMeta, search, futureOnly, riskOnly]);

  // Auto-select first key when the group changes.
  useEffect(() => {
    if (!selectedEntry) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !selectedEntry.buckets.find((b) => b.key === selectedKey)) {
      setSelectedKey(selectedEntry.buckets[0]?.key ?? null);
    }
  }, [selectedEntry, selectedKey]);

  const detailBucket =
    selectedKey != null ? findBucket(groupEntries, selectedGroup, selectedKey) : null;

  // Lookup helper for the create modal's baseline comparison.
  const currentVersionLookup = useCallback(
    (group: string, key: string): ConfigVersionLike | null => {
      const bucket = findBucket(groupEntries, group, key);
      return bucket?.current ?? null;
    },
    [groupEntries],
  );

  const handleCreate = useCallback(
    async (payload: CreatePayload) => {
      await api.createConfig({
        config_group: payload.config_group,
        config_key: payload.config_key,
        config_value: payload.config_value,
        effective_from: payload.effective_from,
        apply_scope: payload.apply_scope,
        description: payload.description,
      });
      setCreateOpen(false);
      void message.success(t('config.saved'));
      void refetch();
    },
    [refetch, t],
  );

  /* --------------------------------------------------------------- */
  /*  Render                                                         */
  /* --------------------------------------------------------------- */

  const createButton = canMutate ? (
    <button
      type="button"
      className="ant-btn ant-btn-primary cfg-create-btn"
      onClick={() => setCreateOpen(true)}
    >
      <PlusIcon size={14} />
      {t('config.new_version')}
    </button>
  ) : null;

  return (
    <div className="cfg-page">
      <PageHeader
        title={t('config.title')}
        subtitle={t('config.subtitle')}
        actions={createButton}
      />

      {/* Filter toolbar */}
      <div className="cfg-toolbar">
        <div className="cfg-toolbar__search">
          <Search size={14} />
          <input
            type="text"
            placeholder={t('config.search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="cfg-toolbar__toggle">
          <input
            type="checkbox"
            checked={futureOnly}
            onChange={(e) => setFutureOnly(e.target.checked)}
          />
          {t('config.filter.future_only')}
        </label>
        <label className="cfg-toolbar__toggle">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={(e) => setRiskOnly(e.target.checked)}
          />
          <AlertTriangle size={12} />
          {t('config.filter.high_risk_only')}
        </label>
      </div>

      {/* Body states */}
      {isLoading && <LoadingState rows={6} />}
      {isError && (
        <ErrorState
          title={t('common.failed')}
          subtitle={t('config.load_failed')}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && (
        <div className="cfg-layout">
          <ConfigGroupNav
            selectedGroup={selectedGroup}
            onSelect={setSelectedGroup}
            groupIndex={groupIndex}
          />

          <div className="cfg-main">
            {selectedMeta ? (
              <ConfigGroupHeader meta={selectedMeta} entry={selectedEntry} />
            ) : null}

            <SectionCard
              title={t('config.keys.section_title')}
              hint={t('config.keys.section_hint')}
              padded={false}
            >
              {filteredBuckets.length === 0 ? (
                <EmptyState
                  title={t('config.keys.empty_title')}
                  subtitle={t('config.keys.empty_hint')}
                />
              ) : (
                <ConfigKeyTable
                  groupMeta={selectedMeta!}
                  buckets={filteredBuckets}
                  selectedKey={selectedKey}
                  onSelectKey={setSelectedKey}
                />
              )}
            </SectionCard>

            {detailBucket && selectedMeta ? (
              <ConfigDetailPanel groupMeta={selectedMeta} bucket={detailBucket} />
            ) : null}
          </div>
        </div>
      )}

      <CreateConfigVersionModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        currentVersionLookup={currentVersionLookup}
        prefillGroup={selectedGroup}
        prefillKey={selectedKey}
      />
    </div>
  );
}
