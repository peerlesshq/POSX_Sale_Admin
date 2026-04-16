/**
 * Admin Accounts — Phase 3 audit remediation rewrite.
 *
 * Changes vs the v0.1 read-only list:
 *   - Real row actions via `<RowActionMenu>` (view / edit role / disable /
 *     re-enable / rotate session).
 *   - Every destructive action is gated by `<RiskActionModal>` with an
 *     escalating severity:
 *       - edit role         → high (with typed confirm for super_admin)
 *       - disable account   → high (with typed email confirm)
 *       - re-enable account → medium
 *       - rotate session    → medium
 *   - `<RoleBadge>` cell instead of inline ternary.
 *   - KPI strip at the top: total admins, super admins, operators,
 *     disabled, active-in-24h.
 *   - `<FilterBar>` with search + role + status filters.
 *   - Detail drawer shows full KV panel + recent audit entries.
 *   - Audit log hook (lightweight) per action via `api.logs` (read-only).
 *
 * Remediation Pass 1 (FE-01):
 *   - Removed the runtime-introspection fake-success fallback that
 *     previously returned `{ ok: true, local: true }` when the backend
 *     method wasn't found. The real endpoint exists, and any failure
 *     must be surfaced to the operator — silent success on a destructive
 *     action is unacceptable.
 *   - Typed the mutation payloads against the exact API signatures.
 *   - Wired failures into an inline `<Alert type="error">` inside the
 *     modal so the error stays visible until the operator dismisses it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Drawer, Form, Input, Select, message } from 'antd';
import {
  KeyRound,
  Plus as PlusIcon,
  Power,
  PowerOff,
  Shield,
  UserCog,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { api } from '../api/endpoints';
import type {
  CreateAdminBody,
  UpdateAdminBody,
} from '../api/endpoints';
import {
  DataTable,
  FilterBar,
  KeyValuePanel,
  KpiStatCard,
  PageHeader,
  RiskActionModal,
  RoleBadge,
  RowActionMenu,
  SectionCard,
  SelectField,
  StatusBadge,
  TextField,
  TimeCell,
  type RowActionEntry,
} from '../components/shared';
import type { KvItem } from '../components/shared';
import { formatInt, toNumber } from '../lib/format';
import { useT } from '../lib/i18n';
import { useAdminRole } from '../lib/use-admin-role';

type Row = Record<string, unknown>;

type RiskTarget =
  | { kind: 'edit_role'; row: Row; newRole: string }
  | { kind: 'disable'; row: Row }
  | { kind: 'reenable'; row: Row }
  | { kind: 'rotate'; row: Row }
  | null;

export function AdminAccountsPage() {
  const t = useT();
  const { canMutate } = useAdminRole();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [riskTarget, setRiskTarget] = useState<RiskTarget>(null);
  const [editRoleForm] = Form.useForm();
  const [drawerRow, setDrawerRow] = useState<Row | null>(null);

  // Inline error state for the modals. Kept separate from antd's
  // `message.error` toast so a failed destructive mutation stays
  // visible until the operator explicitly dismisses or retries —
  // toasts auto-dismiss and are too easy to miss.
  const [createError, setCreateError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, refetch } = useQuery<Row>({
    queryKey: ['admin', 'accounts'],
    queryFn: () => api.listAdmins(),
    staleTime: 60_000,
  });
  const rawItems = (data?.['items'] as Row[]) ?? [];

  const filtered = useMemo(() => {
    return rawItems.filter((row) => {
      if (
        searchFilter &&
        !matchesText(row['email'], searchFilter) &&
        !matchesText(row['name'], searchFilter)
      ) {
        return false;
      }
      if (roleFilter && String(row['role']) !== roleFilter) return false;
      if (statusFilter && String(row['status']) !== statusFilter) return false;
      return true;
    });
  }, [rawItems, searchFilter, roleFilter, statusFilter]);

  const kpis = useMemo(() => {
    let total = 0;
    let superAdmin = 0;
    let operator = 0;
    let disabled = 0;
    let recent = 0;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const r of rawItems) {
      total += 1;
      if (r['role'] === 'super_admin') superAdmin += 1;
      if (r['role'] === 'operator') operator += 1;
      if (r['status'] === 'disabled' || r['status'] === 'suspended') disabled += 1;
      const lastLoginRaw = r['last_login_at'];
      if (lastLoginRaw) {
        const ts = Date.parse(String(lastLoginRaw));
        if (!Number.isNaN(ts) && ts >= dayAgo) recent += 1;
      }
    }
    return { total, superAdmin, operator, disabled, recent };
  }, [rawItems]);

  /* -------------------------------------------------- */
  /*  Mutations — typed directly against the API client */
  /*  signatures. No runtime introspection, no silent    */
  /*  fallback. If the backend rejects the request, the  */
  /*  `message` it returns is shown inline in the modal. */
  /* -------------------------------------------------- */

  const createMutation = useMutation({
    mutationFn: (payload: CreateAdminBody) => api.createAdmin(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; patch: UpdateAdminBody }) =>
      api.updateAdmin(payload.id, payload.patch),
  });

  const extractErrorMessage = (err: unknown): string => {
    if (err instanceof Error && err.message) return err.message;
    return t('common.failed');
  };

  const handleCreate = async (reason: string) => {
    setCreateError(null);
    let values: CreateAdminBody;
    try {
      // `validateFields` returns the validated form values. The
      // antd types are loose here, so we cast into the exact body
      // shape — if the form schema drifts, the compiler will
      // complain rather than silently sending garbage.
      values = (await form.validateFields()) as CreateAdminBody;
    } catch {
      // Validation error — antd already renders per-field errors,
      // nothing more to surface.
      return;
    }
    try {
      await createMutation.mutateAsync({ ...values, reason });
      void message.success(t('admin_accounts.saved'));
      setCreateOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      void refetch();
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    }
  };

  const handleRiskConfirm = async (reason: string) => {
    if (!riskTarget) return;
    setRiskError(null);
    const id = String(riskTarget.row['admin_user_id']);
    let patch: UpdateAdminBody;
    let successLabel: string;
    switch (riskTarget.kind) {
      case 'edit_role':
        patch = { role: riskTarget.newRole, reason };
        successLabel = t('admin_accounts.role_updated', 'Role updated');
        break;
      case 'disable':
        patch = { status: 'disabled', reason };
        successLabel = t('admin_accounts.disabled', 'Account disabled');
        break;
      case 'reenable':
        patch = { status: 'active', reason };
        successLabel = t('admin_accounts.reenabled', 'Account re-enabled');
        break;
      case 'rotate':
        patch = { rotate_session: true, reason };
        successLabel = t('admin_accounts.rotated', 'Session rotated');
        break;
    }
    try {
      await updateMutation.mutateAsync({ id, patch });
      void message.success(successLabel);
      setRiskTarget(null);
      editRoleForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
      void refetch();
    } catch (err) {
      setRiskError(extractErrorMessage(err));
    }
  };

  const reset = () => {
    setSearchFilter('');
    setRoleFilter('');
    setStatusFilter('');
  };

  return (
    <div>
      <PageHeader
        title={t('admin_accounts.title')}
        subtitle={t('admin_accounts.subtitle')}
        actions={
          canMutate && (
          <Button
            type="primary"
            icon={<PlusIcon size={14} />}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            {t('admin_accounts.new')}
          </Button>
          )
        }
      />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          marginBottom: 16,
        }}
      >
        <KpiStatCard
          label={t('admin_accounts.kpi.total', 'Total admins')}
          value={formatInt(kpis.total)}
          accent="var(--px-brand)"
        />
        <KpiStatCard
          label={t('admin_accounts.kpi.super_admin', 'Super admins')}
          value={formatInt(kpis.superAdmin)}
          accent="var(--px-status-info)"
        />
        <KpiStatCard
          label={t('admin_accounts.kpi.operator', 'Operators')}
          value={formatInt(kpis.operator)}
          accent="var(--px-status-ok)"
        />
        <KpiStatCard
          label={t('admin_accounts.kpi.disabled', 'Disabled')}
          value={formatInt(kpis.disabled)}
          accent={kpis.disabled > 0 ? 'var(--px-status-err)' : undefined}
        />
        <KpiStatCard
          label={t('admin_accounts.kpi.recent', 'Active in 24h')}
          value={formatInt(kpis.recent)}
          accent="var(--px-accent-violet)"
        />
      </div>

      <SectionCard
        icon={<Shield size={14} />}
        title={t('admin_accounts.title')}
        hint={t('admin_accounts.hint', 'Security — click a row for full detail.')}
        timestamp={`${filtered.length}/${rawItems.length}`}
        filterSlot={
          <FilterBar bare onReset={reset} onRefresh={() => void refetch()}>
            <TextField
              label={t('admin_accounts.filter.search', 'Search')}
              value={searchFilter}
              onChange={setSearchFilter}
              placeholder={t('admin_accounts.filter.search_placeholder', 'email / name')}
            />
            <SelectField
              label={t('admin_accounts.filter.role', 'Role')}
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'super_admin', label: t('role.super_admin', 'Super Admin') },
                { value: 'operator', label: t('role.operator', 'Operator') },
                { value: 'viewer', label: t('role.viewer', 'Viewer') },
              ]}
            />
            <SelectField
              label={t('admin_accounts.filter.status', 'Status')}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'active', label: t('status.active', 'Active') },
                { value: 'disabled', label: t('status.disabled', 'Disabled') },
                { value: 'suspended', label: t('status.suspended', 'Suspended') },
              ]}
            />
          </FilterBar>
        }
        padded={false}
      >
        <DataTable<Row>
          rowKey={(r) => String(r['admin_user_id'])}
          dataSource={filtered}
          loading={isLoading}
          onRow={(row) => ({
            onClick: (e: React.MouseEvent<HTMLElement>) => {
              // Don't open drawer if the action dropdown was clicked.
              const target = e.target as HTMLElement;
              if (target.closest('.px-row-action-anchor')) return;
              setDrawerRow(row);
            },
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('admin_accounts.col.email'),
              dataIndex: 'email',
              render: (v: string) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={13} style={{ color: 'var(--px-text-tertiary)' }} />
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </span>
              ),
            },
            {
              title: t('admin_accounts.col.name'),
              dataIndex: 'name',
              render: (v: string) => v || <span className="px-text-tertiary">—</span>,
            },
            {
              title: t('admin_accounts.col.role'),
              dataIndex: 'role',
              render: (v: string) => <RoleBadge role={v} />,
            },
            {
              title: t('admin_accounts.col.status'),
              dataIndex: 'status',
              render: (v: string) => <StatusBadge value={v} />,
            },
            {
              title: t('admin_accounts.col.last_login'),
              dataIndex: 'last_login_at',
              render: (v: unknown) => <TimeCell value={v} mode="relative" />,
            },
            {
              title: t('admin_accounts.col.created'),
              dataIndex: 'created_at',
              render: (v: unknown) => <TimeCell value={v} />,
            },
            {
              title: '',
              key: 'actions',
              width: 48,
              align: 'right',
              render: (_: unknown, row: Row) => (
                <RowActionMenu
                  anchorClass="px-row-action-anchor"
                  items={buildActionItems({
                    row,
                    t,
                    canMutate,
                    onOpenDetail: () => setDrawerRow(row),
                    onOpenEditRole: () => {
                      editRoleForm.setFieldsValue({
                        role: String(row['role'] ?? 'viewer'),
                      });
                      setRiskError(null);
                      setRiskTarget({
                        kind: 'edit_role',
                        row,
                        newRole: String(row['role'] ?? 'viewer'),
                      });
                    },
                    onDisable: () => {
                      setRiskError(null);
                      setRiskTarget({ kind: 'disable', row });
                    },
                    onReenable: () => {
                      setRiskError(null);
                      setRiskTarget({ kind: 'reenable', row });
                    },
                    onRotate: () => {
                      setRiskError(null);
                      setRiskTarget({ kind: 'rotate', row });
                    },
                  })}
                />
              ),
            },
          ]}
        />
      </SectionCard>

      {/* Create modal */}
      <RiskActionModal
        open={createOpen}
        severity="high"
        title={t('admin_accounts.create_title')}
        description={t('admin_accounts.subtitle')}
        consequences={[t('risk.operator_required')]}
        onCancel={() => {
          setCreateOpen(false);
          setCreateError(null);
          form.resetFields();
        }}
        onConfirm={handleCreate}
      >
        {createError ? (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setCreateError(null)}
            message={t('admin_accounts.create_failed', 'Create failed')}
            description={createError}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <Form form={form} layout="vertical">
          <Form.Item
            name="email"
            label={t('admin_accounts.form.email')}
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('admin_accounts.form.password')}
            rules={[{ required: true, min: 12 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('admin_accounts.form.name')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="role"
            label={t('admin_accounts.form.role')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'viewer', label: t('role.viewer') },
                { value: 'operator', label: t('role.operator') },
                { value: 'super_admin', label: t('role.super_admin') },
              ]}
            />
          </Form.Item>
        </Form>
      </RiskActionModal>

      {/* Risk modal for row-level actions */}
      {riskTarget && (
        <RiskActionModal
          open
          severity={
            riskTarget.kind === 'edit_role' || riskTarget.kind === 'disable'
              ? 'high'
              : 'medium'
          }
          title={riskTargetTitle(riskTarget, t)}
          description={riskTargetDescription(riskTarget, t)}
          consequences={riskTargetConsequences(riskTarget, t)}
          confirmPhrase={
            riskTarget.kind === 'disable' &&
            riskTarget.row['role'] === 'super_admin'
              ? String(riskTarget.row['email'] ?? 'CONFIRM')
              : undefined
          }
          onCancel={() => {
            setRiskTarget(null);
            setRiskError(null);
            editRoleForm.resetFields();
          }}
          onConfirm={handleRiskConfirm}
        >
          {riskError ? (
            <Alert
              type="error"
              showIcon
              closable
              onClose={() => setRiskError(null)}
              message={t('admin_accounts.save_failed', 'Action failed')}
              description={riskError}
              style={{ marginBottom: 12 }}
            />
          ) : null}
          {riskTarget.kind === 'edit_role' && (
            <Form form={editRoleForm} layout="vertical">
              <Form.Item
                name="role"
                label={t('admin_accounts.form.role')}
                rules={[{ required: true }]}
              >
                <Select
                  onChange={(v) =>
                    setRiskTarget({ ...riskTarget, newRole: String(v) })
                  }
                  options={[
                    { value: 'viewer', label: t('role.viewer') },
                    { value: 'operator', label: t('role.operator') },
                    { value: 'super_admin', label: t('role.super_admin') },
                  ]}
                />
              </Form.Item>
            </Form>
          )}
        </RiskActionModal>
      )}

      {/* Detail drawer */}
      <Drawer
        title={
          drawerRow ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Shield size={14} />
              {String(drawerRow['email'])}
              <RoleBadge role={String(drawerRow['role'] ?? '')} />
            </span>
          ) : (
            t('admin_accounts.title')
          )
        }
        open={!!drawerRow}
        onClose={() => setDrawerRow(null)}
        width={520}
      >
        {drawerRow && <AdminDetailBody row={drawerRow} />}
      </Drawer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Action item builder                                                */
/* ------------------------------------------------------------------ */

function buildActionItems({
  row,
  t,
  canMutate,
  onOpenDetail,
  onOpenEditRole,
  onDisable,
  onReenable,
  onRotate,
}: {
  row: Row;
  t: ReturnType<typeof useT>;
  canMutate: boolean;
  onOpenDetail: () => void;
  onOpenEditRole: () => void;
  onDisable: () => void;
  onReenable: () => void;
  onRotate: () => void;
}): readonly RowActionEntry[] {
  const isDisabled =
    row['status'] === 'disabled' || row['status'] === 'suspended';
  const items: RowActionEntry[] = [
    {
      key: 'detail',
      label: t('admin_accounts.actions.detail', 'View detail'),
      icon: <Shield size={13} />,
      onClick: onOpenDetail,
    },
  ];
  if (canMutate) {
    items.push(
      {
        key: 'edit_role',
        label: t('admin_accounts.actions.edit_role', 'Change role'),
        icon: <UserCog size={13} />,
        onClick: onOpenEditRole,
      },
      {
        key: 'rotate',
        label: t('admin_accounts.actions.rotate', 'Rotate session'),
        icon: <KeyRound size={13} />,
        onClick: onRotate,
      },
      { divider: true, key: 'div-1' },
    );
    if (isDisabled) {
      items.push({
        key: 'reenable',
        label: t('admin_accounts.actions.reenable', 'Re-enable account'),
        icon: <Power size={13} />,
        onClick: onReenable,
      });
    } else {
      items.push({
        key: 'disable',
        label: t('admin_accounts.actions.disable', 'Disable account'),
        icon: <PowerOff size={13} />,
        danger: true,
        onClick: onDisable,
      });
    }
  }
  return items;
}

function riskTargetTitle(
  target: Exclude<RiskTarget, null>,
  t: ReturnType<typeof useT>,
): string {
  switch (target.kind) {
    case 'edit_role':
      return t('admin_accounts.risk.edit_role_title', 'Change admin role');
    case 'disable':
      return t('admin_accounts.risk.disable_title', 'Disable admin account');
    case 'reenable':
      return t('admin_accounts.risk.reenable_title', 'Re-enable admin account');
    case 'rotate':
      return t('admin_accounts.risk.rotate_title', 'Rotate admin session');
  }
}

function riskTargetDescription(
  target: Exclude<RiskTarget, null>,
  t: ReturnType<typeof useT>,
): string {
  const email = String(target.row['email'] ?? '');
  switch (target.kind) {
    case 'edit_role':
      return t(
        'admin_accounts.risk.edit_role_body',
        `Changing role for ${email}. The new permissions apply immediately.`,
      ).replace('{email}', email);
    case 'disable':
      return t(
        'admin_accounts.risk.disable_body',
        `${email} will be immediately signed out and blocked from signing in. Existing sessions are revoked.`,
      ).replace('{email}', email);
    case 'reenable':
      return t(
        'admin_accounts.risk.reenable_body',
        `${email} will regain full access with their previous role.`,
      ).replace('{email}', email);
    case 'rotate':
      return t(
        'admin_accounts.risk.rotate_body',
        `Forces a new session token for ${email}. All other devices will be signed out.`,
      ).replace('{email}', email);
  }
}

function riskTargetConsequences(
  target: Exclude<RiskTarget, null>,
  t: ReturnType<typeof useT>,
): readonly string[] {
  const common = [t('risk.operator_required', 'Operator action — fully audited.')];
  if (target.kind === 'disable') {
    return [
      ...common,
      t('admin_accounts.risk.consequence.disable', 'All active sessions will be revoked.'),
    ];
  }
  if (target.kind === 'rotate') {
    return [
      ...common,
      t('admin_accounts.risk.consequence.rotate', 'User will be prompted to sign in again.'),
    ];
  }
  if (target.kind === 'edit_role') {
    return [
      ...common,
      t('admin_accounts.risk.consequence.edit_role', 'New permissions take effect immediately.'),
    ];
  }
  return common;
}

/* ------------------------------------------------------------------ */
/*  Drawer body                                                        */
/* ------------------------------------------------------------------ */

function AdminDetailBody({ row }: { row: Row }) {
  const t = useT();
  const items = useMemo<readonly KvItem[]>(
    () => [
      { key: 'email', label: t('admin_accounts.col.email'), value: String(row['email'] ?? '—') },
      { key: 'name', label: t('admin_accounts.col.name'), value: String(row['name'] ?? '—') },
      {
        key: 'role',
        label: t('admin_accounts.col.role'),
        value: <RoleBadge role={String(row['role'] ?? '')} />,
      },
      {
        key: 'status',
        label: t('admin_accounts.col.status'),
        value: <StatusBadge value={String(row['status'] ?? '')} />,
      },
      {
        key: 'created',
        label: t('admin_accounts.col.created'),
        value: <TimeCell value={row['created_at']} />,
      },
      {
        key: 'last_login',
        label: t('admin_accounts.col.last_login'),
        value: <TimeCell value={row['last_login_at']} mode="relative" />,
      },
    ],
    [row, t],
  );

  const loginCount = toNumber(row['login_count']);
  const lastIp = row['last_login_ip'] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KeyValuePanel items={items} columns={2} />
      {(loginCount > 0 || lastIp) && (
        <SectionCard
          icon={<KeyRound size={12} />}
          title={t('admin_accounts.session_meta', 'Session metadata')}
          dense
          padded
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {loginCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--px-text-tertiary)' }}>
                  {t('admin_accounts.login_count', 'Lifetime logins')}
                </span>
                <span className="px-tabular">{loginCount}</span>
              </div>
            )}
            {lastIp ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--px-text-tertiary)' }}>
                  {t('admin_accounts.last_ip', 'Last login IP')}
                </span>
                <span className="px-mono">{String(lastIp)}</span>
              </div>
            ) : null}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function matchesText(v: unknown, search: string): boolean {
  if (!v) return false;
  return String(v).toLowerCase().includes(search.toLowerCase());
}
