/**
 * RiskActionModal — the canonical high-risk confirmation dialog.
 *
 * Every destructive / impactful action must route through this modal:
 *   - Settlement trigger
 *   - Recompute apply
 *   - Config new version
 *   - User status change (suspend / blacklist)
 *   - Admin account create / role change
 *
 * Requirements enforced by this component:
 *   1. A clear risk banner at the top stating the action.
 *   2. A "consequences" bullet list the caller supplies.
 *   3. A required reason textarea that is always logged.
 *   4. Optional `confirmPhrase` — the operator must type a specific
 *      phrase to enable the confirm button. Used for truly irreversible
 *      actions.
 *   5. The primary button is red/destructive by default but can be
 *      toned down to neutral for "Apply" style actions.
 */
import { ExclamationCircleFilled, WarningFilled } from '@ant-design/icons';
import { Input, Modal } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { t } from '../../lib/i18n';

import './RiskActionModal.css';

interface RiskActionModalProps {
  open: boolean;
  title?: string;
  description?: string;
  consequences?: readonly string[];
  /** Optional phrase the operator must type verbatim to enable confirm. */
  confirmPhrase?: string;
  /** Operator label shown on the confirm button. */
  confirmText?: string;
  cancelText?: string;
  /**
   * Severity affects banner color and button variant. "critical" is the
   * most alarming (red). "high" is amber. "medium" is neutral.
   */
  severity?: 'medium' | 'high' | 'critical';
  /** If true, the reason textarea is mandatory (default true). */
  reasonRequired?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  loading?: boolean;
  /** Extra form controls (e.g. target status select) rendered above reason. */
  children?: ReactNode;
}

export function RiskActionModal({
  open,
  title,
  description,
  consequences = [],
  confirmPhrase,
  confirmText,
  cancelText,
  severity = 'high',
  reasonRequired = true,
  onCancel,
  onConfirm,
  loading = false,
  children,
}: RiskActionModalProps) {
  const [reason, setReason] = useState('');
  const [phraseInput, setPhraseInput] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      setPhraseInput('');
    }
  }, [open]);

  const disabled = useMemo(() => {
    if (loading) return true;
    if (reasonRequired && !reason.trim()) return true;
    if (confirmPhrase && phraseInput.trim() !== confirmPhrase) return true;
    return false;
  }, [loading, reason, reasonRequired, confirmPhrase, phraseInput]);

  const handleOk = async () => {
    if (disabled) return;
    await onConfirm(reason.trim());
  };

  const severityClass = `px-risk px-risk--${severity}`;

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={confirmText ?? t('common.confirm')}
      cancelText={cancelText ?? t('common.cancel')}
      okButtonProps={{ danger: severity === 'critical', disabled, loading }}
      maskClosable={!loading}
      centered
      width={560}
      className="px-risk-modal"
    >
      <div className={severityClass}>
        <div className="px-risk__header">
          <div className="px-risk__icon">
            {severity === 'critical' ? <ExclamationCircleFilled /> : <WarningFilled />}
          </div>
          <div>
            <div className="px-risk__title">{title ?? t('risk.confirm_title')}</div>
            {description && <div className="px-risk__description">{description}</div>}
          </div>
        </div>

        {consequences.length > 0 && (
          <div className="px-risk__consequences">
            <div className="px-risk__consequences-title">{t('risk.consequences')}</div>
            <ul>
              {consequences.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {children && <div className="px-risk__children">{children}</div>}

        {reasonRequired && (
          <div className="px-risk__field">
            <label className="px-risk__label">
              {t('common.danger_zone')} · {t('risk.reason_required')}
            </label>
            <Input.TextArea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('risk.reason_required')}
              disabled={loading}
            />
          </div>
        )}

        {confirmPhrase && (
          <div className="px-risk__field">
            <label className="px-risk__label">{t('risk.type_phrase_hint')}</label>
            <Input
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              placeholder={confirmPhrase}
              disabled={loading}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
