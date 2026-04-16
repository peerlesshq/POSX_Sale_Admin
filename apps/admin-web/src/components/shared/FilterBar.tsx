/**
 * FilterBar — generic filter strip primitive.
 *
 * After Phase 1 merge: this is still the "freeform children" wrapper,
 * but it now composes with the same `filterFields.tsx` primitives used
 * by `GlobalFilterBar`. Pages can mix `<FilterBar>` with any
 * combination of `WalletField`, `TierField`, `StatusField`,
 * `AmountRangeField`, `TimeRangeField`, `SelectField`, or `TextField`.
 *
 * Example (post-merge):
 *   <FilterBar onReset={reset} onRefresh={refetch}>
 *     <TimeRangeField value={range} onChange={setRange} />
 *     <WalletField value={wallet} onChange={setWallet} />
 *     <StatusField value={status} onChange={setStatus} />
 *   </FilterBar>
 *
 * Legacy `FilterField` is still exported so callers using it via the
 * old API (label + raw children) continue to compile.
 */
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';

import { FilterFieldFrame } from './filterFields';

import './FilterBar.css';

interface FilterBarProps {
  children?: ReactNode;
  onReset?: () => void;
  onRefresh?: () => void;
  right?: ReactNode;
  /** Strip the header icon when inlining inside a SectionCard filter slot. */
  bare?: boolean;
}

export function FilterBar({
  children,
  onReset,
  onRefresh,
  right,
  bare = false,
}: FilterBarProps) {
  return (
    <div className={`px-filter-bar ${bare ? 'px-filter-bar--bare' : ''}`.trim()}>
      <div className="px-filter-bar__left">
        {!bare && <FilterOutlined className="px-filter-bar__icon" />}
        <div className="px-filter-bar__slots">{children}</div>
      </div>
      <div className="px-filter-bar__right">
        {onReset && (
          <Button size="small" onClick={onReset}>
            {t('common.reset')}
          </Button>
        )}
        {onRefresh && (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
            {t('common.refresh')}
          </Button>
        )}
        {right}
      </div>
    </div>
  );
}

/**
 * Legacy label + input wrapper. Prefer the field primitives in
 * `filterFields.tsx` (`WalletField`, `StatusField`, etc.) for new code.
 */
export function FilterField({
  label,
  children,
  width,
}: {
  label: string;
  children: ReactNode;
  width?: number | string;
}) {
  return (
    <FilterFieldFrame label={label} minWidth={width}>
      {children}
    </FilterFieldFrame>
  );
}
