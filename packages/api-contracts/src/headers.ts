/**
 * Shared HTTP header schemas.
 *
 * Source of truth: 04_api_spec.md §3.6 and §24.
 *
 * Backend handlers apply these schemas to `request.headers` (case-
 * insensitively); frontend clients use them to generate compliant
 * outbound headers.
 */
import { z } from 'zod';

/**
 * `Authorization: Bearer <token>`.
 *
 * The transform returns the bare token string so handlers can pass it
 * directly into session lookup without stripping the prefix themselves.
 */
export const BearerAuthorizationHeaderSchema = z
  .string()
  .regex(/^Bearer\s+[A-Za-z0-9._\-=+/]+$/, 'Invalid Authorization header')
  .transform((v) => v.replace(/^Bearer\s+/, ''));

/**
 * `X-Idempotency-Key` — required on purchase and claim creation
 * (04 §3.6, §24). Must be a non-empty, url-safe string so downstream
 * logging and indexing stays simple.
 */
export const IdempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Invalid idempotency key format');

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
