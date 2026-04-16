/**
 * TimeRangeFilter — segmented preset selector + optional custom range.
 *
 * Mirrors the Fintech-dashboard pattern: a left segmented control with
 * Today / 7D / 30D / 90D / Custom, and (when Custom is selected) a
 * paired DatePicker range. Emits the canonical `TimeRange` value that
 * the rest of the analytics stack consumes.
 *
 * The component is fully controlled — callers hold the current preset
 * in state and feed a new one in on `onChange`.
 */
import { DatePicker, Segmented } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Clock } from 'lucide-react';
import type { FC } from 'react';
import { useMemo } from 'react';

import { resolveRange, type TimeRange, type TimeRangePreset } from '../../lib/timeRange';
import { useT } from '../../lib/i18n';

import './TimeRangeFilter.css';

interface TimeRangeFilterProps {
  readonly value: TimeRange;
  readonly onChange: (range: TimeRange) => void;
  readonly presets?: readonly TimeRangePreset[];
  /** Hide the UTC label on the right. Default false. */
  readonly compact?: boolean;
}

const DEFAULT_PRESETS: readonly TimeRangePreset[] = ['today', '7d', '30d', '90d', 'custom'];

export const TimeRangeFilter: FC<TimeRangeFilterProps> = ({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  compact = false,
}) => {
  const t = useT();

  const options = useMemo(
    () =>
      presets.map((preset) => ({
        label: t(`time_range.${preset}`),
        value: preset,
      })),
    [presets, t],
  );

  const handlePreset = (next: TimeRangePreset) => {
    if (next === 'custom') {
      // Keep existing custom range if present, otherwise seed with the
      // current non-custom range's span.
      if (value.preset === 'custom') {
        onChange(value);
      } else {
        const range = resolveRange('custom', value.from, new Date(value.to.getTime() - 1));
        onChange(range);
      }
      return;
    }
    onChange(resolveRange(next));
  };

  const handleCustomRange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) return;
    onChange(
      resolveRange('custom', dates[0].toDate(), dates[1].toDate()),
    );
  };

  return (
    <div className="px-time-range">
      <Segmented
        className="px-time-range__seg"
        value={value.preset}
        onChange={(v) => handlePreset(v as TimeRangePreset)}
        options={options}
        size="middle"
      />
      {value.preset === 'custom' && (
        <DatePicker.RangePicker
          className="px-time-range__picker"
          value={[dayjs(value.from), dayjs(value.to).subtract(1, 'day')]}
          onChange={(dates) =>
            handleCustomRange(dates as [Dayjs | null, Dayjs | null] | null)
          }
          allowClear={false}
        />
      )}
      {!compact && (
        <span className="px-time-range__label" title={value.label}>
          <Clock size={12} />
          <span>{value.label}</span>
        </span>
      )}
    </div>
  );
};
