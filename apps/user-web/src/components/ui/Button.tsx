/**
 * Button — the single button primitive for user-web.
 *
 * Variants:
 *   primary   — brand-filled CTA (purchase, claim)
 *   secondary — outline / ghost
 *   danger    — destructive action
 *
 * Sizes:
 *   md (default) — 40px tall, meets iOS 44px after font baseline
 *   sm           — 32px tall, use only in dense inline contexts
 *   lg           — 48px tall, hero CTAs
 *
 * All variants ship with `disabled:opacity-50` and a consistent focus
 * ring. No page should roll its own button class string.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly fullWidth?: boolean;
  readonly leftIcon?: ReactNode;
  readonly rightIcon?: ReactNode;
  readonly loading?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 ' +
    'disabled:hover:bg-brand-600',
  secondary:
    'bg-transparent border border-slate-300 dark:border-slate-700 ' +
    'text-slate-900 dark:text-slate-100 ' +
    'hover:bg-slate-100 dark:hover:bg-slate-800/70 ' +
    'active:bg-slate-100 dark:active:bg-slate-800',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-700 ' +
    'disabled:hover:bg-red-600',
  ghost:
    'bg-transparent text-slate-600 dark:text-slate-300 ' +
    'hover:bg-slate-100 dark:hover:bg-slate-800/50',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2',
        'rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
