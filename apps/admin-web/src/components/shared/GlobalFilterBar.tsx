/**
 * GlobalFilterBar — convenience wrapper that composes the filter field
 * primitives from `filterFields.tsx`.
 *
 * Previously this file hand-rolled its own JSX for TimeRangeFilter +
 * wallet + tier + status + amount, which produced a rival primitive
 * that could not be mixed with `FilterBar`. Now both surfaces share
 * the same child primitives, and this component is ~70 lines of
 * orchestration instead of ~180 lines of markup.
 *
 * The public API (`GlobalFilters`, `defaultFilters`, the boolean
 * `showWallet / showTier / showStatus / showAmount` props) is fully
 * preserved so existing call sites (Reports + Rewards sub-pages)
 * continue to work without changes.
 */
import { RefreshCcw, RotateCcw } from 'lucide-react';
import type { FC } from 'react';

import { resolveRange, type TimeRange } from '../../lib/timeRange';
import { useT } from '../../lib/i18n';

import {
  AmountRangeField,
  StatusField,
  TierField,
  TimeRangeField,
  WalletField,
  type SelectOption,
} from './filterFields';

import './GlobalFilterBar.css';

export interface GlobalFilters {
  readonly range: TimeRange;
  readonly wallet: string;
  readonly tier: string;
  readonly status: string;
  readonly amountMin: string;
  readonly amountMax: string;
}

export function defaultFilters(): GlobalFilters {
  return {
    range: resolveRange('30d'),
    wallet: '',
    tier: '',
    status: '',
    amountMin: '',
    amountMax: '',
  };
}

interface GlobalFilterBarProps {
  readonly filters: GlobalFilters;
  readonly onChange: (next: GlobalFilters) => void;
  readonly onRefresh?: () => void;
  readonly tiers?: readonly SelectOption[];
  readonly statuses?: readonly SelectOption[];
  readonly showWallet?: boolean;
  readonly showTier?: boolean;
  readonly showStatus?: boolean;
  readonly showAmount?: boolean;
}

export const GlobalFilterBar: FC<GlobalFilterBarProps> = ({
  filters,
  onChange,
  onRefresh,
  tiers,
  statuses,
  showWallet = true,
  showTier = true,
  showStatus = true,
  showAmount = false,
}) => {
  const t = useT();

  const update = (patch: Partial<GlobalFilters>) =>
    onChange({ ...filters, ...patch });
  const reset = () => onChange(defaultFilters());

  const hasFacets = showWallet || showTier || showStatus || showAmount;

  return (
    <div className="px-gfb">
      <div className="px-gfb__row px-gfb__row--time">
        <TimeRangeField
          value={filters.range}
          onChange={(range) => update({ range })}
          noFrame
        />
        <div className="px-gfb__actions">
          <button
            type="button"
            className="px-gfb__action"
            onClick={reset}
            title={t('common.reset')}
          >
            <RotateCcw size={13} />
            <span>{t('common.reset')}</span>
          </button>
          {onRefresh && (
            <button
              type="button"
              className="px-gfb__action"
              onClick={onRefresh}
              title={t('common.refresh')}
            >
              <RefreshCcw size={13} />
              <span>{t('common.refresh')}</span>
            </button>
          )}
        </div>
      </div>

      {hasFacets && (
        <div className="px-gfb__row px-gfb__row--facets">
          {showWallet && (
            <WalletField
              value={filters.wallet}
              onChange={(wallet) => update({ wallet })}
            />
          )}
          {showTier && (
            <TierField
              value={filters.tier}
              onChange={(tier) => update({ tier })}
              tiers={tiers}
            />
          )}
          {showStatus && (
            <StatusField
              value={filters.status}
              onChange={(status) => update({ status })}
              statuses={statuses}
            />
          )}
          {showAmount && (
            <AmountRangeField
              min={filters.amountMin}
              max={filters.amountMax}
              onChange={({ min, max }) =>
                update({ amountMin: min, amountMax: max })
              }
            />
          )}
        </div>
      )}
    </div>
  );
};
