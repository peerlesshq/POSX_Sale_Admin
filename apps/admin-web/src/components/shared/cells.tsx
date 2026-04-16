/**
 * Data table cells — wallet, amount, percent, time, copyable hash,
 * error snippet, threshold gauge, role badge.
 * Extract once, reuse everywhere. Every cell is framework-friendly
 * (returns JSX, no requirement on AntD column valueType).
 */
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { Drawer, Tag, Tooltip, message } from 'antd';
import { Code2, ShieldCheck, UserCog } from 'lucide-react';
import { useState } from 'react';

import { t } from '../../lib/i18n';
import {
  formatCompactUsdt,
  formatDateTimeUtc,
  formatInt,
  formatPercent,
  formatRelativeTime,
  formatUsdt,
  truncateHash,
} from '../../lib/format';

import './cells.css';

/* ------------------------------------------------------------------
 * CopyableHashCell / WalletCell — truncated mono hash with copy action
 * ------------------------------------------------------------------ */
export function CopyableHashCell({
  value,
  head = 6,
  tail = 4,
  className = '',
}: {
  value: string;
  head?: number;
  tail?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="px-text-tertiary">—</span>;

  const truncated = truncateHash(value, head, tail);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      void message.success(t('common.copied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      void message.error(t('common.failed'));
    }
  };

  return (
    <Tooltip title={value} mouseEnterDelay={0.4}>
      <span className={`px-hash-cell ${className}`.trim()}>
        <span className="px-hash-cell__text px-mono">{truncated}</span>
        <button
          type="button"
          className="px-hash-cell__btn"
          onClick={handleCopy}
          aria-label={t('common.copy')}
        >
          {copied ? <CheckOutlined /> : <CopyOutlined />}
        </button>
      </span>
    </Tooltip>
  );
}

export function WalletCell({ value, head = 6, tail = 4 }: { value: string; head?: number; tail?: number }) {
  return <CopyableHashCell value={value} head={head} tail={tail} />;
}

/* ------------------------------------------------------------------
 * AmountCell — tabular USDT
 * ------------------------------------------------------------------ */
export function AmountCell({
  value,
  variant = 'usdt',
  mode = 'full',
  accent = 'none',
}: {
  value: unknown;
  variant?: 'usdt' | 'posx' | 'plain';
  mode?: 'full' | 'compact';
  accent?: 'none' | 'up' | 'down' | 'neutral';
}) {
  if (value == null || value === '') {
    return <span className="px-text-tertiary">—</span>;
  }
  const formatted = (() => {
    if (variant === 'usdt') return mode === 'compact' ? formatCompactUsdt(value) : formatUsdt(value);
    if (variant === 'posx') return `${formatInt(value)} POSX`;
    return formatInt(value);
  })();

  const color =
    accent === 'up'
      ? 'var(--px-status-ok)'
      : accent === 'down'
        ? 'var(--px-status-err)'
        : 'var(--px-text-primary)';

  return (
    <span className="px-tabular" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
      {formatted}
    </span>
  );
}

/* ------------------------------------------------------------------
 * CountCell — tabular integer
 * ------------------------------------------------------------------ */
export function CountCell({ value }: { value: unknown }) {
  if (value == null) return <span className="px-text-tertiary">—</span>;
  return <span className="px-tabular">{formatInt(value)}</span>;
}

/* ------------------------------------------------------------------
 * PercentCell — 0..1 → "12.3%"
 * ------------------------------------------------------------------ */
export function PercentCell({ value, digits = 1 }: { value: unknown; digits?: number }) {
  if (value == null) return <span className="px-text-tertiary">—</span>;
  return <span className="px-tabular">{formatPercent(value, digits)}</span>;
}

/* ------------------------------------------------------------------
 * TimeCell — UTC date/time + relative tooltip
 * ------------------------------------------------------------------ */
export function TimeCell({ value, mode = 'datetime' }: { value: unknown; mode?: 'datetime' | 'relative' }) {
  if (!value) return <span className="px-text-tertiary">—</span>;
  const full = formatDateTimeUtc(value);
  const rel = formatRelativeTime(value);
  if (mode === 'relative') {
    return (
      <Tooltip title={`${full} UTC`} mouseEnterDelay={0.4}>
        <span className="px-tabular px-text-secondary">{rel}</span>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={rel} mouseEnterDelay={0.4}>
      <span className="px-tabular">{full}</span>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------
 * ErrorCell — truncated error message with "see full" drawer
 * ------------------------------------------------------------------ */
export function ErrorCell({
  value,
  limit = 80,
  title,
}: {
  value: unknown;
  limit?: number;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  if (value == null || value === '') {
    return <span className="px-text-tertiary">—</span>;
  }
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const truncated = str.length > limit ? `${str.slice(0, limit)}…` : str;
  const needsDrawer = str.length > limit;

  return (
    <>
      <span className="px-error-cell">
        <Tooltip title={needsDrawer ? t('common.click_to_expand', 'Click to view full') : undefined}>
          <button
            type="button"
            className={`px-error-cell__text ${needsDrawer ? 'px-error-cell__text--clickable' : ''}`.trim()}
            onClick={needsDrawer ? () => setOpen(true) : undefined}
            disabled={!needsDrawer}
          >
            <Code2 size={11} className="px-error-cell__icon" />
            <span>{truncated}</span>
          </button>
        </Tooltip>
      </span>
      {needsDrawer && (
        <Drawer
          title={title ?? t('errors.full_message', 'Full error message')}
          open={open}
          onClose={() => setOpen(false)}
          placement="right"
          width={640}
        >
          <pre className="px-error-cell__full">{str}</pre>
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------------
 * ThresholdCell — numeric value with automatic tone based on
 * threshold breakpoints. Replaces the hand-rolled
 * `lag > 20 ? err : lag > 5 ? warn : ok` ternaries scattered across
 * ChainSyncPage and other monitoring tables.
 *
 * `thresholds` defines cut-offs in ascending order. Tone escalates:
 *   value <= thresholds[0]          → ok
 *   thresholds[0] < value <= thresholds[1] → warn
 *   value > thresholds[1]           → err
 *
 * Pass `higherIsBetter` to flip the sentiment for metrics like uptime.
 * ------------------------------------------------------------------ */
export function ThresholdCell({
  value,
  thresholds,
  suffix,
  higherIsBetter = false,
  format,
}: {
  value: unknown;
  thresholds: readonly [number, number];
  suffix?: string;
  higherIsBetter?: boolean;
  format?: (v: number) => string;
}) {
  if (value == null || value === '') {
    return <span className="px-text-tertiary">—</span>;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) {
    return <span className="px-text-tertiary">—</span>;
  }

  const [warnAt, errAt] = thresholds;
  let tone: 'ok' | 'warn' | 'err';
  if (higherIsBetter) {
    if (num >= warnAt) tone = 'ok';
    else if (num >= errAt) tone = 'warn';
    else tone = 'err';
  } else {
    if (num <= warnAt) tone = 'ok';
    else if (num <= errAt) tone = 'warn';
    else tone = 'err';
  }

  const formatted = format ? format(num) : String(num);

  return (
    <span className={`px-threshold-cell px-threshold-cell--${tone}`}>
      <span className="px-threshold-cell__dot" aria-hidden />
      <span className="px-tabular">{formatted}</span>
      {suffix && <span className="px-threshold-cell__suffix">{suffix}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------
 * RoleBadge — admin role chip (super_admin / operator / viewer)
 * ------------------------------------------------------------------ */
const ROLE_TONE: Record<string, { color: string; icon?: typeof ShieldCheck }> = {
  super_admin: { color: 'magenta', icon: ShieldCheck },
  admin: { color: 'purple', icon: ShieldCheck },
  operator: { color: 'blue', icon: UserCog },
  viewer: { color: 'default' },
  readonly: { color: 'default' },
};

export function RoleBadge({ role }: { role: string | null | undefined }) {
  if (!role) return <span className="px-text-tertiary">—</span>;
  const meta = ROLE_TONE[role] ?? { color: 'default' };
  const Icon = meta.icon;
  return (
    <Tag
      color={meta.color}
      className="px-role-badge"
      icon={Icon ? <Icon size={11} /> : undefined}
    >
      {t(`role.${role}`, role)}
    </Tag>
  );
}
