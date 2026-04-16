/**
 * AdminAuthService — email/password login, session validation,
 * logout.
 *
 * Password hashing: bcrypt cost 12 (Phase 1 assumption #1).
 */
import { compareSync } from 'bcrypt';

import type { AdminRole, IsoTimestamp, Uuid } from '@posx/shared-types';
import {
  type Clock,
  isoTimestampLte,
  systemClock,
} from '@posx/shared-utils';

import { generateSessionToken, sha256Hex } from '../crypto';
import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findAdminSessionByTokenHash,
  insertAdminSession,
  revokeAdminSession,
  type AdminSessionRow,
} from '../repos/admin-sessions';
import {
  findAdminUserByEmail,
  findAdminUserById,
  type AdminUserRow,
} from '../repos/admin-users';

export interface AdminLoginResult {
  readonly admin: AdminUserRow;
  readonly sessionToken: string;
  readonly expiresAt: IsoTimestamp;
}

export interface ValidatedAdminSession {
  readonly admin: AdminUserRow;
  readonly session: AdminSessionRow;
  readonly role: AdminRole;
}

export class AdminAuthService {
  private readonly clock: Clock;
  private readonly sessionTtlHours: number;

  constructor(
    private readonly db: DbClient,
    options: { clock?: Clock; sessionTtlHours?: number } = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.sessionTtlHours = options.sessionTtlHours ?? 168;
  }

  async login(input: {
    email: string;
    password: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AdminLoginResult> {
    const admin = await findAdminUserByEmail(this.db, input.email);
    if (!admin) {
      throw new AppError('UNAUTHORIZED', 'invalid credentials');
    }
    if (admin.status !== 'active') {
      throw new AppError('ADMIN_DISABLED', 'admin account disabled');
    }
    const passwordOk = compareSync(input.password, admin.password_hash);
    if (!passwordOk) {
      throw new AppError('UNAUTHORIZED', 'invalid credentials');
    }

    const sessionToken = generateSessionToken();
    const tokenHash = sha256Hex(sessionToken);
    const nowMs = this.clock.nowMs();
    const issuedAt = new Date(nowMs).toISOString() as IsoTimestamp;
    const expiresAt = new Date(
      nowMs + this.sessionTtlHours * 60 * 60 * 1000,
    ).toISOString() as IsoTimestamp;

    await insertAdminSession(this.db, {
      admin_user_id: admin.id,
      session_token_hash: tokenHash,
      issued_at: issuedAt,
      expires_at: expiresAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });

    return { admin, sessionToken, expiresAt };
  }

  async validate(rawToken: string): Promise<ValidatedAdminSession> {
    const tokenHash = sha256Hex(rawToken);
    const session = await findAdminSessionByTokenHash(this.db, tokenHash);
    if (!session) {
      throw new AppError('UNAUTHORIZED', 'admin session not found');
    }
    if (session.revoked_at !== null) {
      throw new AppError('SESSION_EXPIRED', 'admin session revoked');
    }
    const nowIso = this.clock.nowIso() as IsoTimestamp;
    if (isoTimestampLte(session.expires_at, nowIso)) {
      throw new AppError('SESSION_EXPIRED', 'admin session expired');
    }
    const admin = await this.requireAdmin(session.admin_user_id);
    if (admin.status !== 'active') {
      throw new AppError('ADMIN_DISABLED', 'admin account disabled');
    }
    return { admin, session, role: admin.role };
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = sha256Hex(rawToken);
    await revokeAdminSession(
      this.db,
      tokenHash,
      this.clock.nowIso() as IsoTimestamp,
    );
  }

  private async requireAdmin(id: Uuid): Promise<AdminUserRow> {
    const admin = await findAdminUserById(this.db, id);
    if (!admin) {
      throw new AppError('UNAUTHORIZED', 'admin not found');
    }
    return admin;
  }
}
