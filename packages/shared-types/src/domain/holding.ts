/**
 * Holding service contract.
 *
 * =====================================================================
 * CRITICAL — READ BEFORE CONSUMING
 * =====================================================================
 *
 * `holding_posx_amount` and `holding_value_usdt` are used by several
 * business modules (tier evaluation, burn cap calculation, dashboard
 * display). The spec does not yet fix a single on-chain-vs-derived
 * source — see `01_business_rules_spec.md §3.2` and Phase 1 assumption
 * #7 in the implementation plan.
 *
 * Because the source may be replaced later (e.g. swapped for an on-chain
 * view call), the holding value MUST be read exclusively through this
 * service interface. No business module may re-derive holding by reading
 * `vesting_lots`, `purchases`, or any other fact table directly.
 *
 * Phase 3 will provide an initial implementation that derives holding
 * from vesting lots, with a clearly marked assumption comment. Any later
 * replacement changes only the implementation, never the callers.
 *
 * This is an architectural guardrail, not a stylistic preference. Bypass
 * = bug.
 * =====================================================================
 */

import type { AmountString, IsoTimestamp, UtcDate, WalletAddress } from '../primitives';

/**
 * Where the holding value came from. Stored on snapshots so audits can
 * trace back to the source.
 */
export const HoldingSource = {
  /**
   * Derived from `vesting_lots` minus withdrawn amounts. This is the
   * initial implementation used while no on-chain view call is wired up.
   */
  DerivedFromVesting: 'derived_from_vesting',

  /**
   * Read directly from an on-chain balance / view call.
   */
  OnChainBalance: 'on_chain_balance',

  /**
   * Supplied by an external bridge or reconciled ledger.
   */
  External: 'external',
} as const;

export type HoldingSource = (typeof HoldingSource)[keyof typeof HoldingSource];

/**
 * A holding snapshot for one wallet at one point in time.
 *
 * All amount-shaped fields are `AmountString` to preserve precision across
 * JSON boundaries. The evaluation price is also included so that callers
 * can audit how `holding_value_usdt` was derived at that instant.
 */
export interface WalletHoldingSnapshot {
  readonly walletAddress: WalletAddress;
  readonly evaluatedAt: IsoTimestamp;
  readonly holdingPosxAmount: AmountString;
  readonly evaluationPriceUsdt: AmountString;
  readonly holdingValueUsdt: AmountString;
  readonly source: HoldingSource;
}

/**
 * Input to the holding service. Either `evaluationTime` or
 * `settlementDate` must be provided — the implementation is free to
 * decide how to interpret "now" when neither is supplied, but callers
 * should always pass one of the two in business-critical paths so that
 * historical recompute resolves the correct evaluation price.
 */
export interface HoldingQuery {
  readonly walletAddress: WalletAddress;
  readonly evaluationTime?: IsoTimestamp;
  readonly settlementDate?: UtcDate;
}

/**
 * The holding service interface. Every business module that needs
 * holding data depends on this interface — never on a specific
 * implementation class.
 */
export interface HoldingService {
  /**
   * Return the holding snapshot for a single wallet at the requested
   * evaluation time.
   */
  getHoldingAtTime(query: HoldingQuery): Promise<WalletHoldingSnapshot>;

  /**
   * Batch variant used by settlement enumeration. Must be
   * order-preserving relative to the input array.
   */
  getHoldingsAtTime(
    queries: ReadonlyArray<HoldingQuery>,
  ): Promise<ReadonlyArray<WalletHoldingSnapshot>>;
}
