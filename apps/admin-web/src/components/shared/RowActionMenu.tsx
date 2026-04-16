/**
 * RowActionMenu — standardized `⋯` dropdown for table row actions.
 *
 * Before: every table re-implemented its own row action pattern —
 * some had inline links, some had icons, some had nothing, and the
 * new UsersPage had a bespoke Dropdown + items[] setup. This primitive
 * centralizes the pattern so every table uses the same `⋯` affordance,
 * the same keyboard behavior, the same hover state, and the same
 * rule that danger/risk actions sit below a divider.
 *
 * Supports three item shapes:
 *   - regular action       — clickable, optional icon
 *   - danger action        — ants red variant, should trigger a
 *                            RiskActionModal on click
 *   - divider              — horizontal rule between groups
 *   - disabled action      — grayed out with optional tooltip reason
 *
 * Usage:
 *   <RowActionMenu
 *     items={[
 *       { key: 'view',     label: t('actions.view'), icon: <Eye/>, onClick: openDetail },
 *       { key: 'edit',     label: t('actions.edit'), icon: <Edit/>, onClick: openEdit },
 *       { divider: true },
 *       { key: 'disable',  label: t('actions.disable'), danger: true, onClick: openRiskModal },
 *     ]}
 *   />
 */
import { Dropdown, type MenuProps } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { t } from '../../lib/i18n';

import './RowActionMenu.css';

export interface RowActionItem {
  readonly key: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly onClick?: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly divider?: never;
}

export interface RowActionDivider {
  readonly divider: true;
  readonly key?: string;
  readonly label?: never;
  readonly onClick?: never;
  readonly danger?: never;
  readonly disabled?: never;
  readonly disabledReason?: never;
  readonly icon?: never;
}

export type RowActionEntry = RowActionItem | RowActionDivider;

interface RowActionMenuProps {
  readonly items: readonly RowActionEntry[];
  readonly placement?: MenuProps['style'] extends never
    ? never
    : 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  readonly label?: string;
  readonly size?: 'sm' | 'md';
  /**
   * Click anchor class — used by UsersPage to stop row-click handlers
   * from firing when the ⋯ is clicked. Default: `up-list__actions`.
   * Custom pages can override.
   */
  readonly anchorClass?: string;
}

export const RowActionMenu: FC<RowActionMenuProps> = ({
  items,
  placement = 'bottomRight',
  label,
  size = 'md',
  anchorClass = 'up-list__actions',
}) => {
  const effectiveLabel = label || t('common.actions', 'Actions');
  const menuItems: NonNullable<MenuProps['items']> = items.map((it, idx) => {
    if ('divider' in it && it.divider) {
      return { type: 'divider' as const, key: it.key ?? `div-${idx}` };
    }
    const item = it as RowActionItem;
    return {
      key: item.key,
      label: (
        <span className="px-row-action__label">
          {item.icon && (
            <span className="px-row-action__icon" aria-hidden>
              {item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </span>
      ),
      icon: undefined,
      danger: item.danger,
      disabled: item.disabled,
      onClick: item.onClick,
      title: item.disabled ? item.disabledReason : undefined,
    };
  });

  const btnClass = [
    'px-row-action-btn',
    size === 'sm' ? 'px-row-action-btn--sm' : '',
    anchorClass,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={anchorClass} onClick={(e) => e.stopPropagation()}>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        placement={placement}
      >
        <button
          type="button"
          className={btnClass}
          aria-label={effectiveLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={size === 'sm' ? 14 : 16} />
        </button>
      </Dropdown>
    </div>
  );
};
