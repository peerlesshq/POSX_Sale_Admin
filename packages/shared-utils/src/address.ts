/**
 * EVM wallet address helpers.
 *
 * Rule: the canonical persistence form is lowercase (see
 * 03_database_schema_spec.md §5.1 and 08_auth_and_permissions_spec.md
 * §5.2). All incoming wallet addresses (API body, chain events, admin
 * search filters) must be normalised before use.
 */
import type { WalletAddress } from '@posx/shared-types';

const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export class InvalidWalletAddressError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid wallet address: ${JSON.stringify(value)}`);
    this.name = 'InvalidWalletAddressError';
  }
}

export class InvalidTxHashError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid tx hash: ${JSON.stringify(value)}`);
    this.name = 'InvalidTxHashError';
  }
}

/**
 * Type guard: pure format check. Does not verify checksum.
 */
export function isWalletAddress(value: unknown): value is WalletAddress {
  return typeof value === 'string' && WALLET_ADDRESS_REGEX.test(value);
}

/**
 * Normalise an address to lowercase. Throws on invalid format.
 */
export function normalizeWalletAddress(value: string): WalletAddress {
  if (!isWalletAddress(value)) {
    throw new InvalidWalletAddressError(value);
  }
  return value.toLowerCase();
}

/**
 * Compare two addresses case-insensitively. Returns false on invalid
 * input rather than throwing — helpful for UI filter logic.
 */
export function walletAddressesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (!isWalletAddress(a) || !isWalletAddress(b)) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Mask a wallet address for user-side display (05 §17.4,
 * 01 §19.2). Format: `0x + first 6 chars + "..." + last 4 chars`.
 *
 * Does NOT modify the underlying value — use this only for rendering.
 */
export function maskWalletAddress(value: WalletAddress): string {
  if (!isWalletAddress(value)) {
    throw new InvalidWalletAddressError(value);
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

/**
 * Tx hash format check (0x + 64 hex chars).
 */
export function isTxHash(value: unknown): boolean {
  return typeof value === 'string' && TX_HASH_REGEX.test(value);
}

export function normalizeTxHash(value: string): string {
  if (!isTxHash(value)) {
    throw new InvalidTxHashError(value);
  }
  return value.toLowerCase();
}
