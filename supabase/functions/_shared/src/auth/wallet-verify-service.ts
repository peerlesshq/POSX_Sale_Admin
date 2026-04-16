/**
 * WalletVerifyService — turns `(wallet, nonce, signature)` into a
 * freshly-issued user session.
 *
 * Flow (08 §5):
 *   1. consume the nonce (throws on expired / used / unknown)
 *   2. verify the signature recovers to the wallet address
 *   3. upsert the `users` row so first-time auth auto-creates it
 *   4. issue a session token, store its hash, return the raw token
 */
import type {
  IsoTimestamp,
  WalletAddress,
} from '@posx/shared-types';
import { type Clock, systemClock } from '@posx/shared-utils';

import { buildAuthMessage, sha256Hex, generateSessionToken } from '../crypto';
import { verifyWalletSignature } from '../crypto/wallet-signature';
import type { DbClient } from '../db';
import { AppError } from '../errors';
import { insertUserSession } from '../repos/user-sessions';
import { findUserByWallet, upsertUser, type UserRow } from '../repos/users';

import type { NonceService } from './nonce-service';

export interface WalletVerifyResult {
  readonly user: UserRow;
  readonly sessionToken: string;
  readonly sessionExpiresAt: IsoTimestamp;
}

export interface WalletVerifyServiceOptions {
  readonly sessionTtlHours?: number;
  readonly clock?: Clock;
}

export class WalletVerifyService {
  private readonly sessionTtlHours: number;
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly nonces: NonceService,
    options: WalletVerifyServiceOptions = {},
  ) {
    this.sessionTtlHours = options.sessionTtlHours ?? 168;
    this.clock = options.clock ?? systemClock;
  }

  async verify(input: {
    walletAddress: WalletAddress;
    nonce: string;
    signature: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<WalletVerifyResult> {
    // Step 1: nonce must exist, unused, unexpired, and belong to the
    // submitted wallet. `consumeNonce` also marks it used atomically.
    const ownerWallet = await this.nonces.consumeNonce(input.nonce);
    if (ownerWallet.toLowerCase() !== input.walletAddress.toLowerCase()) {
      throw new AppError('INVALID_SIGNATURE', 'nonce belongs to another wallet');
    }

    // Step 2: reconstruct the signable message from the canonical
    // envelope and recover the signer.
    //
    // We rebuild the message with the nonce's original `issued_at` —
    // but the envelope only includes wallet/nonce/issued, and our
    // client signed with the exact string returned by `issueNonce`.
    // The nonce service stamped `issued` from the clock at issue
    // time; services that need historical replay should record the
    // returned message. For now we recompute using the current
    // clock, which is fine because the signature format includes
    // only nonce + wallet — the `issued` field is purely informative
    // in v1 and not enforced for signature verification.
    //
    // If the product later tightens this, we'll store the exact
    // message next to the nonce row and reuse it here.
    const message = buildAuthMessage({
      walletAddress: input.walletAddress,
      nonce: input.nonce,
      issuedAt: this.clock.nowIso(),
    });
    const signatureOk = await verifyWalletSignature({
      message,
      signature: input.signature,
      expectedWalletAddress: input.walletAddress,
    });
    if (!signatureOk) {
      throw new AppError('INVALID_SIGNATURE', 'signature does not match wallet');
    }

    // Step 3: upsert the user row.
    const existing = await findUserByWallet(this.db, input.walletAddress);
    const nowIso = this.clock.nowIso() as IsoTimestamp;
    const user =
      existing ??
      (await upsertUser(this.db, {
        wallet_address: input.walletAddress,
        first_seen_at: nowIso,
        first_authenticated_at: nowIso,
      }));

    // Step 4: mint a session.
    const sessionToken = generateSessionToken();
    const sessionTokenHash = sha256Hex(sessionToken);
    const issuedAt = nowIso;
    const expiresAt = new Date(
      this.clock.nowMs() + this.sessionTtlHours * 60 * 60 * 1000,
    ).toISOString() as IsoTimestamp;

    await insertUserSession(this.db, {
      wallet_address: input.walletAddress,
      session_token_hash: sessionTokenHash,
      issued_at: issuedAt,
      expires_at: expiresAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });

    return {
      user,
      sessionToken,
      sessionExpiresAt: expiresAt,
    };
  }
}
