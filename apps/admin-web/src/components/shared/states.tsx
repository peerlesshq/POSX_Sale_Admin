/**
 * EmptyState, ErrorState, LoadingState — unified placeholders for
 * tables, cards, and drawer panels.
 */
import { InboxOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ReactNode } from 'react';

import { t } from '../../lib/i18n';
import { Skeleton } from '../ui/primitives';

import './states.css';

interface StateProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  subtitle,
  action,
  icon = <InboxOutlined />,
}: StateProps) {
  return (
    <div className="px-state px-state--empty">
      <div className="px-state__icon">{icon}</div>
      <div className="px-state__title">{title ?? t('empty.title')}</div>
      <div className="px-state__subtitle">{subtitle ?? t('empty.subtitle')}</div>
      {action && <div className="px-state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  subtitle,
  onRetry,
  icon = <WarningOutlined />,
}: StateProps & { onRetry?: () => void }) {
  return (
    <div className="px-state px-state--error">
      <div className="px-state__icon px-state__icon--error">{icon}</div>
      <div className="px-state__title">{title ?? t('error.title')}</div>
      <div className="px-state__subtitle">{subtitle ?? t('error.subtitle')}</div>
      {onRetry && (
        <div className="px-state__action">
          <Button icon={<ReloadOutlined />} onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** LoadingState with multiple skeleton rows — stand-in while data loads. */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-state px-state--loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-state__row">
          <Skeleton height={14} />
          <Skeleton height={12} width="60%" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

/**
 * InlineError — compact error indicator for use inside SectionCards or
 * inline with other content. Unlike ErrorState (full-page placeholder),
 * this is designed to sit alongside other cards on a dashboard.
 */
export function InlineError({
  title,
  description,
  onRetry,
  retryLabel,
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}) {
  return (
    <div className={`px-inline-error${compact ? ' px-inline-error--compact' : ''}`}>
      <div className="px-inline-error__icon">
        <WarningOutlined />
      </div>
      <div className="px-inline-error__body">
        <div className="px-inline-error__title">
          {title ?? t('common.error')}
        </div>
        {description && (
          <div className="px-inline-error__desc">{description}</div>
        )}
      </div>
      {onRetry && (
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRetry}
          className="px-inline-error__retry"
        >
          {retryLabel ?? t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/**
 * EmptyHint — lightweight empty indicator for DataTable `locale.emptyText`.
 * Much smaller than the full-page EmptyState.
 */
export function EmptyHint({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="px-empty-hint">
      <InboxOutlined className="px-empty-hint__icon" />
      <div className="px-empty-hint__title">
        {title ?? t('common.empty')}
      </div>
      {description && (
        <div className="px-empty-hint__desc">{description}</div>
      )}
    </div>
  );
}

/**
 * SkeletonGroup — renders N skeleton rows inside a container.
 * Use as a loading placeholder for sections with multiple items.
 */
export function SkeletonGroup({
  rows = 3,
  gap = 12,
}: {
  rows?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={16} width={i % 2 === 0 ? '100%' : '75%'} />
      ))}
    </div>
  );
}
