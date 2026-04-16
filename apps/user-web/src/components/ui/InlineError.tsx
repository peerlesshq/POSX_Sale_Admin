/**
 * InlineError — retry-capable error surface.
 *
 * Replaces the `<p className="text-red-500 text-xs">{msg}</p>` pattern
 * that every page shipped (UF-11). Supports:
 *   - Icon + message
 *   - Optional retry button wired to the caller's retry function
 *   - Optional details text
 *   - Tone variants (danger / warning)
 */
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { Button } from './Button';

interface InlineErrorProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly tone?: 'danger' | 'warning';
  readonly compact?: boolean;
}

export const InlineError: FC<InlineErrorProps> = ({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  tone = 'danger',
  compact = false,
}) => {
  const toneBorder =
    tone === 'warning'
      ? 'border-amber-200 dark:border-amber-900'
      : 'border-rose-200 dark:border-rose-900';
  const toneBg =
    tone === 'warning'
      ? 'bg-amber-50/70 dark:bg-amber-950/30'
      : 'bg-rose-50/70 dark:bg-rose-950/30';
  const toneText =
    tone === 'warning'
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-rose-800 dark:text-rose-300';
  const toneIcon =
    tone === 'warning'
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-rose-500 dark:text-rose-400';

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 rounded-lg border',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        toneBorder,
        toneBg,
      ].join(' ')}
    >
      <AlertCircle size={compact ? 14 : 16} className={['mt-0.5 flex-shrink-0', toneIcon].join(' ')} />
      <div className="flex-1 min-w-0">
        <div className={['text-sm font-medium', toneText].join(' ')}>{title}</div>
        {description && (
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 break-words">
            {description}
          </div>
        )}
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw size={12} />}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
