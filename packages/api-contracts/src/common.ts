/**
 * Common primitive zod schemas reused across endpoint schemas.
 *
 * Source of truth for formatting rules:
 *   - amounts            → 04_api_spec.md §3.4 (return as strings)
 *   - wallet addresses   → 03_database_schema_spec.md §5.1 (lowercase)
 *   - timestamps         → 04_api_spec.md §3.5 (ISO 8601 UTC)
 *   - error codes        → 04_api_spec.md §4
 *
 * These schemas are the backend-side input validators AND the frontend
 * client parsers. Both sides import from this package so that a single
 * change is reflected everywhere.
 */
import { z } from 'zod';

import { ERROR_CODE_VALUES, type ErrorCode } from '@posx/shared-types';

// -------- Amount string --------
// Decimal number as string, preserves precision across the JSON
// boundary. Runtime math lives in `@posx/shared-utils/amount`.
export const AmountStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Invalid amount string');

// -------- Rate string --------
// Rates are stored as decimal fractions, e.g. "0.15" for 15%. Never a
// percentage integer. Range is open at the top end because intermediate
// calculations may legitimately exceed 1 before clamping.
export const RateStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Invalid rate string');

// -------- Wallet address --------
// Accepts mixed case on input but transforms to lowercase so that every
// downstream consumer sees the canonical form (08 §5.2).
export const WalletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
  .transform((v) => v.toLowerCase());

// -------- Transaction hash --------
export const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid tx hash')
  .transform((v) => v.toLowerCase());

// -------- ISO 8601 UTC timestamp --------
// Strict: must end with `Z`, optional fractional seconds allowed.
export const IsoTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/,
    'Invalid ISO 8601 UTC timestamp',
  );

// -------- UTC calendar date --------
export const UtcDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid UTC date (YYYY-MM-DD)');

// -------- UUID --------
export const UuidSchema = z.string().uuid();

// -------- Request id --------
export const RequestIdSchema = z.string().min(1);

// -------- Error code --------
// Schema enum derived from the const `ERROR_CODE_VALUES` list exported
// from `@posx/shared-types`, so additions propagate automatically.
export const ErrorCodeSchema = z.enum(
  ERROR_CODE_VALUES as unknown as readonly [ErrorCode, ...ErrorCode[]],
);

// -------- Inferred types --------
// Note: prefer importing from `@posx/shared-types` for the type aliases
// when NOT parsing; the schemas here exist primarily for validation.
export type AmountStringDto = z.infer<typeof AmountStringSchema>;
export type RateStringDto = z.infer<typeof RateStringSchema>;
export type WalletAddressDto = z.infer<typeof WalletAddressSchema>;
export type TxHashDto = z.infer<typeof TxHashSchema>;
export type IsoTimestampDto = z.infer<typeof IsoTimestampSchema>;
export type UtcDateDto = z.infer<typeof UtcDateSchema>;
export type UuidDto = z.infer<typeof UuidSchema>;
