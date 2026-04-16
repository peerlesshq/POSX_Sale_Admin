/**
 * Stat — compact single-metric display.
 *
 * Use inside Card / SectionCard. The label sits above the value so
 * multiple stats in a grid align on their baselines.
 *
 * `tone` tints the value color for semantic emphasis:
 *   default  — slate (same as body)
 *   brand    — brand indigo
 *   success  — emerald green
 *   warning  — amber
 *   danger   — rose red
 */
import type { ReactNode } from 'react';

type Tone = 'default' | 'brand' | 'success' | 'warning' | 'danger';

interface StatProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly tone?: Tone;
}

const TONE_STYLES: Record<Tone, string> = {
  default: 'text-slate-900 dark:text-slate-100',
  brand: 'text-brand-600 dark:text-brand-500',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
};

export function Stat({ label, value, hint, tone = 'default' }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
        {label}
      </div>
      <div
        className={['text-xl font-semibold mt-1 tabular-nums truncate', TONE_STYLES[tone]]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
          {hint}
        </div>
      )}
    </div>
  );
}
