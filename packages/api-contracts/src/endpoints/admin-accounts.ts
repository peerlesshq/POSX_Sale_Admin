/**
 * Admin accounts endpoint contracts.
 *
 * Source of truth: 04_api_spec.md §21. Super-admin only.
 */
import { z } from 'zod';

import { IsoTimestampSchema, UuidSchema } from '../common';
import { successEnvelope } from '../envelope';

const AdminRoleSchema = z.enum(['super_admin', 'operator', 'viewer']);
const AdminStatusSchema = z.enum(['active', 'disabled']);

// ---- GET /admin/accounts ----

export const AdminAccountItemSchema = z.object({
  admin_user_id: UuidSchema,
  email: z.string().email(),
  name: z.string(),
  role: AdminRoleSchema,
  status: AdminStatusSchema,
  last_login_at: IsoTimestampSchema.nullable(),
  created_at: IsoTimestampSchema,
});
export const ListAdminAccountsDataSchema = z.object({
  items: z.array(AdminAccountItemSchema),
});
export const ListAdminAccountsResponseSchema = successEnvelope(ListAdminAccountsDataSchema);

// ---- POST /admin/accounts ----

export const CreateAdminAccountRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  role: AdminRoleSchema,
  /** BE-70 — operator audit reason, required for admin creation. */
  reason: z.string().min(1),
});
export type CreateAdminAccountRequest = z.infer<typeof CreateAdminAccountRequestSchema>;

export const CreateAdminAccountDataSchema = z.object({
  admin_user_id: UuidSchema,
  email: z.string().email(),
  name: z.string(),
  role: AdminRoleSchema,
  status: AdminStatusSchema,
});
export const CreateAdminAccountResponseSchema = successEnvelope(CreateAdminAccountDataSchema);

// ---- PATCH /admin/accounts/{id} ----

export const UpdateAdminAccountRequestSchema = z
  .object({
    role: AdminRoleSchema.optional(),
    status: AdminStatusSchema.optional(),
    name: z.string().min(1).optional(),
    /** BE-70 — operator audit reason, required for every admin mutation. */
    reason: z.string().min(1),
    /** Rotate the admin's session token, forcing re-login. */
    rotate_session: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.role !== undefined ||
      v.status !== undefined ||
      v.name !== undefined ||
      v.rotate_session === true,
    { message: 'at least one actionable field must be provided' },
  );
export type UpdateAdminAccountRequest = z.infer<typeof UpdateAdminAccountRequestSchema>;

export const UpdateAdminAccountDataSchema = z.object({
  admin_user_id: UuidSchema,
  role: AdminRoleSchema,
  status: AdminStatusSchema,
  name: z.string(),
});
export const UpdateAdminAccountResponseSchema = successEnvelope(UpdateAdminAccountDataSchema);
