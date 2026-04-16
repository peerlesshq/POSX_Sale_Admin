/**
 * Card / SectionCard — the single surface primitive for user-web.
 *
 * `Card` is a raw surface with border + radius + padding. Use it for
 * anything that wants a bordered background.
 *
 * `SectionCard` is Card + an optional header strip (title + hint +
 * trailing action slot). Use it when a page section needs a titled
 * block that sits next to other titled blocks.
 */
import type { ReactNode } from 'react';

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly padded?: boolean;
}

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <div
      className={[
        'rounded-lg border border-slate-200 dark:border-slate-800',
        'bg-white/70 dark:bg-slate-900/60',
        'backdrop-blur-[1px]',
        padded ? 'p-4' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

interface SectionCardProps {
  readonly title?: ReactNode;
  readonly hint?: ReactNode;
  readonly action?: ReactNode;
  readonly padded?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export function SectionCard({
  title,
  hint,
  action,
  padded = true,
  children,
  className = '',
}: SectionCardProps) {
  const hasHeader = Boolean(title || action);

  return (
    <Card className={className} padded={false}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="min-w-0">
            {title && (
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </div>
            )}
            {hint && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hint}
              </div>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </Card>
  );
}
