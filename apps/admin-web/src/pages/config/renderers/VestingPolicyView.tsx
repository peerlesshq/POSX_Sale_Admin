/**
 * VestingPolicyView — renderer for `vesting_rules.vesting_policy`.
 *
 * Displays lock + release durations as a simple time-budget card
 * with an inline progress visualisation so operators can see at a
 * glance how long tokens stay locked vs. released.
 */
import { Lock, Timer } from 'lucide-react';
import type { FC } from 'react';

import { useT } from '../../../lib/i18n';

interface VestingValue {
  readonly lock_days?: number | string;
  readonly release_days?: number | string;
  readonly mode?: string;
}

export const VestingPolicyView: FC<{ value: Record<string, unknown> }> = ({ value }) => {
  const t = useT();
  const v = value as VestingValue;

  const lock = toNum(v.lock_days);
  const release = toNum(v.release_days);
  const total = lock + release;
  const lockPct = total > 0 ? (lock / total) * 100 : 0;

  return (
    <div className="cfg-render cfg-render--vesting">
      <div className="cfg-metric-grid">
        <MetricBlock
          icon={<Lock size={13} />}
          label={t('config.render.vesting.lock')}
          value={`${lock} ${t('config.render.vesting.days')}`}
        />
        <MetricBlock
          icon={<Timer size={13} />}
          label={t('config.render.vesting.release')}
          value={`${release} ${t('config.render.vesting.days')}`}
        />
        <MetricBlock
          label={t('config.render.vesting.mode')}
          value={v.mode ?? '—'}
        />
      </div>

      <div className="cfg-vesting-bar">
        <div className="cfg-vesting-bar__label">
          <span>{t('config.render.vesting.bar_label')}</span>
          <span className="px-tabular">
            {lock + release} {t('config.render.vesting.days')}
          </span>
        </div>
        <div className="cfg-vesting-bar__track">
          <div
            className="cfg-vesting-bar__lock"
            style={{ width: `${lockPct}%` }}
            title={`${t('config.render.vesting.lock')}: ${lock}d`}
          />
          <div
            className="cfg-vesting-bar__release"
            style={{ width: `${100 - lockPct}%` }}
            title={`${t('config.render.vesting.release')}: ${release}d`}
          />
        </div>
        <div className="cfg-vesting-bar__legend">
          <span>
            <span className="cfg-vesting-bar__swatch cfg-vesting-bar__swatch--lock" />
            {t('config.render.vesting.lock')}
          </span>
          <span>
            <span className="cfg-vesting-bar__swatch cfg-vesting-bar__swatch--release" />
            {t('config.render.vesting.release')}
          </span>
        </div>
      </div>
    </div>
  );
};

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

const MetricBlock: FC<{ icon?: JSX.Element; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="cfg-metric-block">
    <div className="cfg-metric-block__label">
      {icon}
      {label}
    </div>
    <div className="cfg-metric-block__value px-tabular">{value}</div>
  </div>
);
