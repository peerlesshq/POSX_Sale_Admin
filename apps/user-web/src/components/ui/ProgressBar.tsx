/**
 * ProgressBar — horizontal progress ring used for:
 *   - Invite unlock progress
 *   - Vesting release progress
 *   - Tier upgrade progress
 *
 * Previous state: NONE of these existed. The invite-locked page showed
 * "Threshold: X / Current: Y" as plain text, and users couldn't see at
 * a glance how close they were.
 */
import type { ReactNode } from 'react';

interface ProgressBarProps {
  readonly value: number;
  readonly max: number;
  readonly label?: ReactNode;
  readonly trailing?: ReactNode;
  readonly tone?: 'brand' | 'success' | 'warning' | 'danger';
}

const TONE_FILL: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  brand: 'bg-brand-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

export function ProgressBar({
  value,
  max,
  label,
  trailing,
  tone = 'brand',
}: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Math.max(0, Math.min(safeMax, Number.isFinite(value) ? value : 0));
  const pct = (safeValue / safeMax) * 100;

  return (
    <div>
      {(label || trailing) && (
        <div className="flex items-center justify-between mb-1.5 text-xs">
          {label && (
            <span className="text-slate-600 dark:text-slate-400">{label}</span>
          )}
          {trailing && (
            <span className="text-slate-900 dark:text-slate-100 font-medium tabular-nums">
              {trailing}
            </span>
          )}
        </div>
      )}
      <div
        className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
      >
        <div
          className={[
            'h-full rounded-full transition-[width] duration-300 ease-out',
            TONE_FILL[tone],
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
