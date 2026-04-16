/**
 * Standard API response envelope.
 *
 * Source of truth: 04_api_spec.md §3.2.
 *
 * Every endpoint wraps its payload in either a success envelope or an
 * error envelope. The `success` discriminant is a literal boolean that
 * narrows on both sides of the wire.
 */
import { z } from 'zod';

import { ErrorCodeSchema, RequestIdSchema } from './common';

/**
 * Error envelope — `success: false`. `error_code` is a stable string
 * defined in `@posx/shared-types/enums/error-code`.
 */
export const ErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error_code: ErrorCodeSchema,
  message: z.string().nullable(),
  request_id: RequestIdSchema,
});

export type ErrorEnvelopeDto = z.infer<typeof ErrorEnvelopeSchema>;

/**
 * Build a zod schema for a success envelope wrapping a specific data
 * schema.
 *
 * Usage:
 *
 * ```ts
 * const GetUserProfileResponse = successEnvelope(UserProfileSchema);
 * type GetUserProfileResponse = z.infer<typeof GetUserProfileResponse>;
 * ```
 *
 * The return type is intentionally inferred rather than annotated so
 * that zod minor-version changes to `ZodObject` generic defaults don't
 * break this module.
 */
export function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    error_code: z.null(),
    message: z.null(),
    request_id: RequestIdSchema,
  });
}

/**
 * Build a discriminated-union schema that matches either a success
 * envelope (wrapping the given data schema) or the standard error
 * envelope. Most frontend code should `.parse()` against this and
 * branch on `result.success`.
 */
export function apiEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([successEnvelope(dataSchema), ErrorEnvelopeSchema]);
}
