/**
 * Pagination utilities.
 *
 * These helpers are shared between the API layer and admin list
 * endpoints so that page/page_size semantics stay consistent
 * everywhere (02 §24.3, 04 §3.3).
 */
import type { PaginationMeta } from '@posx/shared-types';

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

export interface PaginationDefaults {
  defaultPageSize?: number;
  maxPageSize?: number;
}

/**
 * Clamp user-supplied pagination values into a safe range and derive
 * the equivalent offset/limit for SQL.
 *
 * - `page` defaults to 1; values < 1 are clamped to 1.
 * - `pageSize` defaults to `defaults.defaultPageSize` (fallback 20) and
 *   is clamped to `[1, defaults.maxPageSize ?? 100]`.
 * - Non-integer inputs are floored.
 */
export function normalizePagination(
  input: PaginationInput = {},
  defaults: PaginationDefaults = {},
): NormalizedPagination {
  const defaultPageSize = defaults.defaultPageSize ?? 20;
  const maxPageSize = defaults.maxPageSize ?? 100;

  const rawPage = Number(input.page ?? 1);
  const rawPageSize = Number(input.pageSize ?? defaultPageSize);

  const page = Math.max(1, Number.isFinite(rawPage) ? Math.floor(rawPage) : 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(
      1,
      Number.isFinite(rawPageSize) ? Math.floor(rawPageSize) : defaultPageSize,
    ),
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };
}

/**
 * Build the `PaginationMeta` envelope field that every list API
 * response returns.
 */
export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  const safeTotal = Math.max(0, Math.floor(total));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  return {
    page: Math.max(1, Math.floor(page)),
    page_size: safePageSize,
    total: safeTotal,
    total_pages: safeTotal === 0 ? 0 : Math.ceil(safeTotal / safePageSize),
  };
}
