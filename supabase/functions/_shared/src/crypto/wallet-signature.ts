/**
 * EIP-191 `personal_sign` signature verification.
 *
 * Uses `ethers` to recover the signer address from the signed
 * message. Returns `true` only when the recovered address matches
 * the expected wallet address (case-insensitive).
 *
 * Source of truth: 08_auth_and_permissions_spec.md §5.3 + Phase 1
 * assumption #5 (the `POSX Login | ...` envelope).
 */
import { getAddress, verifyMessage } from 'ethers';

export class InvalidWalletSignatureError extends Error {
  constructor(message = 'Invalid wallet signature') {
    super(message);
    this.name = 'InvalidWalletSignatureError';
  }
}

export interface SignatureVerificationInput {
  readonly message: string;
  readonly signature: string;
  readonly expectedWalletAddress: string;
}

export function verifyWalletSignature(input: SignatureVerificationInput): boolean {
  try {
    const recovered = verifyMessage(input.message, input.signature);
    // `verifyMessage` returns the EIP-55 checksummed form; canonicalise
    // via `getAddress` before comparing against our lowercase wallet.
    const recoveredLower = getAddress(recovered).toLowerCase();
    const expectedLower = input.expectedWalletAddress.toLowerCase();
    return recoveredLower === expectedLower;
  } catch {
    return false;
  }
}

/**
 * Phase 1 assumption #5: the auth message envelope. Keeping the
 * formatter here so every nonce is phrased identically.
 */
export function buildAuthMessage(input: {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
}): string {
  return `POSX Login | wallet:${input.walletAddress} | nonce:${input.nonce} | issued:${input.issuedAt}`;
}

/**
 * Phase 1 assumption #4: the claim intent envelope.
 */
export function buildClaimMessage(input: {
  walletAddress: string;
  claimOrderId: string;
  amount: string;
  nonce: string;
}): string {
  return `POSX Claim | wallet:${input.walletAddress} | order:${input.claimOrderId} | amount:${input.amount} | nonce:${input.nonce}`;
}
