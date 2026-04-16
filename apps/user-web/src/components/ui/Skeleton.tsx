/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Replaces the `<div>Loading...</div>` strings that covered every
 * user-web page (UF-10). Variants:
 *   - `text` — inline single-line placeholder
 *   - `line` — standalone full-width line (use for multi-line bodies)
 *   - `block` — rounded rectangle (use for cards, charts, images)
 *   - `circle` — circular placeholder (avatars, QR tile)
 *
 * All variants share the same animated gradient so multiple skeletons
 * on one page visually relate to each other.
 */
import type { FC, ReactNode } from 'react';

interface SkeletonProps {
  readonly variant?: 'text' | 'line' | 'block' | 'circle';
  readonly width?: string | number;
  readonly height?: string | number;
  readonly className?: string;
  readonly rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED_MAP = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export const Skeleton: FC<SkeletonProps> = ({
  variant = 'block',
  width,
  height,
  className = '',
  rounded,
}) => {
  const shape =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
        ? 'rounded'
        : ROUNDED_MAP[rounded ?? 'md'];

  const sizing = (() => {
    if (variant === 'text') {
      return { width: width ?? '6rem', height: height ?? '0.8em' };
    }
    if (variant === 'line') {
      return { width: width ?? '100%', height: height ?? '0.9rem' };
    }
    if (variant === 'circle') {
      const d = width ?? height ?? '2.5rem';
      return { width: d, height: d };
    }
    return { width: width ?? '100%', height: height ?? '1rem' };
  })();

  const display = variant === 'text' ? 'inline-block align-middle' : 'block';

  return (
    <span
      aria-hidden
      className={[
        display,
        shape,
        'bg-slate-200 dark:bg-slate-800/70',
        'relative overflow-hidden',
        'px-skeleton',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: sizing.width, height: sizing.height }}
    />
  );
};

/**
 * SkeletonGroup — stack of Skeleton lines used in card bodies.
 */
interface SkeletonGroupProps {
  readonly rows?: number;
  readonly className?: string;
  readonly children?: ReactNode;
}

export const SkeletonGroup: FC<SkeletonGroupProps> = ({
  rows = 3,
  className = '',
  children,
}) => {
  if (children) {
    return <div className={['space-y-2', className].filter(Boolean).join(' ')}>{children}</div>;
  }
  return (
    <div className={['space-y-2', className].filter(Boolean).join(' ')}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          variant="line"
          width={i === rows - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
};
