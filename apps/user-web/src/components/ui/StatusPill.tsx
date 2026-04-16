/**
 * StatusPill — small colored label for reward types, purchase states,
 * team tiers, etc.
 */
import type { ReactNode } from 'react';

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusPillProps {
  readonly children: ReactNode;
  readonly tone?: Tone;
  readonly className?: string;
}

const TONE_STYLES: Record<Tone, string> = {
  brand:
    'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-500',
  neutral:
    'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
  success:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  warning:
    'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  danger:
    'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  info:
    'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

export function StatusPill({ children, tone = 'neutral', className = '' }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        TONE_STYLES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
