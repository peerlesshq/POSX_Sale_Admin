/**
 * TP Wallet / MetaMask connection + EIP-191 signature flow.
 *
 * The spec allows any EIP-1193 provider (injected wallet) — TP
 * Wallet exposes one by default. We call `eth_requestAccounts` to
 * get the current address and `personal_sign` to produce the
 * signature the backend verifies.
 */
import { BrowserProvider } from 'ethers';

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export class NoWalletError extends Error {
  constructor() {
    super('No injected wallet detected. Please install TP Wallet.');
    this.name = 'NoWalletError';
  }
}

export function getInjectedProvider(): Eip1193Provider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new NoWalletError();
  }
  return window.ethereum;
}

export async function requestWalletAddress(): Promise<string> {
  const provider = getInjectedProvider();
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('No account available');
  }
  return accounts[0]!.toLowerCase();
}

export async function signMessage(message: string, walletAddress: string): Promise<string> {
  const provider = getInjectedProvider();
  const signature = (await provider.request({
    method: 'personal_sign',
    params: [message, walletAddress],
  })) as string;
  return signature;
}

export async function ethersProvider(): Promise<BrowserProvider> {
  return new BrowserProvider(getInjectedProvider() as unknown as never);
}
