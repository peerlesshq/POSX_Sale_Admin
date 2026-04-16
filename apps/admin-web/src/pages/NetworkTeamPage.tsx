/**
 * Global Agent Network — Team Structure page (/network/team).
 *
 * The "global tree + path + summary + children" operational cockpit.
 *
 * Architecture:
 *   - Data: `useTeamGraph()` from services/teamGraph (swappable adapter).
 *   - UI: KPI strip → search/view controls → two-column working area.
 *     Left: global tree with virtualised collapse/expand and selection.
 *     Right: ancestry path · node summary KPIs · direct children table
 *            · depth distribution chart.
 *
 * Interaction model (single source of truth = `selectedWallet`):
 *   - Click tree node       → setSelectedWallet
 *   - Click path segment    → setSelectedWallet
 *   - Click child row       → setSelectedWallet (auto-expands path)
 *   - Search → locate       → setSelectedWallet + auto-expand ancestry
 *
 * Performance:
 *   - Tree only renders expanded branches (expandedKeys Set).
 *   - Snapshot is built once per React Query refetch and cached.
 */
import { Input, Segmented, Tag } from 'antd';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Crown,
  Info as InfoIcon,
  Search as SearchIcon,
  Users as UsersIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BaseChart } from '../components/charts/BaseChart';
import { buildVBarOption } from '../components/charts/options';
import {
  AmountCell,
  Badge,
  CountCell,
  DataTable,
  KeyValuePanel,
  KpiStatCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  TierBadge,
  WalletCell,
  type KvItem,
} from '../components/shared';
import { formatCompactUsdt, formatInt, formatPercent, toNumber, truncateHash } from '../lib/format';
import { useT } from '../lib/i18n';
import {
  computeAncestors,
  computeDirectChildren,
  useTeamGraph,
  type TeamGraphNode,
  type TeamGraphSnapshot,
} from '../services/teamGraph';

import './NetworkTeamPage.css';

type ViewMode = 'tree' | 'top' | 'active';

/* ==================================================================
 * Page
 * ================================================================== */

export function NetworkTeamPage() {
  const t = useT();
  const navigate = useNavigate();
  const { data: snapshot, isLoading, isError, refetch } = useTeamGraph();

  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');

  // Default selection = first root, with root and L1 expanded by default.
  useEffect(() => {
    if (!snapshot || selectedWallet !== null) return;
    const firstRoot = snapshot.roots[0];
    if (!firstRoot) return;
    setSelectedWallet(firstRoot);
    const initial = new Set<string>([firstRoot]);
    const l1 = snapshot.childrenByParent.get(firstRoot) ?? [];
    l1.forEach((id) => initial.add(id));
    setExpandedKeys(initial);
  }, [snapshot, selectedWallet]);

  const handleExpand = (wallet: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(wallet)) next.delete(wallet);
      else next.add(wallet);
      return next;
    });
  };

  const handleSelect = (wallet: string) => {
    setSelectedWallet(wallet);
    // Auto-expand the full ancestry of the new selection.
    if (!snapshot) return;
    const ancestors = computeAncestors(snapshot, wallet);
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      for (const a of ancestors) next.add(a.walletAddress);
      next.add(wallet);
      return next;
    });
  };

  const handleLocate = () => {
    if (!snapshot) return;
    const needle = searchInput.trim().toLowerCase();
    if (!needle) {
      setSearchError(null);
      return;
    }
    const match = Array.from(snapshot.nodes.keys()).find((w) =>
      w.toLowerCase().includes(needle),
    );
    if (!match) {
      setSearchError(t('network.team.search.not_found'));
      return;
    }
    setSearchError(null);
    handleSelect(match);
  };

  const selectedNode = selectedWallet && snapshot ? snapshot.nodes.get(selectedWallet) ?? null : null;
  const ancestors = useMemo(
    () => (snapshot && selectedWallet ? computeAncestors(snapshot, selectedWallet) : []),
    [snapshot, selectedWallet],
  );
  const directChildren = useMemo(
    () => (snapshot && selectedWallet ? computeDirectChildren(snapshot, selectedWallet) : []),
    [snapshot, selectedWallet],
  );

  // View mode filters the tree but NEVER hides the currently selected
  // branch — we always keep a valid view for the operator.
  const allowedWallets = useMemo(
    () => computeAllowedWallets(snapshot, viewMode, selectedWallet),
    [snapshot, viewMode, selectedWallet],
  );

  // Depth distribution chart
  const depthOption = useMemo(() => {
    if (!snapshot) return undefined;
    return buildVBarOption({
      categories: snapshot.depthHistogram.map((d) => `L${d.depth}`),
      values: snapshot.depthHistogram.map((d) => d.total),
      color: 'var(--px-chart-1)',
      valueFormatter: (v) => formatInt(v),
    });
  }, [snapshot]);

  return (
    <div>
      <PageHeader
        title={t('network.team.title')}
        subtitle={t('network.team.subtitle')}
        actions={
          <Badge tone="warn">
            <InfoIcon size={11} style={{ marginRight: 4 }} />
            {snapshot?.meta.source === 'backend'
              ? t('network.backend_badge')
              : t('network.aggregate_badge')}
          </Badge>
        }
      />

      {/* KPI strip */}
      <NetworkKpiStrip snapshot={snapshot} loading={isLoading} />

      {/* Search + view toggle */}
      <div className="ntp-controls">
        <div className="ntp-controls__search">
          <SearchIcon size={14} className="ntp-controls__icon" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={handleLocate}
            placeholder={t('network.team.search.placeholder')}
            bordered={false}
            style={{ background: 'transparent' }}
          />
          <button type="button" className="ntp-controls__locate" onClick={handleLocate}>
            {t('network.team.search.locate')}
          </button>
        </div>
        {searchError && <div className="ntp-controls__error">{searchError}</div>}
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { label: t('network.team.view.tree'), value: 'tree' },
            { label: t('network.team.view.top'), value: 'top' },
            { label: t('network.team.view.active'), value: 'active' },
          ]}
        />
      </div>

      {/* Two-column working area */}
      <div className="ntp-layout">
        {/* Left: Tree */}
        <SectionCard
          title={t('network.team.section.tree')}
          hint={t('network.team.section.tree_hint')}
          padded={false}
          status={isLoading ? 'loading' : isError ? 'error' : snapshot && snapshot.nodes.size === 0 ? 'empty' : 'idle'}
          onRetry={() => refetch()}
          className="ntp-tree-card"
        >
          {snapshot && (
            <div className="ntp-tree-scroll">
              {snapshot.roots.map((rootId) => (
                <TreeBranch
                  key={rootId}
                  wallet={rootId}
                  snapshot={snapshot}
                  expandedKeys={expandedKeys}
                  selectedWallet={selectedWallet}
                  onSelect={handleSelect}
                  onExpand={handleExpand}
                  allowedWallets={allowedWallets}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Right column */}
        <div className="ntp-right">
          <SectionCard
            title={t('network.team.section.path')}
            hint={t('network.team.section.path_hint')}
            padded
          >
            <NetworkPathBar
              ancestors={ancestors}
              selected={selectedNode}
              onSelect={handleSelect}
            />
          </SectionCard>

          <SectionCard
            title={t('network.team.section.summary')}
            hint={selectedNode ? truncateHash(selectedNode.walletAddress, 10, 8) : undefined}
            padded
            status={selectedNode ? 'idle' : 'empty'}
          >
            {selectedNode && (
              <NetworkNodeSummary
                node={selectedNode}
                onOpenUser={(wallet) => navigate(`/users/${wallet}`)}
              />
            )}
          </SectionCard>

          <SectionCard
            title={t('network.team.section.children')}
            hint={selectedNode ? `${directChildren.length} · ${t('users.col.direct')}` : undefined}
            padded={false}
            status={directChildren.length === 0 ? 'empty' : 'idle'}
            emptySubtitle={t('network.team.children.empty')}
          >
            <DirectChildrenTable children={directChildren} onSelect={handleSelect} />
          </SectionCard>

          <SectionCard
            title={t('network.team.section.distribution')}
            hint={t('network.team.section.distribution_hint')}
            padded
            status={isLoading ? 'loading' : 'idle'}
          >
            {depthOption && <BaseChart option={depthOption} height={220} />}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================
 * NetworkKpiStrip
 * ================================================================== */
function NetworkKpiStrip({
  snapshot,
  loading,
}: {
  snapshot: TeamGraphSnapshot | undefined;
  loading: boolean;
}) {
  const t = useT();
  const k = snapshot?.globalKpis;
  return (
    <div className="ntp-kpi-strip">
      <KpiStatCard
        label={t('network.team.kpi.total_wallets')}
        value={formatInt(k?.totalWallets ?? 0)}
        sub={`${formatInt(k?.activeWallets ?? 0)} · ${t('network.team.kpi.active')}`}
        accent="var(--px-chart-1)"
        loading={loading}
      />
      <KpiStatCard
        label={t('network.team.kpi.total_bindings')}
        value={formatInt(k?.totalBindings ?? 0)}
        sub={`${formatInt(k?.rootCount ?? 0)} · ${t('network.team.kpi.roots')}`}
        accent="var(--px-chart-2)"
        loading={loading}
      />
      <KpiStatCard
        label={t('network.team.kpi.max_depth')}
        value={formatInt(k?.maxDepth ?? 0)}
        sub={`${formatInt(k?.walletsWithTeam ?? 0)} · ${t('network.team.kpi.with_team')}`}
        accent="var(--px-chart-3)"
        loading={loading}
      />
      <KpiStatCard
        label={t('network.team.kpi.total_direct')}
        value={formatCompactUsdt(k?.totalDirectReward ?? 0)}
        sub={t('nav.rewards.direct')}
        accent="var(--px-chart-4)"
        loading={loading}
      />
      <KpiStatCard
        label={t('network.team.kpi.total_team')}
        value={formatCompactUsdt(k?.totalTeamReward ?? 0)}
        sub={t('nav.rewards.team')}
        accent="var(--px-chart-6)"
        loading={loading}
      />
      <KpiStatCard
        label={t('network.team.kpi.total_burned')}
        value={formatCompactUsdt(k?.totalBurned ?? 0)}
        sub={t('dashboard.burn_total')}
        accent="var(--px-chart-5)"
        loading={loading}
      />
    </div>
  );
}

/* ==================================================================
 * TreeBranch (recursive)
 * ================================================================== */
function TreeBranch({
  wallet,
  snapshot,
  expandedKeys,
  selectedWallet,
  onSelect,
  onExpand,
  allowedWallets,
  depth = 0,
}: {
  wallet: string;
  snapshot: TeamGraphSnapshot;
  expandedKeys: ReadonlySet<string>;
  selectedWallet: string | null;
  onSelect: (wallet: string) => void;
  onExpand: (wallet: string) => void;
  allowedWallets: ReadonlySet<string> | null;
  depth?: number;
}) {
  const node = snapshot.nodes.get(wallet);
  if (!node) return null;
  if (allowedWallets && !allowedWallets.has(wallet) && wallet !== selectedWallet) return null;

  const children = snapshot.childrenByParent.get(wallet) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedKeys.has(wallet);
  const isSelected = wallet === selectedWallet;

  const statusTone =
    node.status === 'active'
      ? 'var(--px-status-ok)'
      : node.status === 'suspended' || node.status === 'blacklisted'
        ? 'var(--px-status-err)'
        : 'var(--px-status-warn)';

  return (
    <div className="ntp-tree__row-wrap">
      <div
        className={`ntp-tree__row ${isSelected ? 'ntp-tree__row--selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(wallet)}
      >
        <button
          type="button"
          className="ntp-tree__expand"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onExpand(wallet);
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          aria-label="toggle"
        >
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <span className="ntp-tree__dot" style={{ background: statusTone }} />

        <span className="ntp-tree__wallet">{truncateHash(wallet, 6, 4)}</span>

        {node.tier !== 'none' && (
          <span className={`ntp-tree__tier ntp-tree__tier--${node.tier}`}>
            {node.tier === 'elite' && <Crown size={10} style={{ marginRight: 3 }} />}
            {node.tier}
          </span>
        )}

        <span className="ntp-tree__perf">{formatCompactUsdt(node.teamPerformance)}</span>

        <span className="ntp-tree__count">
          <UsersIcon size={10} />
          {node.teamSize}
        </span>
      </div>

      {isExpanded && hasChildren && (
        <div className="ntp-tree__children">
          {children.map((childId) => (
            <TreeBranch
              key={childId}
              wallet={childId}
              snapshot={snapshot}
              expandedKeys={expandedKeys}
              selectedWallet={selectedWallet}
              onSelect={onSelect}
              onExpand={onExpand}
              allowedWallets={allowedWallets}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================================================================
 * NetworkPathBar — full ancestry breadcrumb
 * ================================================================== */
function NetworkPathBar({
  ancestors,
  selected,
  onSelect,
}: {
  ancestors: readonly TeamGraphNode[];
  selected: TeamGraphNode | null;
  onSelect: (wallet: string) => void;
}) {
  if (!selected) return <div className="px-text-tertiary">—</div>;
  const chain: TeamGraphNode[] = [...ancestors, selected];

  return (
    <div className="ntp-path">
      {chain.map((node, idx) => {
        const isLast = idx === chain.length - 1;
        return (
          <div key={node.walletAddress} className="ntp-path__seg">
            <button
              type="button"
              className={`ntp-path__node ${isLast ? 'ntp-path__node--current' : ''}`}
              onClick={() => onSelect(node.walletAddress)}
            >
              <span
                className="ntp-path__check"
                style={{
                  background: isLast ? 'var(--px-brand)' : 'var(--px-status-ok-soft)',
                  color: isLast ? '#fff' : 'var(--px-status-ok)',
                }}
              >
                {isLast ? idx + 1 : <Check size={11} />}
              </span>
              <span className="ntp-path__label">{truncateHash(node.walletAddress, 6, 4)}</span>
              {node.tier !== 'none' && (
                <span className="ntp-path__tier">{node.tier}</span>
              )}
            </button>
            {!isLast && <span className="ntp-path__line" />}
          </div>
        );
      })}
    </div>
  );
}

/* ==================================================================
 * NetworkNodeSummary
 * ================================================================== */
function NetworkNodeSummary({
  node,
  onOpenUser,
}: {
  node: TeamGraphNode;
  onOpenUser: (wallet: string) => void;
}) {
  const t = useT();

  const items: KvItem[] = [
    {
      label: t('network.team.node.parent'),
      value: node.parentId ? (
        <a onClick={() => onOpenUser(node.parentId!)}>{truncateHash(node.parentId, 6, 4)}</a>
      ) : (
        <span className="px-text-tertiary">—</span>
      ),
    },
    { label: t('users.col.status'), value: <StatusBadge value={node.status} /> },
    { label: t('users.col.tier'), value: <TierBadge value={node.tier} /> },
    { label: t('network.team.node.depth'), value: <CountCell value={node.depth} /> },
    { label: t('network.team.node.rate'), value: formatPercent(toNumber(node.teamRate), 2) },
    { label: t('network.team.node.buy_count'), value: <CountCell value={node.buyCount} /> },
  ];

  return (
    <div>
      <div className="ntp-summary__head">
        <WalletCell value={node.walletAddress} head={14} tail={10} />
        {node.isPeer && <Tag color="gold">Peer</Tag>}
        <a
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={() => onOpenUser(node.walletAddress)}
        >
          {t('common.view')} →
        </a>
      </div>

      <div className="ntp-summary__metrics">
        <Metric label={t('network.team.node.personal')} value={<AmountCell value={node.personalPerformance} mode="compact" />} accent="var(--px-chart-2)" />
        <Metric label={t('network.team.node.team_perf')} value={<AmountCell value={node.teamPerformance} mode="compact" />} accent="var(--px-chart-1)" />
        <Metric label={t('network.team.node.direct_count')} value={formatInt(node.directCount)} accent="var(--px-chart-3)" />
        <Metric label={t('network.team.node.team_size')} value={formatInt(node.teamSize)} accent="var(--px-chart-4)" />
      </div>

      <div className="ntp-summary__metrics ntp-summary__metrics--rewards">
        <Metric label={t('network.team.node.direct_reward')} value={<AmountCell value={node.rewardDirect} mode="compact" accent="up" />} accent="var(--px-chart-4)" />
        <Metric label={t('network.team.node.team_reward')} value={<AmountCell value={node.rewardTeam} mode="compact" accent="up" />} accent="var(--px-chart-6)" />
        <Metric label={t('network.team.node.equal_reward')} value={<AmountCell value={node.rewardEqualLevel} mode="compact" />} accent="var(--px-chart-7)" />
        <Metric label={t('network.team.node.burned')} value={<AmountCell value={node.rewardBurned} mode="compact" accent="down" />} accent="var(--px-chart-5)" />
      </div>

      <div style={{ marginTop: 14 }}>
        <KeyValuePanel items={items} columns={2} compact />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="ntp-metric" style={{ borderLeftColor: accent }}>
      <div className="ntp-metric__label">{label}</div>
      <div className="ntp-metric__value">{value}</div>
    </div>
  );
}

/* ==================================================================
 * DirectChildrenTable
 * ================================================================== */
function DirectChildrenTable({
  children,
  onSelect,
}: {
  children: readonly TeamGraphNode[];
  onSelect: (wallet: string) => void;
}) {
  const t = useT();
  return (
    <DataTable<TeamGraphNode>
      rowKey={(r) => r.walletAddress}
      dataSource={[...children]}
      pagination={false}
      dense
      onRow={(row) => ({
        onClick: () => onSelect(row.walletAddress),
        style: { cursor: 'pointer' },
      })}
      columns={[
        {
          title: t('network.team.children.col.address'),
          dataIndex: 'walletAddress',
          render: (v: string) => <WalletCell value={v} />,
        },
        {
          title: t('network.team.children.col.tier'),
          dataIndex: 'tier',
          render: (v: string) => <TierBadge value={v} />,
        },
        {
          title: t('network.team.children.col.personal'),
          dataIndex: 'personalPerformance',
          align: 'right',
          render: (v: string) => <AmountCell value={v} mode="compact" />,
        },
        {
          title: t('network.team.children.col.team'),
          dataIndex: 'teamPerformance',
          align: 'right',
          render: (v: string) => <AmountCell value={v} mode="compact" />,
        },
        {
          title: t('network.team.children.col.direct'),
          dataIndex: 'directCount',
          align: 'right',
          render: (v: unknown) => <CountCell value={v} />,
        },
        {
          title: t('network.team.children.col.team_size'),
          dataIndex: 'teamSize',
          align: 'right',
          render: (v: unknown) => <CountCell value={v} />,
        },
        {
          title: t('network.team.children.col.rate'),
          dataIndex: 'teamRate',
          align: 'right',
          render: (v: string) => (
            <span className="px-tabular">{formatPercent(toNumber(v), 1)}</span>
          ),
        },
        {
          title: t('network.team.children.col.status'),
          dataIndex: 'status',
          render: (v: string) => <StatusBadge value={v} />,
        },
        {
          title: t('network.team.children.col.peer'),
          dataIndex: 'isPeer',
          render: (v: boolean) =>
            v ? <Tag color="gold">✓</Tag> : <span className="px-text-tertiary">—</span>,
        },
      ]}
    />
  );
}

/* ==================================================================
 * View-mode filter
 * ================================================================== */
function computeAllowedWallets(
  snapshot: TeamGraphSnapshot | undefined,
  mode: ViewMode,
  selected: string | null,
): ReadonlySet<string> | null {
  if (!snapshot) return null;
  if (mode === 'tree') return null;

  const keep = new Set<string>();
  for (const [wallet, node] of snapshot.nodes) {
    if (mode === 'top' && node.teamSize >= 5) keep.add(wallet);
    if (mode === 'active' && node.status === 'active') keep.add(wallet);
  }
  // Always keep the selected wallet + its ancestors so the path stays
  // navigable even if the selection falls outside the filter.
  if (selected) {
    keep.add(selected);
    for (const a of computeAncestors(snapshot, selected)) keep.add(a.walletAddress);
  }
  return keep;
}
