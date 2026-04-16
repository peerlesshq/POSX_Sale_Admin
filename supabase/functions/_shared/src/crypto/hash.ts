/**
 * Session-token + nonce hashing helpers.
 *
 * `user_sessions.session_token_hash` and `admin_sessions.session_token_hash`
 * store SHA-256 hex digests of the raw token. The plaintext token is
 * returned once to the client at login time and never persisted.
 */
import { createHash } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
