/**
 * TierDefinitionsView — renderer for `tier_rules.tier_definitions`.
 *
 * Renders a professional tier grid with columns for tier code,
 * display name, holding range, deposit minimum, direct rate, and
 * team eligibility. Closed-ended and open-ended ranges are both
 * rendered correctly (∞ for `holding_max: null`).
 */
import { CheckCircle2, XCircle } from 'lucide-react';
import type { FC } from 'react';

import { formatCompactUsdt } from '../../../lib/format';
import { useT } from '../../../lib/i18n';

interface TierEntry {
  tier_code: string;
  display_name: string;
  holding_min: string;
  holding_max: string | null;
  deposit_min: string;
  direct_rate: string;
  team_eligible: boolean;
}

interface TierValue {
  readonly tiers?: readonly TierEntry[];
}

export const TierDefinitionsView: FC<{ value: Record<string, unknown> }> = ({ value }) => {
  const t = useT();
  const v = value as TierValue;
  const tiers = v.tiers ?? [];

  if (tiers.length === 0) {
    return <div className="cfg-render-empty">{t('config.render.empty')}</div>;
  }

  return (
    <div className="cfg-render cfg-render--tiers">
      <div className="cfg-render__legend">
        <span>{t('config.render.tiers.legend')}</span>
      </div>
      <div className="cfg-tier-grid">
        <div className="cfg-tier-grid__head">
          <span>{t('config.render.tiers.col.tier')}</span>
          <span>{t('config.render.tiers.col.range')}</span>
          <span>{t('config.render.tiers.col.deposit_min')}</span>
          <span>{t('config.render.tiers.col.direct_rate')}</span>
          <span>{t('config.render.tiers.col.team_eligible')}</span>
        </div>
        {tiers.map((tier) => (
          <div key={tier.tier_code} className="cfg-tier-grid__row">
            <span className="cfg-tier-grid__tier">
              <span className={`cfg-tier-dot cfg-tier-dot--${tier.tier_code}`} />
              <span className="cfg-tier-grid__tier-name">{tier.display_name}</span>
              <code className="cfg-tier-grid__tier-code">{tier.tier_code}</code>
            </span>
            <span className="cfg-tier-grid__range px-tabular">
              {formatCompactUsdt(tier.holding_min)}
              {' – '}
              {tier.holding_max ? formatCompactUsdt(tier.holding_max) : '∞'}
            </span>
            <span className="cfg-tier-grid__deposit px-tabular">
              {formatCompactUsdt(tier.deposit_min)}
            </span>
            <span className="cfg-tier-grid__rate px-tabular">
              {formatRate(tier.direct_rate)}
            </span>
            <span className="cfg-tier-grid__flag">
              {tier.team_eligible ? (
                <span className="cfg-flag cfg-flag--yes">
                  <CheckCircle2 size={13} />
                  {t('common.yes')}
                </span>
              ) : (
                <span className="cfg-flag cfg-flag--no">
                  <XCircle size={13} />
                  {t('common.no')}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatRate(value: string | undefined): string {
  if (!value) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${(num * 100).toFixed(num < 0.1 ? 1 : 0)}%`;
}
