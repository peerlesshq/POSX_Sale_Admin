/**
 * PageShell — consistent page container (VH-03 audit remediation).
 *
 * Pages that use the standard PageHeader + content stack should
 * wrap themselves in this shell so spacing, max-width, and the
 * body background are identical across admin surfaces.
 *
 * Existing pages that render `<div>` at the root still work — this
 * is additive, not breaking.
 *
 * Props:
 *   - `children`: page content (usually `<PageHeader>` + rows)
 *   - `spacing`: row gap between stack children — default `md`
 *   - `maxWidth`: widen the container past the global 1680px for
 *     dense dashboards; `none` disables the max-width entirely
 *   - `className`: escape hatch for per-page class hooks
 */
import type { FC, ReactNode } from 'react';

import './PageShell.css';

interface PageShellProps {
  readonly children: ReactNode;
  readonly spacing?: 'sm' | 'md' | 'lg';
  readonly maxWidth?: 'normal' | 'wide' | 'none';
  readonly className?: string;
}

const SPACING_CLASS = {
  sm: 'px-page-shell--gap-sm',
  md: 'px-page-shell--gap-md',
  lg: 'px-page-shell--gap-lg',
} as const;

const MAX_WIDTH_CLASS = {
  normal: 'px-page-shell--normal',
  wide: 'px-page-shell--wide',
  none: 'px-page-shell--none',
} as const;

export const PageShell: FC<PageShellProps> = ({
  children,
  spacing = 'md',
  maxWidth = 'normal',
  className = '',
}) => (
  <div
    className={[
      'px-page-shell',
      SPACING_CLASS[spacing],
      MAX_WIDTH_CLASS[maxWidth],
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);
