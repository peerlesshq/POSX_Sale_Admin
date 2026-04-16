/**
 * Shared primitive type aliases.
 *
 * These aliases exist to make intent explicit at type level. They are *not*
 * branded types — runtime validation for these formats lives in
 * `@posx/shared-utils` (address, amount, utc) and `@posx/api-contracts`
 * (zod schemas). Anything crossing a trust boundary must still be validated.
 */

/**
 * Decimal amount represented as a string to preserve precision across JSON
 * boundaries. Always parsed/formatted via `@posx/shared-utils/amount`.
 *
 * API convention: see `04_api_spec.md §3.4`.
 */
export type AmountString = string;

/**
 * EVM wallet address, normalized to lowercase.
 *
 * Storage convention: `03_database_schema_spec.md §5.1`. All persistence and
 * permission checks use lowercase form.
 */
export type WalletAddress = string;

/**
 * EVM transaction hash, `0x` + 64 hex chars.
 */
export type TxHash = string;

/**
 * ISO 8601 UTC timestamp, e.g. `2026-04-13T10:00:00.000Z`.
 *
 * API convention: see `04_api_spec.md §3.5`. All business-day logic uses UTC.
 */
export type IsoTimestamp = string;

/**
 * UTC calendar date, `YYYY-MM-DD`. Used for settle_date and report ranges.
 */
export type UtcDate = string;

/**
 * Request correlation id returned in every API envelope.
 */
export type RequestId = string;

/**
 * UUID v4 (or compatible) used for all non-natural-key primary ids.
 */
export type Uuid = string;

/**
 * Rate / ratio represented as a decimal fraction string, e.g. `"0.15"` for
 * 15%. Never a percentage integer. See `03_database_schema_spec.md §10.3`.
 */
export type RateString = string;
