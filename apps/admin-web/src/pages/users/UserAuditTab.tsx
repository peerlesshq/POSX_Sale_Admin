/**
 * UserAuditTab — audit timeline + action panel.
 *
 * Left: vertical timeline of every admin log entry where
 *       `target_id === walletAddress`. Click a row to open a drawer
 *       with the raw JSON.
 * Right: compact "Available actions" card pointing at common ops.
 *
 * This tab consumes the view model's already-filtered `audit` list
 * — the page owner is responsible for filtering the raw admin logs
 * by target_id before building the view model.
 */
import { Drawer } from 'antd';
import {
  Activity,
  ArrowUpRight,
  BadgeAlert,
  FileText,
  Layers,
  Network as NetworkIcon,
  ShieldAlert,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  EmptyState,
  JsonViewer,
  SectionCard,
  TimeCell,
} from '../../components/shared';
import { useT } from '../../lib/i18n';
import type { UserAuditRow, UserDetailViewModel } from '../../services/user/userViewModel';

interface UserAuditTabProps {
  readonly vm: UserDetailViewModel;
  readonly onChangeStatus: () => void;
}

export const UserAuditTab: FC<UserAuditTabProps> = ({ vm, onChangeStatus }) => {
  const t = useT();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<UserAuditRow | null>(null);

  return (
    <div className="up-audit">
      <div className="up-audit__grid">
        {/* Timeline */}
        <SectionCard
          title={t('users.audit.timeline')}
          hint={t('users.audit.timeline_hint')}
          padded={false}
          status={vm.audit.length === 0 ? 'empty' : 'idle'}
          emptyTitle={t('users.audit.empty_title')}
          emptySubtitle={t('users.audit.empty_subtitle')}
        >
          {vm.audit.length > 0 && (
            <div className="up-audit-timeline">
              {vm.audit.map((row, idx) => (
                <TimelineRow
                  key={row.id || `${row.action}-${idx}`}
                  row={row}
                  isLast={idx === vm.audit.length - 1}
                  onOpen={() => setSelected(row)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Action panel */}
        <SectionCard title={t('users.audit.actions')} hint={t('users.audit.actions_hint')}>
          <div className="up-audit-actions">
            <ActionRow
              icon={<ShieldAlert size={14} />}
              label={t('users.action.change_status')}
              severity="danger"
              onClick={onChangeStatus}
            />
            <ActionRow
              icon={<NetworkIcon size={14} />}
              label={t('users.action.tree')}
              onClick={() => navigate(`/users/${vm.identity.walletAddress}/tree`)}
            />
            <ActionRow
              icon={<FileText size={14} />}
              label={t('users.action.open_reports')}
              onClick={() => navigate('/reports')}
            />
            <ActionRow
              icon={<Layers size={14} />}
              label={t('users.action.open_logs')}
              onClick={() => navigate('/logs')}
            />
          </div>
        </SectionCard>
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={500}
        title={null}
        className="up-audit-drawer"
        destroyOnHidden
      >
        {selected ? (
          <div className="up-audit-drawer__body">
            <div className="up-audit-drawer__head">
              <div className="up-audit-drawer__eyebrow">{t('users.audit.detail')}</div>
              <div className="up-audit-drawer__title">{selected.action}</div>
              <div className="up-audit-drawer__sub">
                <TimeCell value={selected.createdAt} />
              </div>
            </div>
            <div className="up-audit-drawer__kv">
              <KvRow label={t('users.audit.admin_user')} value={selected.adminUserId} />
              <KvRow label={t('users.audit.target_type')} value={selected.targetType} />
              <KvRow label={t('users.audit.target_id')} value={<code>{selected.targetId}</code>} />
              <KvRow label={t('users.audit.created_at')} value={<TimeCell value={selected.createdAt} />} />
            </div>
            <div className="up-audit-drawer__raw-label">{t('drill.raw')}</div>
            <JsonViewer value={selected.original} maxHeight={240} />
          </div>
        ) : (
          <EmptyState />
        )}
      </Drawer>

      {/* Unused import silence */}
      <span style={{ display: 'none' }}>
        <Activity />
        <BadgeAlert />
      </span>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Timeline row                                                         */
/* --------------------------------------------------------------------- */

const TimelineRow: FC<{
  row: UserAuditRow;
  isLast: boolean;
  onOpen: () => void;
}> = ({ row, isLast, onOpen }) => {
  const t = useT();
  return (
    <div className={`up-audit-timeline__row ${isLast ? 'up-audit-timeline__row--last' : ''}`}>
      <div className="up-audit-timeline__rail">
        <span className="up-audit-timeline__dot" />
        {!isLast && <span className="up-audit-timeline__line" />}
      </div>
      <div className="up-audit-timeline__card" onClick={onOpen}>
        <div className="up-audit-timeline__top">
          <span className="up-audit-timeline__action">{row.action}</span>
          <span className="up-audit-timeline__actor">
            {t('users.audit.by')} <code>{row.adminUserId}</code>
          </span>
        </div>
        <div className="up-audit-timeline__meta">
          <span>
            <span className="up-audit-timeline__label">{t('users.audit.target_type')}:</span>{' '}
            {row.targetType}
          </span>
          <span>
            <span className="up-audit-timeline__label">{t('users.audit.when')}:</span>{' '}
            <TimeCell value={row.createdAt} mode="relative" />
          </span>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------- */
/*  Action panel row                                                     */
/* --------------------------------------------------------------------- */

const ActionRow: FC<{
  icon: ReactNode;
  label: ReactNode;
  severity?: 'default' | 'danger';
  onClick: () => void;
}> = ({ icon, label, severity = 'default', onClick }) => (
  <button
    type="button"
    className={`up-audit-action up-audit-action--${severity}`}
    onClick={onClick}
  >
    <span className="up-audit-action__icon">{icon}</span>
    <span className="up-audit-action__label">{label}</span>
    <ArrowUpRight size={12} className="up-audit-action__arrow" />
  </button>
);

const KvRow: FC<{ label: ReactNode; value: ReactNode }> = ({ label, value }) => (
  <div className="up-audit-drawer__kv-row">
    <div className="up-audit-drawer__kv-label">{label}</div>
    <div className="up-audit-drawer__kv-value">{value}</div>
  </div>
);
