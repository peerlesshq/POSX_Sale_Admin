/**
 * InfoRow — key/value row with optional tone, used in lists.
 *
 * Replaces inline `flex justify-between` + two spans across pages.
 */
import type { ReactNode } from 'react';

interface InfoRowProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly sublabel?: ReactNode;
  readonly accent?: ReactNode;
}

export function InfoRow({ label, value, sublabel, accent }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm text-slate-900 dark:text-slate-100 truncate">
          {label}
        </div>
        {sublabel && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {sublabel}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </div>
        {accent && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {accent}
          </div>
        )}
      </div>
    </div>
  );
}
