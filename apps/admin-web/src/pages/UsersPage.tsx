/**
 * Users module — User Operations Console rewrite.
 *
 * Exports:
 *   - UsersListPage — KPI strip + segments + GlobalFilterBar +
 *     professional table with `⋯` row dropdown (view / preview /
 *     tree / rewards / [danger] change status) + preview drawer.
 *   - UserDetailPage — hero + KPI grid + qualification + 5 tabs
 *     (overview / rewards / team / vesting / audit) + related
 *     links card.
 *   - UserTreePage — unchanged from Phase 7.
 *
 * Both pages honour the strict rules from spec 16:
 *   - never fabricate business numbers
 *   - claimed_total stays `—` until a claim endpoint lands
 *   - vesting renders an "integration required" placeholder
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { Button, Dropdown, Segmented, Tabs, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  CircleCheck,
  Clock,
  FileText as FileTextIcon,
  GitBranch,
  History as HistoryIcon,
  Layers,
  MoreHorizontal,
  Network as NetworkIcon,
  ShieldAlert,
  Users as UsersIcon,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/endpoints';
import { BaseChart } from '../components/charts/BaseChart';
import { buildTreeOption } from '../components/charts/options';
import {
  AmountCell,
  CountCell,
  DataTable,
  EmptyHint,
  GlobalFilterBar,
  InlineError,
  KpiStatCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  TierBadge,
  TimeCell,
  WalletCell,
  defaultFilters,
  type GlobalFilters,
} from '../components/shared';
import { useUserNetwork } from '../services/network';
import {
  applySegment,
  applyUserFilters,
  computeUserListKpis,
  type UserListFilters,
  type UserListRow,
  type UserSegment,
} from '../services/user/userListAnalytics';
import { buildUserViewModel } from '../services/user/userViewModel';
import { useT } from '../lib/i18n';
import { formatInt, toNumber } from '../lib/format';
import { useAdminRole } from '../lib/use-admin-role';

import { UserAuditTab } from './users/UserAuditTab';
import { UserHeroSummary } from './users/UserHeroSummary';
import { UserKpiGrid } from './users/UserKpiGrid';
import { UserKpiStrip } from './users/UserKpiStrip';
import { UserListQuickFilters } from './users/UserListQuickFilters';
import { UserOverviewTab } from './users/UserOverviewTab';
import { UserQualificationCard } from './users/UserQualificationCard';
import { UserRelatedLinksCard } from './users/UserRelatedLinksCard';
import { UserRewardsTab } from './users/UserRewardsTab';
import { UserRowPreviewDrawer } from './users/UserRowPreviewDrawer';
import {
  UserStatusActionModal,
  type UserStatus,
} from './users/UserStatusActionModal';
import { UserTeamTab } from './users/UserTeamTab';
import { UserVestingTab } from './users/UserVestingTab';

import './UsersPage.css';

type Row = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/* ==================================================================
 * LIST
 * ================================================================== */

export function UsersListPage() {
  const t = useT();
  const { canMutate } = useAdminRole();
  const navigate = useNavigate();

  const [segment, setSegment] = useState<UserSegment>('all');
  const [filters, setFilters] = useState<GlobalFilters>(() => defaultFilters());
  const [hasTeam, setHasTeam] = useState(false);
  const [hasRewards, setHasRewards] = useState(false);
  const [previewRow, setPreviewRow] = useState<UserListRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [riskTarget, setRiskTarget] = useState<{
    wallet: string;
    current: UserStatus;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, error: err, refetch } = useQuery<Row>({
    queryKey: ['admin', 'users', 'v2'],
    queryFn: () => api.listUsers({ page: 1, page_size: 500 }),
    staleTime: 20_000,
  });

  const allRows: UserListRow[] = useMemo(() => {
    const items = (data?.['items'] as Row[]) ?? [];
    return items.map((row) => ({
      wallet_address: String(row['wallet_address'] ?? ''),
      status: String(row['status'] ?? 'active'),
      current_tier: (row['current_tier'] as string) ?? null,
      cumulative_deposit: String(row['cumulative_deposit'] ?? '0'),
      direct_referral_count: toNumber(row['direct_referral_count']),
      team_size: toNumber(row['team_size']),
      team_total_performance: String(row['team_total_performance'] ?? '0'),
      created_at: String(row['created_at'] ?? ''),
    }));
  }, [data]);

  // KPI strip from unfiltered rows (so operators always see the
  // system-wide structure, not the filtered view).
  const kpis = useMemo(() => computeUserListKpis(allRows), [allRows]);

  const userFilters: UserListFilters = useMemo(
    () => ({ global: filters, hasTeam, hasRewards }),
    [filters, hasTeam, hasRewards],
  );

  const filteredRows = useMemo(() => {
    const segmentRows = applySegment(allRows, segment);
    return applyUserFilters(segmentRows, userFilters);
  }, [allRows, segment, userFilters]);

  // Segment counts for the segmented control badges.
  const segmentCounts = useMemo(() => {
    return {
      all: allRows.length,
      active: applySegment(allRows, 'active').length,
      high_value: applySegment(allRows, 'high_value').length,
      restricted: applySegment(allRows, 'restricted').length,
      has_team: applySegment(allRows, 'has_team').length,
      new: applySegment(allRows, 'new').length,
      rewarded: applySegment(allRows, 'rewarded').length,
    };
  }, [allRows]);

  const handleStatusConfirm = async ({
    targetStatus,
    reason,
  }: {
    targetStatus: UserStatus;
    reason: string;
  }) => {
    if (!riskTarget) return;
    setSaving(true);
    try {
      await api.updateUserStatus(riskTarget.wallet, {
        target_status: targetStatus,
        reason,
        effective_from: new Date().toISOString(),
      });
      void message.success(t('users.change_status.saved'));
      setRiskTarget(null);
      void refetch();
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  const openPreview = (row: UserListRow) => {
    setPreviewRow(row);
    setPreviewOpen(true);
  };

  const rowMenu = (row: UserListRow): MenuProps['items'] => [
    {
      key: 'view',
      label: t('users.action.view'),
      icon: <FileTextIcon size={13} />,
      onClick: () => navigate(`/users/${row.wallet_address}`),
    },
    {
      key: 'preview',
      label: t('users.action.preview'),
      icon: <CircleCheck size={13} />,
      onClick: () => openPreview(row),
    },
    {
      key: 'tree',
      label: t('users.action.tree'),
      icon: <NetworkIcon size={13} />,
      onClick: () => navigate(`/users/${row.wallet_address}/tree`),
    },
    {
      key: 'rewards',
      label: t('users.action.rewards'),
      icon: <WalletIcon size={13} />,
      onClick: () => navigate('/rewards'),
    },
    ...(canMutate
      ? [
          { type: 'divider' as const },
          {
            key: 'change_status',
            danger: true,
            label: t('users.action.change_status'),
            icon: <ShieldAlert size={13} />,
            onClick: () =>
              setRiskTarget({
                wallet: row.wallet_address,
                current: row.status as UserStatus,
              }),
          },
        ]
      : []),
  ];

  return (
    <div className="up-list">
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle_v2')} />

      <UserKpiStrip kpis={kpis} />

      <UserListQuickFilters
        value={segment}
        onChange={setSegment}
        counts={segmentCounts}
      />

      <GlobalFilterBar
        filters={filters}
        onChange={setFilters}
        onRefresh={() => refetch()}
        showAmount
      />

      <div className="up-list__extra-filters">
        <label className="up-list__toggle">
          <input
            type="checkbox"
            checked={hasTeam}
            onChange={(e) => setHasTeam(e.target.checked)}
          />
          <UsersIcon size={12} />
          {t('users.filter.has_team')}
        </label>
        <label className="up-list__toggle">
          <input
            type="checkbox"
            checked={hasRewards}
            onChange={(e) => setHasRewards(e.target.checked)}
          />
          <WalletIcon size={12} />
          {t('users.filter.has_rewards')}
        </label>
      </div>

      <SectionCard
        title={t('users.list.section_title')}
        hint={t('users.list.section_hint')}
        padded={false}
      >
        {isError ? (
          <InlineError
            title={t('common.error')}
            description={err instanceof Error ? err.message : undefined}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
            compact
          />
        ) : (
        <DataTable<UserListRow>
          rowKey={(r) => r.wallet_address}
          dataSource={filteredRows as UserListRow[]}
          loading={isLoading}
          locale={{ emptyText: <EmptyHint title={t('common.empty')} description={t('common.empty_hint')} /> }}
          scroll={{ x: 1280 }}
          onRow={(record) => ({
            onClick: (e: React.MouseEvent) => {
              // ignore clicks on the action column so the dropdown
              // doesn't also route the user.
              const target = e.target as HTMLElement;
              if (target.closest('.up-list__actions')) return;
              navigate(`/users/${record.wallet_address}`);
            },
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('users.col.wallet'),
              dataIndex: 'wallet_address',
              fixed: 'left',
              width: 200,
              render: (_: unknown, r: UserListRow) => (
                <WalletCell value={r.wallet_address} head={6} tail={4} />
              ),
            },
            {
              title: t('users.col.status'),
              dataIndex: 'status',
              width: 120,
              render: (_: unknown, r: UserListRow) => <StatusBadge value={r.status} />,
            },
            {
              title: t('users.col.tier'),
              dataIndex: 'current_tier',
              width: 100,
              render: (_: unknown, r: UserListRow) => (
                <TierBadge value={r.current_tier ?? 'none'} />
              ),
            },
            {
              title: t('users.col.deposit'),
              dataIndex: 'cumulative_deposit',
              width: 140,
              align: 'right' as const,
              sorter: (a: UserListRow, b: UserListRow) =>
                toNumber(a.cumulative_deposit) - toNumber(b.cumulative_deposit),
              render: (_: unknown, r: UserListRow) => (
                <AmountCell value={r.cumulative_deposit} />
              ),
            },
            {
              title: t('users.col.direct'),
              dataIndex: 'direct_referral_count',
              width: 90,
              align: 'right' as const,
              sorter: (a: UserListRow, b: UserListRow) =>
                a.direct_referral_count - b.direct_referral_count,
              render: (_: unknown, r: UserListRow) => (
                <CountCell value={r.direct_referral_count} />
              ),
            },
            {
              title: t('users.col.team_size'),
              dataIndex: 'team_size',
              width: 100,
              align: 'right' as const,
              sorter: (a: UserListRow, b: UserListRow) => a.team_size - b.team_size,
              render: (_: unknown, r: UserListRow) => <CountCell value={r.team_size} />,
            },
            {
              title: t('users.col.team_performance'),
              dataIndex: 'team_total_performance',
              width: 150,
              align: 'right' as const,
              sorter: (a: UserListRow, b: UserListRow) =>
                toNumber(a.team_total_performance) - toNumber(b.team_total_performance),
              render: (_: unknown, r: UserListRow) => (
                <AmountCell value={r.team_total_performance} />
              ),
            },
            {
              title: t('users.col.created'),
              dataIndex: 'created_at',
              width: 140,
              sorter: (a: UserListRow, b: UserListRow) =>
                Date.parse(a.created_at) - Date.parse(b.created_at),
              render: (_: unknown, r: UserListRow) => (
                <TimeCell value={r.created_at} mode="relative" />
              ),
            },
            {
              title: t('common.actions'),
              fixed: 'right',
              width: 80,
              render: (_: unknown, r: UserListRow) => (
                <div className="up-list__actions">
                  <Dropdown
                    menu={{ items: rowMenu(r) }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <button
                      type="button"
                      className="up-list__action-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </Dropdown>
                </div>
              ),
            },
          ]}
        />
        )}
      </SectionCard>

      <UserRowPreviewDrawer
        open={previewOpen}
        row={previewRow}
        onClose={() => setPreviewOpen(false)}
      />

      <UserStatusActionModal
        open={!!riskTarget}
        walletAddress={riskTarget?.wallet ?? ''}
        currentStatus={riskTarget?.current ?? 'active'}
        onCancel={() => setRiskTarget(null)}
        onConfirm={handleStatusConfirm}
        loading={saving}
      />
    </div>
  );
}

/* ==================================================================
 * DETAIL
 * ================================================================== */

type DetailTabKey = 'overview' | 'rewards' | 'team' | 'vesting' | 'audit';

export function UserDetailPage() {
  const t = useT();
  const { canMutate } = useAdminRole();
  const navigate = useNavigate();
  const { wallet = '' } = useParams<{ wallet: string }>();
  const [activeTab, setActiveTab] = useState<DetailTabKey>('overview');
  const [riskOpen, setRiskOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch everything the view model needs in parallel.
  const queries = useQueries({
    queries: [
      {
        queryKey: ['admin', 'user', wallet, 'detail'],
        queryFn: () => api.getUser(wallet),
        enabled: wallet.length > 0,
        staleTime: 30_000,
      },
      {
        queryKey: ['admin', 'user', wallet, 'direct'],
        queryFn: () => api.rewardsDirect({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'user', wallet, 'team'],
        queryFn: () => api.rewardsTeam({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'user', wallet, 'equal'],
        queryFn: () => api.rewardsEqualLevel({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'user', wallet, 'burns'],
        queryFn: () => api.rewardsBurns({ page: 1, page_size: 500 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'user', wallet, 'logs'],
        queryFn: () => api.logs({ page: 1, page_size: 200 }),
        staleTime: 60_000,
      },
      {
        queryKey: ['admin', 'user', wallet, 'tree'],
        queryFn: () => api.getUserTree(wallet),
        enabled: wallet.length > 0,
        staleTime: 60_000,
      },
    ],
  });

  const [dq, drq, trq, erq, brq, lq, treeQ] = queries;
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.error)?.error;

  const viewModel = useMemo(() => {
    if (!dq.data) return null;

    const walletLower = wallet.toLowerCase();
    const byToWallet = (row: Record<string, unknown>) => {
      const w =
        row['to_wallet_address'] ??
        row['wallet_address'] ??
        '';
      return String(w).toLowerCase() === walletLower;
    };

    const directRewards = ((drq.data as Row)?.['items'] as Row[] | undefined) ?? [];
    const teamRewards = ((trq.data as Row)?.['items'] as Row[] | undefined) ?? [];
    const equalRewards = ((erq.data as Row)?.['items'] as Row[] | undefined) ?? [];
    const burns = ((brq.data as Row)?.['items'] as Row[] | undefined) ?? [];
    const logs = ((lq.data as Row)?.['items'] as Row[] | undefined) ?? [];
    const tree = ((treeQ.data as Row)?.['nodes'] as Row[] | undefined) ?? [];

    return buildUserViewModel({
      walletAddress: wallet,
      detail: dq.data as Row,
      directRewards: directRewards.filter(byToWallet),
      teamRewards: teamRewards.filter(byToWallet),
      equalRewards: equalRewards.filter(byToWallet),
      burns: burns.filter(byToWallet),
      logs: logs.filter(
        (row) => String(row['target_id'] ?? '').toLowerCase() === walletLower,
      ),
      teamSubtree: tree,
    });
  }, [dq.data, drq.data, trq.data, erq.data, brq.data, lq.data, treeQ.data, wallet]);

  const handleStatusConfirm = async ({
    targetStatus,
    reason,
  }: {
    targetStatus: UserStatus;
    reason: string;
  }) => {
    setSaving(true);
    try {
      await api.updateUserStatus(wallet, {
        target_status: targetStatus,
        reason,
        effective_from: new Date().toISOString(),
      });
      void message.success(t('users.change_status.saved'));
      setRiskOpen(false);
      queries.forEach((q) => q.refetch());
    } catch (err) {
      void message.error(err instanceof Error ? err.message : t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  if (isError) {
    return (
      <div className="up-detail">
        <PageHeader
          title={t('users.detail.title')}
          subtitle={<WalletCell value={wallet} head={14} tail={10} />}
          actions={<Button onClick={() => navigate('/users')}>{t('common.back')}</Button>}
        />
        <InlineError
          title={t('common.error')}
          description={firstError instanceof Error ? firstError.message : undefined}
          onRetry={() => queries.forEach((q) => q.refetch())}
          retryLabel={t('common.retry')}
        />
      </div>
    );
  }

  if (isLoading || !viewModel) {
    return (
      <div className="up-detail">
        <PageHeader
          title={t('users.detail.title')}
          subtitle={<WalletCell value={wallet} head={14} tail={10} />}
          actions={<Button onClick={() => navigate('/users')}>{t('common.back')}</Button>}
        />
        <SectionCard status="loading" />
      </div>
    );
  }

  return (
    <div className="up-detail">
      <PageHeader
        title={t('users.detail.title')}
        subtitle={<WalletCell value={wallet} head={14} tail={10} />}
        actions={<Button onClick={() => navigate('/users')}>{t('common.back')}</Button>}
      />

      <UserHeroSummary
        vm={viewModel}
        onChangeStatus={canMutate ? () => setRiskOpen(true) : () => {}}
        onViewTree={() => navigate(`/users/${wallet}/tree`)}
        onViewRewards={() => setActiveTab('rewards')}
        onViewAudit={() => setActiveTab('audit')}
        onCopyLink={() => {
          void navigator.clipboard.writeText(window.location.href);
          void message.success(t('users.hero.link_copied'));
        }}
      />

      <UserKpiGrid vm={viewModel} />

      <UserQualificationCard vm={viewModel} />

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as DetailTabKey)}
        className="up-detail__tabs"
        items={[
          {
            key: 'overview',
            label: (
              <span className="up-detail__tab-label">
                <CircleCheck size={13} />
                {t('users.detail.tab.overview')}
              </span>
            ),
            children: <UserOverviewTab vm={viewModel} />,
          },
          {
            key: 'rewards',
            label: (
              <span className="up-detail__tab-label">
                <WalletIcon size={13} />
                {t('users.detail.tab.rewards')}
              </span>
            ),
            children: <UserRewardsTab vm={viewModel} />,
          },
          {
            key: 'team',
            label: (
              <span className="up-detail__tab-label">
                <GitBranch size={13} />
                {t('users.detail.tab.team')}
              </span>
            ),
            children: <UserTeamTab vm={viewModel} />,
          },
          {
            key: 'vesting',
            label: (
              <span className="up-detail__tab-label">
                <Clock size={13} />
                {t('users.detail.tab.vesting')}
              </span>
            ),
            children: <UserVestingTab vm={viewModel} />,
          },
          {
            key: 'audit',
            label: (
              <span className="up-detail__tab-label">
                <HistoryIcon size={13} />
                {t('users.detail.tab.audit')}
              </span>
            ),
            children: <UserAuditTab vm={viewModel} onChangeStatus={canMutate ? () => setRiskOpen(true) : () => {}} />,
          },
        ]}
      />

      <UserRelatedLinksCard walletAddress={wallet} />

      <UserStatusActionModal
        open={riskOpen}
        walletAddress={wallet}
        currentStatus={(viewModel.identity.status as UserStatus) ?? 'active'}
        onCancel={() => setRiskOpen(false)}
        onConfirm={handleStatusConfirm}
        loading={saving}
      />

      <span style={{ display: 'none' }}>
        <Layers />
      </span>
    </div>
  );
}

/* ==================================================================
 * TREE — unchanged from Phase 7
 * ================================================================== */

export function UserTreePage() {
  const t = useT();
  const { wallet = '' } = useParams<{ wallet: string }>();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<'orthogonal' | 'radial'>('orthogonal');

  const { data, isLoading, isError, error: treeErr, refetch } = useUserNetwork(wallet);

  const treeOption = useMemo(() => {
    if (!data) return undefined;
    return buildTreeOption({
      nodes: data.nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        walletAddress: n.walletAddress,
        directCount: n.directCount,
        teamSize: n.teamSize,
      })),
      layout,
      direction: 'LR',
    });
  }, [data, layout]);

  const totalNodes = data?.totalNodes ?? 0;
  const depth = data?.depth ?? 0;
  const directCount = data?.directCount ?? 0;
  const teamSize = data?.teamSize ?? 0;

  return (
    <div>
      <PageHeader
        title={t('users.tree.title')}
        subtitle={<WalletCell value={wallet} head={10} tail={8} />}
        actions={
          <>
            <Button onClick={() => navigate(`/users/${wallet}`)}>{t('common.back')}</Button>
            <Segmented
              value={layout}
              onChange={(v) => setLayout(v as 'orthogonal' | 'radial')}
              options={[
                { label: t('users.tree.layout.horizontal'), value: 'orthogonal' },
                { label: t('users.tree.layout.radial'), value: 'radial' },
              ]}
            />
          </>
        }
      />

      {isError ? (
        <InlineError
          title={t('common.error')}
          description={treeErr instanceof Error ? treeErr.message : undefined}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      ) : (<>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KpiStatCard
          label={t('users.tree.total_nodes')}
          value={formatInt(totalNodes)}
          accent="var(--px-chart-1)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('users.tree.depth')}
          value={formatInt(depth)}
          accent="var(--px-chart-2)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('users.tree.direct')}
          value={formatInt(directCount)}
          accent="var(--px-chart-3)"
          loading={isLoading}
        />
        <KpiStatCard
          label={t('users.tree.team')}
          value={formatInt(teamSize)}
          accent="var(--px-chart-4)"
          loading={isLoading}
        />
      </div>

      <SectionCard
        title={t('users.tree.title')}
        hint={t('nav.network.overview')}
        padded={false}
        status={isLoading ? 'loading' : totalNodes === 0 ? 'empty' : 'idle'}
      >
        {treeOption && <BaseChart option={treeOption} height={520} />}
      </SectionCard>

      <div style={{ marginTop: 16 }}>
        <SectionCard padded>
          <Link to="/network">{t('nav.network.overview')}</Link>
        </SectionCard>
      </div>
      </>)}
    </div>
  );
}

// Silence
void asString;
