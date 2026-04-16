/**
 * Common shape types reused across API DTOs, repos, and services.
 *
 * These are plain TypeScript types — zod validators for the equivalent
 * shapes live in `@posx/api-contracts`.
 */

import type { RequestId } from './primitives';

/**
 * Success envelope returned by every API endpoint on success.
 * See `04_api_spec.md §3.2`.
 */
export interface SuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly error_code: null;
  readonly message: null;
  readonly request_id: RequestId;
}

/**
 * Error envelope returned by every API endpoint on failure.
 * `error_code` is always a stable string value (see `04_api_spec.md §4`).
 */
export interface ErrorEnvelope {
  readonly success: false;
  readonly data: null;
  readonly error_code: string;
  readonly message: string | null;
  readonly request_id: RequestId;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * Pagination metadata returned on every list response.
 */
export interface PaginationMeta {
  readonly page: number;
  readonly page_size: number;
  readonly total: number;
  readonly total_pages: number;
}

/**
 * Standard list payload: items + pagination.
 */
export interface PaginatedList<T> {
  readonly items: ReadonlyArray<T>;
  readonly pagination: PaginationMeta;
}

/**
 * Standard pagination query parameters accepted by list endpoints.
 */
export interface PaginationQuery {
  readonly page?: number;
  readonly page_size?: number;
}

/**
 * Standard UTC date range query parameters.
 */
export interface DateRangeQuery {
  readonly from_date?: string;
  readonly to_date?: string;
}
