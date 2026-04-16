/**
 * KpiStatCard — hero metric card.
 *
 * Replaces the dashboard-only `KpiCard` with a shared primitive that
 * any page can use. Cleaner markup, token-driven colors, and proper
 * deltaDirection handling.
 */
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';

import { deltaDirection, formatDelta } from '../../lib/format';
import { Skeleton } from '../ui/primitives';

import './KpiStatCard.css';

interface KpiStatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  deltaCurrent?: number;
  deltaPrevious?: number;
  deltaLabel?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  trailing?: ReactNode;
}

export function KpiStatCard({
  label,
  value,
  sub,
  icon,
  accent = 'var(--px-brand)',
  deltaCurrent,
  deltaPrevious,
  deltaLabel,
  loading = false,
  onClick,
  className = '',
  style,
  trailing,
}: KpiStatCardProps) {
  const hasDelta = deltaCurrent !== undefined && deltaPrevious !== undefined;
  const direction = hasDelta ? deltaDirection(deltaCurrent!, deltaPrevious!) : 'flat';
  const deltaText = hasDelta ? formatDelta(deltaCurrent!, deltaPrevious!) : '';

  const cardStyle: CSSProperties = {
    ['--px-kpi-accent' as string]: accent,
    ...style,
  };

  return (
    <div
      className={`px-kpi ${onClick ? 'px-kpi--clickable' : ''} ${className}`.trim()}
      style={cardStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="px-kpi__head">
        <span className="px-kpi__label">{label}</span>
        {icon && <span className="px-kpi__icon">{icon}</span>}
      </div>
      <div className="px-kpi__value px-tabular">
        {loading ? <Skeleton width={120} height={28} /> : value}
      </div>
      <div className="px-kpi__foot">
        {hasDelta ? (
          <span className={`px-kpi__delta px-kpi__delta--${direction}`}>
            {direction === 'up' ? (
              <ArrowUpOutlined />
            ) : direction === 'down' ? (
              <ArrowDownOutlined />
            ) : (
              <MinusOutlined />
            )}
            <span className="px-tabular">{deltaText}</span>
            {deltaLabel && <span className="px-kpi__delta-label">{deltaLabel}</span>}
          </span>
        ) : (
          sub && <span className="px-kpi__sub">{sub}</span>
        )}
        {trailing && <span className="px-kpi__trailing">{trailing}</span>}
      </div>
      <span className="px-kpi__accent-bar" style={{ background: accent }} />
    </div>
  );
}
