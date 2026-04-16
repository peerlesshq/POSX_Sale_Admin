/**
 * Admin auth endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §13.
 */
import { z } from 'zod';

import { IsoTimestampSchema, UuidSchema } from '../common';
import { successEnvelope } from '../envelope';

export const AdminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;

export const AdminLoginDataSchema = z.object({
  admin_user_id: UuidSchema,
  name: z.string(),
  role: z.enum(['super_admin', 'operator', 'viewer']),
  session_token: z.string(),
  expires_at: IsoTimestampSchema,
});
export const AdminLoginResponseSchema = successEnvelope(AdminLoginDataSchema);

export const AdminLogoutDataSchema = z.object({
  logged_out: z.literal(true),
});
export const AdminLogoutResponseSchema = successEnvelope(AdminLogoutDataSchema);
