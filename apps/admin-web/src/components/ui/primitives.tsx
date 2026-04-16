/**
 * UI primitives — purely visual atoms used across every page.
 *
 * These are intentionally thin. They set tokens, spacing, and
 * typography. No business logic.
 */
import type { CSSProperties, ReactNode } from 'react';

import './primitives.css';

type DivProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
};

/** Base surface container with border + radius. Use inside cards. */
export function Surface({ children, className = '', style, onClick }: DivProps) {
  return (
    <div
      className={`px-surface ${className}`.trim()}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** Keyboard hint chip — for the `⌘K` affordance. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-kbd">{children}</kbd>;
}

/** Row with flex + gap. */
export function Row({
  children,
  gap = 12,
  align = 'center',
  justify = 'flex-start',
  wrap = false,
  className,
  style,
}: {
  children?: ReactNode;
  gap?: number;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: align,
        justifyContent: justify,
        gap,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Column with flex + gap. */
export function Stack({
  children,
  gap = 12,
  align = 'stretch',
  className,
  style,
}: {
  children?: ReactNode;
  gap?: number;
  align?: CSSProperties['alignItems'];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Typography helpers. */
type TextVariant =
  | 'display'
  | 'title'
  | 'section'
  | 'body'
  | 'body-strong'
  | 'caption'
  | 'caption-strong'
  | 'micro';

const VARIANT_STYLE: Record<TextVariant, CSSProperties> = {
  display: { fontSize: 34, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.02em' },
  title: { fontSize: 22, lineHeight: 1.2, fontWeight: 600, letterSpacing: '-0.01em' },
  section: { fontSize: 14, lineHeight: 1.3, fontWeight: 600 },
  body: { fontSize: 13, lineHeight: 1.5 },
  'body-strong': { fontSize: 13, lineHeight: 1.5, fontWeight: 500 },
  caption: { fontSize: 12, lineHeight: 1.35 },
  'caption-strong': { fontSize: 12, lineHeight: 1.35, fontWeight: 500 },
  micro: { fontSize: 11, lineHeight: 1.3, letterSpacing: '0.02em' },
};

type TextTone = 'primary' | 'secondary' | 'tertiary' | 'muted' | 'brand' | 'ok' | 'warn' | 'err';

const TONE_COLOR: Record<TextTone, string> = {
  primary: 'var(--px-text-primary)',
  secondary: 'var(--px-text-secondary)',
  tertiary: 'var(--px-text-tertiary)',
  muted: 'var(--px-text-muted)',
  brand: 'var(--px-brand)',
  ok: 'var(--px-status-ok)',
  warn: 'var(--px-status-warn)',
  err: 'var(--px-status-err)',
};

export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  mono = false,
  tabular = false,
  uppercase = false,
  className,
  style,
  as: As = 'span',
}: {
  children?: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  mono?: boolean;
  tabular?: boolean;
  uppercase?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'label';
}) {
  const merged: CSSProperties = {
    ...VARIANT_STYLE[variant],
    color: TONE_COLOR[tone],
    fontFamily: mono ? 'var(--px-font-mono)' : undefined,
    fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
    textTransform: uppercase ? 'uppercase' : undefined,
    ...style,
  };
  return (
    <As className={className} style={merged}>
      {children}
    </As>
  );
}

/** Section divider. */
export function Divider({ spacing = 16 }: { spacing?: number }) {
  return (
    <div
      style={{
        margin: `${spacing}px 0`,
        borderTop: '1px solid var(--px-border-subtle)',
      }}
    />
  );
}

/** Loading skeleton block. */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="px-skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
