/**
 * EmptyHint — empty-state placeholder for list sections.
 *
 * Replaces literal English strings like "No records." and "No purchases
 * yet." across the user frontend.
 */
import type { ReactNode } from 'react';

interface EmptyHintProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
}

export function EmptyHint({ title, description, icon, action }: EmptyHintProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      {icon && (
        <div className="mb-3 text-slate-400 dark:text-slate-600">{icon}</div>
      )}
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {title}
      </div>
      {description && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
