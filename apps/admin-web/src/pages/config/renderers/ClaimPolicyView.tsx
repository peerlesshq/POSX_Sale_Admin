/**
 * ClaimPolicyView — renderer for `claim_rules.claim_policy`.
 *
 * Shows minimum claim amount, default claim scope, per-type toggle,
 * and pending signature TTL as a structured metric grid with a
 * small explanation strip.
 */
import { Check, Minus } from 'lucide-react';
import type { FC } from 'react';

import { useT } from '../../../lib/i18n';

interface ClaimPolicyValue {
  readonly min_claim_amount?: string;
  readonly claim_scope_default?: string;
  readonly allow_claim_by_type?: boolean;
  readonly pending_signature_ttl_minutes?: number;
}

export const ClaimPolicyView: FC<{ value: Record<string, unknown> }> = ({ value }) => {
  const t = useT();
  const v = value as ClaimPolicyValue;

  return (
    <div className="cfg-render cfg-render--claim">
      <div className="cfg-metric-grid">
        <div className="cfg-metric-block">
          <div className="cfg-metric-block__label">
            {t('config.render.claim.min_amount')}
          </div>
          <div className="cfg-metric-block__value px-tabular">
            {v.min_claim_amount ?? '—'} <span className="cfg-metric-block__unit">USDT</span>
          </div>
        </div>
        <div className="cfg-metric-block">
          <div className="cfg-metric-block__label">
            {t('config.render.claim.default_scope')}
          </div>
          <div className="cfg-metric-block__value">
            {v.claim_scope_default ?? '—'}
          </div>
        </div>
        <div className="cfg-metric-block">
          <div className="cfg-metric-block__label">
            {t('config.render.claim.by_type')}
          </div>
          <div className="cfg-metric-block__value">
            {v.allow_claim_by_type ? (
              <span className="cfg-flag cfg-flag--yes">
                <Check size={13} />
                {t('common.enabled')}
              </span>
            ) : (
              <span className="cfg-flag cfg-flag--no">
                <Minus size={13} />
                {t('common.disabled')}
              </span>
            )}
          </div>
        </div>
        <div className="cfg-metric-block">
          <div className="cfg-metric-block__label">
            {t('config.render.claim.ttl')}
          </div>
          <div className="cfg-metric-block__value px-tabular">
            {v.pending_signature_ttl_minutes ?? '—'}{' '}
            <span className="cfg-metric-block__unit">min</span>
          </div>
        </div>
      </div>
    </div>
  );
};
