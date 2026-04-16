/**
 * Composable filter field primitives — Phase 1 remediation.
 *
 * Before: `FilterBar` was a generic slot, `GlobalFilterBar` was a
 * hard-coded analytics strip. Pages had to pick one or fork.
 *
 * Now: every concrete filter field is an exported component that can
 * be dropped into either wrapper. `<GlobalFilterBar>` is rewritten as
 * a convenience composition of these fields, and custom pages can
 * build their own combinations from the same primitives.
 *
 * Usage:
 *   <FilterBar onReset={reset} onRefresh={refetch}>
 *     <TimeRangeField value={range} onChange={setRange} />
 *     <WalletField value={wallet} onChange={setWallet} />
 *     <StatusField value={status} onChange={setStatus} options={statuses} />
 *   </FilterBar>
 */
import { Input, Select } from 'antd';
import type { FC, ReactNode } from 'react';

import { t } from '../../lib/i18n';
import type { TimeRange } from '../../lib/timeRange';

import { TimeRangeFilter } from './TimeRangeFilter';

import './filterFields.css';

/* ------------------------------------------------------------------ */
/*  FilterField — label + control wrapper                              */
/* ------------------------------------------------------------------ */

interface FilterFieldFrameProps {
  readonly label: ReactNode;
  readonly children: ReactNode;
  readonly minWidth?: number | string;
  readonly hint?: ReactNode;
}

export const FilterFieldFrame: FC<FilterFieldFrameProps> = ({
  label,
  children,
  minWidth = 160,
  hint,
}) => (
  <div className="px-ff" style={{ minWidth }}>
    <label className="px-ff__label">{label}</label>
    {children}
    {hint && <div className="px-ff__hint">{hint}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/*  TimeRangeField                                                     */
/* ------------------------------------------------------------------ */

interface TimeRangeFieldProps {
  readonly value: TimeRange;
  readonly onChange: (next: TimeRange) => void;
  readonly label?: ReactNode;
  readonly noFrame?: boolean;
}

export const TimeRangeField: FC<TimeRangeFieldProps> = ({
  value,
  onChange,
  label,
  noFrame = false,
}) => {
  const inner = <TimeRangeFilter value={value} onChange={onChange} />;
  if (noFrame) return inner;
  return (
    <FilterFieldFrame label={label ?? t('filters.range', 'Range')} minWidth={240}>
      {inner}
    </FilterFieldFrame>
  );
};

/* ------------------------------------------------------------------ */
/*  WalletField                                                        */
/* ------------------------------------------------------------------ */

interface WalletFieldProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder?: string;
  readonly label?: ReactNode;
  readonly minWidth?: number | string;
}

export const WalletField: FC<WalletFieldProps> = ({
  value,
  onChange,
  placeholder,
  label,
  minWidth = 220,
}) => (
  <FilterFieldFrame label={label ?? t('filters.wallet', 'Wallet')} minWidth={minWidth}>
    <Input
      allowClear
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t('filters.wallet_placeholder', '0x…')}
      className="px-ff__input"
    />
  </FilterFieldFrame>
);

/* ------------------------------------------------------------------ */
/*  SelectField — generic select with label                            */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly options: readonly SelectOption[];
  readonly label: ReactNode;
  readonly placeholder?: string;
  readonly minWidth?: number | string;
}

export const SelectField: FC<SelectFieldProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder,
  minWidth = 180,
}) => (
  <FilterFieldFrame label={label} minWidth={minWidth}>
    <Select<string>
      allowClear
      value={value || undefined}
      onChange={(v) => onChange(v ?? '')}
      placeholder={placeholder ?? t('filters.any', 'Any')}
      options={options as SelectOption[]}
      className="px-ff__select"
    />
  </FilterFieldFrame>
);

/* ------------------------------------------------------------------ */
/*  TierField                                                          */
/* ------------------------------------------------------------------ */

interface TierFieldProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly tiers?: readonly SelectOption[];
}

export const TierField: FC<TierFieldProps> = ({ value, onChange, tiers }) => (
  <SelectField
    label={t('filters.tier', 'Tier')}
    value={value}
    onChange={onChange}
    options={
      tiers ?? [
        { value: 'basic', label: t('tier.basic', 'Basic') },
        { value: 'advanced', label: t('tier.advanced', 'Advanced') },
        { value: 'elite', label: t('tier.elite', 'Elite') },
      ]
    }
  />
);

/* ------------------------------------------------------------------ */
/*  StatusField                                                        */
/* ------------------------------------------------------------------ */

interface StatusFieldProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly statuses?: readonly SelectOption[];
}

export const StatusField: FC<StatusFieldProps> = ({ value, onChange, statuses }) => (
  <SelectField
    label={t('filters.status', 'Status')}
    value={value}
    onChange={onChange}
    options={
      statuses ?? [
        { value: 'active', label: t('status.active', 'Active') },
        { value: 'claimable', label: t('status.claimable', 'Claimable') },
        { value: 'claimed', label: t('status.claimed', 'Claimed') },
        { value: 'pending', label: t('status.pending', 'Pending') },
        { value: 'burned', label: t('status.burned', 'Burned') },
      ]
    }
  />
);

/* ------------------------------------------------------------------ */
/*  AmountRangeField                                                   */
/* ------------------------------------------------------------------ */

interface AmountRangeFieldProps {
  readonly min: string;
  readonly max: string;
  readonly onChange: (next: { min: string; max: string }) => void;
  readonly label?: ReactNode;
  readonly minWidth?: number | string;
}

export const AmountRangeField: FC<AmountRangeFieldProps> = ({
  min,
  max,
  onChange,
  label,
  minWidth = 240,
}) => (
  <FilterFieldFrame label={label ?? t('filters.amount', 'Amount')} minWidth={minWidth}>
    <div className="px-ff__amount">
      <Input
        value={min}
        onChange={(e) => onChange({ min: e.target.value, max })}
        placeholder={t('filters.min', 'Min')}
        className="px-ff__amount-input"
      />
      <span className="px-ff__amount-sep">–</span>
      <Input
        value={max}
        onChange={(e) => onChange({ min, max: e.target.value })}
        placeholder={t('filters.max', 'Max')}
        className="px-ff__amount-input"
      />
    </div>
  </FilterFieldFrame>
);

/* ------------------------------------------------------------------ */
/*  TextField — generic text search                                    */
/* ------------------------------------------------------------------ */

interface TextFieldProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label: ReactNode;
  readonly placeholder?: string;
  readonly minWidth?: number | string;
}

export const TextField: FC<TextFieldProps> = ({
  value,
  onChange,
  label,
  placeholder,
  minWidth = 200,
}) => (
  <FilterFieldFrame label={label} minWidth={minWidth}>
    <Input
      allowClear
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-ff__input"
    />
  </FilterFieldFrame>
);
