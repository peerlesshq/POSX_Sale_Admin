/**
 * UserSessionService — validate + revoke user session tokens.
 */
import type { IsoTimestamp, WalletAddress } from '@posx/shared-types';
import {
  type Clock,
  isoTimestampLte,
  systemClock,
} from '@posx/shared-utils';

import { sha256Hex } from '../crypto';
import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findUserSessionByTokenHash,
  revokeUserSession,
  type UserSessionRow,
} from '../repos/user-sessions';

export interface ValidatedUserSession {
  readonly wallet: WalletAddress;
  readonly session: UserSessionRow;
}

export class UserSessionService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async validate(rawToken: string): Promise<ValidatedUserSession> {
    const hash = sha256Hex(rawToken);
    const row = await findUserSessionByTokenHash(this.db, hash);
    if (!row) {
      throw new AppError('UNAUTHORIZED', 'session not found');
    }
    if (row.revoked_at !== null) {
      throw new AppError('SESSION_EXPIRED', 'session revoked');
    }
    const nowIso = this.clock.nowIso() as IsoTimestamp;
    if (isoTimestampLte(row.expires_at, nowIso)) {
      throw new AppError('SESSION_EXPIRED', 'session expired');
    }
    return { wallet: row.wallet_address, session: row };
  }

  async revoke(rawToken: string): Promise<void> {
    const hash = sha256Hex(rawToken);
    await revokeUserSession(this.db, hash, this.clock.nowIso() as IsoTimestamp);
  }
}
