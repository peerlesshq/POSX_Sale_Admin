/**
 * Pagination zod schemas.
 *
 * Source of truth: 04_api_spec.md §3.3.
 *
 * `normalizePagination` (in `@posx/shared-utils`) handles runtime
 * clamping against config-driven `pagination_defaults`. The schema
 * here focuses on *shape* validation so the backend rejects obviously
 * malformed input before it reaches the service layer.
 */
import { z } from 'zod';

/**
 * Standard paginated query input accepted by list endpoints. Sizes are
 * coerced from string (query string) to number, with sensible upper
 * bounds. The actual page-size cap at runtime comes from the config
 * center (09 §9.12 `system_limits.pagination_defaults`).
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1_000_000).optional(),
  page_size: z.coerce.number().int().positive().max(500).optional(),
});

export type PaginationQueryDto = z.infer<typeof PaginationQuerySchema>;

/**
 * Pagination metadata returned in every list response. The snake_case
 * field names match the JSON convention used by the API spec.
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
});

export type PaginationMetaDto = z.infer<typeof PaginationMetaSchema>;

/**
 * Build a zod schema for a paginated list payload.
 *
 * Usage:
 *
 * ```ts
 * const PurchaseListPayload = paginatedPayload(PurchaseItemSchema);
 * ```
 */
export function paginatedPayload<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: PaginationMetaSchema,
  });
}

/**
 * Shared UTC date range filter used across many list endpoints.
 */
export const DateRangeQuerySchema = z.object({
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid from_date (YYYY-MM-DD)')
    .optional(),
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid to_date (YYYY-MM-DD)')
    .optional(),
});

export type DateRangeQueryDto = z.infer<typeof DateRangeQuerySchema>;
