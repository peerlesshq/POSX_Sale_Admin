/**
 * Request-id helper. Generates short correlation ids that show up in
 * every log line and every API envelope.
 */
import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateRequestId(prefix = 'req'): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] ?? 0;
    out += ALPHABET[b % ALPHABET.length];
  }
  return `${prefix}_${out}`;
}
