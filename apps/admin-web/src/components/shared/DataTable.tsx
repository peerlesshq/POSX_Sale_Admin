/**
 * DataTable — wrapped `Table` with shared empty / loading / error states
 * and token-driven styling already applied via globals.css.
 *
 * This is a thin adapter on top of AntD Table specifically so pages do
 * not re-pick colors, borders, padding, or empty states. For pagination
 * we default to a 20-row page with a numeric jumper — this matches
 * what a fintech ops person expects on a dense table.
 *
 * Why not ProTable? — ProTable is heavy, opinionated about search UI,
 * and fights our design system. For Phase 7 we use plain Table +
 * FilterBar so the look stays consistent.
 */
import { Table } from 'antd';
import type { TableProps } from 'antd';
import type { ReactNode } from 'react';

import { EmptyState } from './states';
import { t } from '../../lib/i18n';

import './DataTable.css';

type DataTableProps<T extends object> = TableProps<T> & {
  emptyTitle?: string;
  emptySubtitle?: string;
  dense?: boolean;
  toolbar?: ReactNode;
};

export function DataTable<T extends object>({
  emptyTitle,
  emptySubtitle,
  dense = false,
  toolbar,
  className = '',
  ...rest
}: DataTableProps<T>) {
  return (
    <div className={`px-data-table ${dense ? 'px-data-table--dense' : ''} ${className}`.trim()}>
      {toolbar && <div className="px-data-table__toolbar">{toolbar}</div>}
      <Table<T>
        size="middle"
        rowKey={rest.rowKey}
        pagination={
          rest.pagination === false
            ? false
            : {
                showSizeChanger: true,
                pageSize: 20,
                showQuickJumper: false,
                showTotal: (total, range) => (
                  <span className="px-text-tertiary" style={{ fontSize: 12 }}>
                    {t('common.showing_of')
                      .replace('{start}', String(range[0]))
                      .replace('{end}', String(range[1]))
                      .replace('{total}', String(total))}
                  </span>
                ),
                ...rest.pagination,
              }
        }
        locale={{
          emptyText: (
            <EmptyState
              title={emptyTitle ?? t('common.no_data')}
              subtitle={emptySubtitle ?? t('empty.subtitle')}
            />
          ),
        }}
        {...rest}
      />
    </div>
  );
}
