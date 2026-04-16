/**
 * Cryptographically-secure random helpers for nonce + session token
 * generation.
 */
import { randomBytes } from 'node:crypto';

export function randomHex(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * Generate a one-time wallet-login nonce. The default 32-byte length
 * gives 256 bits of entropy, matching the nonce field spec (08 §5.1,
 * §5.5).
 */
export function generateAuthNonce(): string {
  return randomHex(32);
}

/**
 * Generate a user / admin session token. Separate from nonces so
 * we can tune length independently if required.
 */
export function generateSessionToken(): string {
  return randomHex(32);
}
