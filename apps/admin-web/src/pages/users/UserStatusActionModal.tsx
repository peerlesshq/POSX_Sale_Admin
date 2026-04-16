/**
 * UserStatusActionModal — professional status-change flow.
 *
 * Wraps the canonical `RiskActionModal`. The wrapper contributes:
 *
 *   - A `targetStatus` Select (restricted_purchase / restricted_claim
 *     / suspended / blacklisted)
 *   - Severity inference from the target status — critical for
 *     suspended / blacklisted, high for restricted_*
 *   - Different consequences and confirmation phrases per severity
 *   - A header strip showing the current → target transition
 *
 * The page owns the fetch/submit step and passes a `onConfirm`
 * callback that `await`s the actual API call.
 */
import { Select } from 'antd';
import { ArrowRight } from 'lucide-react';
import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { RiskActionModal, StatusBadge } from '../../components/shared';
import { useT } from '../../lib/i18n';

export type UserStatus =
  | 'active'
  | 'restricted_purchase'
  | 'restricted_claim'
  | 'suspended'
  | 'blacklisted';

interface UserStatusActionModalProps {
  readonly open: boolean;
  readonly walletAddress: string;
  readonly currentStatus: UserStatus | string;
  readonly onCancel: () => void;
  readonly onConfirm: (payload: {
    targetStatus: UserStatus;
    reason: string;
  }) => Promise<void>;
  readonly loading?: boolean;
}

const STATUS_OPTIONS: UserStatus[] = [
  'active',
  'restricted_purchase',
  'restricted_claim',
  'suspended',
  'blacklisted',
];

export const UserStatusActionModal: FC<UserStatusActionModalProps> = ({
  open,
  walletAddress,
  currentStatus,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const t = useT();
  const [target, setTarget] = useState<UserStatus>(
    inferInitialTarget(currentStatus as UserStatus),
  );

  const severity = useMemo<'medium' | 'high' | 'critical'>(() => {
    if (target === 'suspended' || target === 'blacklisted') return 'critical';
    if (target === 'restricted_purchase' || target === 'restricted_claim') return 'high';
    return 'medium';
  }, [target]);

  const consequences = useMemo(() => {
    switch (target) {
      case 'restricted_purchase':
        return [
          t('users.status.restricted_purchase.c1'),
          t('users.status.restricted_purchase.c2'),
        ];
      case 'restricted_claim':
        return [
          t('users.status.restricted_claim.c1'),
          t('users.status.restricted_claim.c2'),
        ];
      case 'suspended':
        return [
          t('users.status.suspended.c1'),
          t('users.status.suspended.c2'),
          t('users.status.suspended.c3'),
        ];
      case 'blacklisted':
        return [
          t('users.status.blacklisted.c1'),
          t('users.status.blacklisted.c2'),
          t('users.status.blacklisted.c3'),
        ];
      default:
        return [t('users.status.active.c1')];
    }
  }, [target, t]);

  // High-risk targets require the operator to type "CONFIRM".
  const confirmPhrase =
    target === 'suspended' || target === 'blacklisted' ? 'CONFIRM' : undefined;

  const handleConfirm = async (reason: string) => {
    await onConfirm({ targetStatus: target, reason });
  };

  return (
    <RiskActionModal
      open={open}
      severity={severity}
      title={t('users.change_status.title')}
      description={t('users.change_status.description')}
      consequences={consequences}
      confirmPhrase={confirmPhrase}
      loading={loading}
      onCancel={onCancel}
      onConfirm={handleConfirm}
    >
      <div className="usa-modal">
        <div className="usa-modal__transition">
          <div className="usa-modal__slot">
            <div className="usa-modal__slot-label">
              {t('users.change_status.current_label')}
            </div>
            <StatusBadge value={String(currentStatus)} />
          </div>
          <ArrowRight size={18} className="usa-modal__arrow" />
          <div className="usa-modal__slot">
            <div className="usa-modal__slot-label">
              {t('users.change_status.target_label')}
            </div>
            <StatusBadge value={target} />
          </div>
        </div>

        <div className="usa-modal__wallet">
          <span className="usa-modal__wallet-label">
            {t('users.change_status.wallet_label')}
          </span>
          <code className="usa-modal__wallet-value">{walletAddress}</code>
        </div>

        <div className="usa-modal__field">
          <label className="usa-modal__field-label">
            {t('users.change_status.target_select')}
          </label>
          <Select<UserStatus>
            value={target}
            onChange={(v) => setTarget(v)}
            className="usa-modal__select"
            options={STATUS_OPTIONS.map((s) => ({
              value: s,
              label: t(`status.${s}`, s),
            }))}
          />
        </div>
      </div>
    </RiskActionModal>
  );
};

function inferInitialTarget(current: UserStatus): UserStatus {
  // When the user clicks "change status" from an `active` row, the
  // most common intent is to restrict purchases. From a restricted
  // state, the common flow is to escalate to suspended. We only seed
  // a sane default — the operator always confirms explicitly.
  if (current === 'active') return 'restricted_purchase';
  if (current === 'restricted_purchase') return 'restricted_claim';
  if (current === 'restricted_claim') return 'suspended';
  if (current === 'suspended') return 'blacklisted';
  return 'active';
}
