/**
 * Badges — status, severity, environment.
 *
 * All status words come from i18n (`status.*`) so the same component
 * works in both zh-CN and English without additional wrapping.
 */
import type { CSSProperties, ReactNode } from 'react';

import { t } from '../../lib/i18n';

import './badges.css';

type Tone = 'ok' | 'warn' | 'err' | 'info' | 'neutral' | 'brand';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'px-badge--ok',
  warn: 'px-badge--warn',
  err: 'px-badge--err',
  info: 'px-badge--info',
  neutral: 'px-badge--neutral',
  brand: 'px-badge--brand',
};

function Badge({
  tone,
  children,
  dot = false,
  style,
}: {
  tone: Tone;
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span className={`px-badge ${TONE_CLASS[tone]}`} style={style}>
      {dot && <span className="px-badge__dot" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------
 * StatusBadge — user / job / settlement status chips
 * ------------------------------------------------------------------ */

const STATUS_MAP: Record<string, { tone: Tone; key: string }> = {
  active: { tone: 'ok', key: 'status.active' },
  ok: { tone: 'ok', key: 'status.ok' },
  completed: { tone: 'ok', key: 'status.completed' },
  success: { tone: 'ok', key: 'status.ok' },
  restricted_purchase: { tone: 'warn', key: 'status.restricted_purchase' },
  restricted_claim: { tone: 'warn', key: 'status.restricted_claim' },
  warn: { tone: 'warn', key: 'status.warn' },
  running: { tone: 'info', key: 'status.running' },
  queued: { tone: 'info', key: 'status.queued' },
  pending: { tone: 'info', key: 'status.pending' },
  claimable: { tone: 'ok', key: 'status.claimable' },
  pending_signature: { tone: 'info', key: 'status.pending_signature' },
  broadcasted: { tone: 'info', key: 'status.broadcasted' },
  suspended: { tone: 'err', key: 'status.suspended' },
  blacklisted: { tone: 'err', key: 'status.blacklisted' },
  err: { tone: 'err', key: 'status.err' },
  error: { tone: 'err', key: 'status.err' },
  failed: { tone: 'err', key: 'status.failed' },
};

export function StatusBadge({ value, dot = true }: { value: string | null | undefined; dot?: boolean }) {
  if (!value) {
    return (
      <Badge tone="neutral" dot={dot}>
        {t('status.unknown')}
      </Badge>
    );
  }
  const spec = STATUS_MAP[value];
  if (!spec) {
    return (
      <Badge tone="neutral" dot={dot}>
        {value}
      </Badge>
    );
  }
  return (
    <Badge tone={spec.tone} dot={dot}>
      {t(spec.key, value)}
    </Badge>
  );
}

/* ------------------------------------------------------------------
 * SeverityBadge
 * ------------------------------------------------------------------ */

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_TONE: Record<Severity, Tone> = {
  low: 'ok',
  medium: 'warn',
  high: 'err',
  critical: 'err',
};

export function SeverityBadge({ value }: { value: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[value]} dot>
      {t(`severity.${value}`)}
    </Badge>
  );
}

/* ------------------------------------------------------------------
 * EnvironmentBadge
 * ------------------------------------------------------------------ */

export function EnvironmentBadge({ env }: { env: string }) {
  const tone: Tone =
    env === 'production' ? 'err' : env === 'staging' ? 'warn' : 'info';
  return (
    <Badge tone={tone}>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
        {env}
      </span>
    </Badge>
  );
}

/* ------------------------------------------------------------------
 * TierBadge
 * ------------------------------------------------------------------ */

const TIER_TONE: Record<string, Tone> = {
  elite: 'brand',
  advanced: 'info',
  basic: 'neutral',
  none: 'neutral',
};

export function TierBadge({ value }: { value: string | null | undefined }) {
  const tier = (value ?? 'none').toLowerCase();
  const tone = TIER_TONE[tier] ?? 'neutral';
  return <Badge tone={tone}>{t(`tier.${tier}`, value ?? 'none')}</Badge>;
}

export { Badge };
