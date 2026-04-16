/**
 * ChainRpcClient interface + `StubChainRpcClient`.
 *
 * Phase 4 ships only the interface plus an in-memory stub that
 * returns whatever events a test / seed script hands it. Phase 5
 * will add a JSON-RPC provider backed by `ethers`.
 */
import type { TxHash } from '@posx/shared-types';

export interface ChainObservedEvent {
  readonly chainId: number;
  readonly contractAddress: string;
  readonly eventName: string;
  readonly txHash: TxHash;
  readonly logIndex: number;
  readonly blockNumber: number;
  readonly blockHash: string | null;
  readonly payload: Record<string, unknown>;
}

export interface ChainRpcClient {
  /** Return the current chain head block number. */
  getBlockNumber(): Promise<number>;
  /**
   * Stream observed events in the given block range. Implementations
   * must return them in ascending `(blockNumber, logIndex)` order.
   */
  getLogs(input: {
    chainId: number;
    contractAddress: string;
    fromBlock: number;
    toBlock: number;
  }): Promise<ReadonlyArray<ChainObservedEvent>>;
}

/**
 * A deterministic, fixture-fed stub. Good enough for the Phase 4
 * seed + Phase 6 integration harness.
 */
export class StubChainRpcClient implements ChainRpcClient {
  private head = 0;
  private readonly events: ChainObservedEvent[] = [];

  setHead(block: number): void {
    this.head = block;
  }

  push(event: ChainObservedEvent): void {
    this.events.push(event);
    if (event.blockNumber > this.head) this.head = event.blockNumber;
  }

  async getBlockNumber(): Promise<number> {
    return this.head;
  }

  async getLogs(input: {
    chainId: number;
    contractAddress: string;
    fromBlock: number;
    toBlock: number;
  }): Promise<ReadonlyArray<ChainObservedEvent>> {
    return this.events.filter(
      (e) =>
        e.chainId === input.chainId &&
        e.contractAddress.toLowerCase() === input.contractAddress.toLowerCase() &&
        e.blockNumber >= input.fromBlock &&
        e.blockNumber <= input.toBlock,
    );
  }
}
