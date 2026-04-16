/**
 * BrandLogo — POSX wordmark + glyph.
 *
 * Previously user-web had zero brand presence (just `POSX` rendered
 * as `text-lg font-semibold`). This component provides a consistent
 * brand surface across the header, landing, and footer.
 *
 * Variants:
 *   - 'full'  — glyph + wordmark (default, used in header + landing)
 *   - 'mark'  — glyph only (used on mobile + loading screens)
 *   - 'wordmark' — wordmark only (footer)
 *
 * The glyph is a stylized "P" built as an inline SVG using the brand
 * gradient. Dependency-free.
 */
import type { FC } from 'react';

interface BrandLogoProps {
  readonly variant?: 'full' | 'mark' | 'wordmark';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const SIZE_MAP = {
  sm: { glyph: 20, text: 'text-base' },
  md: { glyph: 24, text: 'text-lg' },
  lg: { glyph: 32, text: 'text-2xl' },
} as const;

export const BrandLogo: FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
}) => {
  const { glyph, text } = SIZE_MAP[size];

  return (
    <span
      className={[
        'inline-flex items-center gap-2 select-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="POSX"
    >
      {variant !== 'wordmark' && <Glyph size={glyph} />}
      {variant !== 'mark' && (
        <span
          className={[
            'font-bold tracking-tight',
            text,
            'text-slate-900 dark:text-slate-100',
          ].join(' ')}
        >
          POSX
        </span>
      )}
    </span>
  );
};

const Glyph: FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id="posx-glyph-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#5b5bff" />
        <stop offset="100%" stopColor="#8087ff" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="url(#posx-glyph-grad)" />
    <path
      d="M10 9h8.5a5 5 0 0 1 0 10H13v4h-3V9Zm3 3v4h5.2a2 2 0 0 0 0-4H13Z"
      fill="#fff"
    />
  </svg>
);
