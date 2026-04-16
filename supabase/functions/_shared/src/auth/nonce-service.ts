/**
 * Nonce issuance + consumption.
 *
 * Source of truth: 08_auth_and_permissions_spec.md §5, §6.
 *
 * - `issueNonce` creates a one-time nonce row and returns the raw
 *   nonce + signable message envelope.
 * - `consumeNonce` marks the nonce row as used and throws
 *   `NONCE_EXPIRED` / `NONCE_ALREADY_USED` on failure.
 */
import type { IsoTimestamp, WalletAddress } from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import { generateAuthNonce, buildAuthMessage } from '../crypto';
import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  findAuthNonceByValue,
  insertAuthNonce,
  markAuthNonceUsed,
} from '../repos/auth-nonces';

export interface IssuedNonce {
  readonly walletAddress: WalletAddress;
  readonly nonce: string;
  readonly messageToSign: string;
  readonly expiresAt: IsoTimestamp;
}

export interface NonceServiceOptions {
  readonly ttlMinutes?: number;
  readonly clock?: Clock;
}

export class NonceService {
  private readonly ttlMinutes: number;
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    options: NonceServiceOptions = {},
  ) {
    this.ttlMinutes = options.ttlMinutes ?? 5;
    this.clock = options.clock ?? systemClock;
  }

  async issueNonce(walletAddress: WalletAddress): Promise<IssuedNonce> {
    const nonce = generateAuthNonce();
    const nowMs = this.clock.nowMs();
    const issuedAt = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + this.ttlMinutes * 60 * 1000).toISOString();

    await insertAuthNonce(this.db, {
      wallet_address: walletAddress,
      nonce,
      expires_at: expiresAt,
    });

    return {
      walletAddress,
      nonce,
      messageToSign: buildAuthMessage({
        walletAddress,
        nonce,
        issuedAt,
      }),
      expiresAt,
    };
  }

  /**
   * Validate that the nonce exists, hasn't been used, and hasn't
   * expired. Returns the wallet address that originally requested
   * it. Marks the nonce used on success (single atomic step via
   * the repo's UPDATE ... WHERE used_at IS NULL).
   */
  async consumeNonce(nonce: string): Promise<WalletAddress> {
    const row = await findAuthNonceByValue(this.db, nonce);
    if (!row) {
      throw new AppError('NONCE_EXPIRED', 'unknown or expired nonce');
    }
    if (row.used_at !== null) {
      throw new AppError('NONCE_ALREADY_USED', 'nonce already consumed');
    }
    const nowIso = this.clock.nowIso() as IsoTimestamp;
    if (row.expires_at <= nowIso) {
      throw new AppError('NONCE_EXPIRED', 'nonce expired');
    }
    const updated = await markAuthNonceUsed(this.db, nonce, nowIso);
    if (!updated) {
      // Lost the race — another caller marked it used first.
      throw new AppError('NONCE_ALREADY_USED', 'nonce already consumed');
    }
    return row.wallet_address;
  }
}
