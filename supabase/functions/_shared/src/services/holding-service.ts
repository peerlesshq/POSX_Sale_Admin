/**
 * HoldingService — isolated behind one interface.
 *
 * Phase 2 constraint 5 (repeated in Phase 4): every business module
 * that needs `holding_posx_amount` or `holding_value_usdt` must go
 * through this service. No other file is allowed to reach into
 * `vesting_lots` or `purchases` to derive holding.
 *
 * Phase 4 v1 strategy (Phase 1 assumption #7): derive from the
 * `vesting_lots` table as `sum(total_locked - withdrawn_amount)`
 * for non-voided lots. When the system later gains an on-chain
 * view call, a new class implementing `HoldingService` will
 * replace this one at wiring time; callers do not change.
 */
import type {
  AmountString,
  HoldingQuery,
  HoldingService,
  IsoTimestamp,
  UtcDate,
  WalletHoldingSnapshot,
} from '@posx/shared-types';
import { HoldingSource } from '@posx/shared-types';
import { type Clock, mulAmount, systemClock } from '@posx/shared-utils';

import type { DbClient } from '../db';

export type EvaluationPriceResolver = (input: {
  evaluationTime: IsoTimestamp;
  settlementDate?: UtcDate;
}) => Promise<AmountString>;

export class VestingDerivedHoldingService implements HoldingService {
  constructor(
    private readonly db: DbClient,
    private readonly resolveEvaluationPrice: EvaluationPriceResolver,
    private readonly clock: Clock = systemClock,
  ) {}

  async getHoldingAtTime(query: HoldingQuery): Promise<WalletHoldingSnapshot> {
    const row = await this.db.queryOne<{ total: AmountString | null }>(
      `select coalesce(sum(total_locked - withdrawn_amount), 0)::text as total
         from vesting_lots
        where wallet_address = $1 and status <> 'voided'`,
      [query.walletAddress],
    );
    const holdingPosxAmount = row?.total ?? '0';
    const evaluationTime =
      query.evaluationTime ?? (this.clock.nowIso() as IsoTimestamp);
    const evaluationPrice = await this.resolveEvaluationPrice({
      evaluationTime,
      ...(query.settlementDate !== undefined
        ? { settlementDate: query.settlementDate }
        : {}),
    });
    const holdingValueUsdt = mulAmount(holdingPosxAmount, evaluationPrice);

    return {
      walletAddress: query.walletAddress,
      evaluatedAt: evaluationTime,
      holdingPosxAmount,
      evaluationPriceUsdt: evaluationPrice,
      holdingValueUsdt,
      source: HoldingSource.DerivedFromVesting,
    };
  }

  async getHoldingsAtTime(
    queries: ReadonlyArray<HoldingQuery>,
  ): Promise<ReadonlyArray<WalletHoldingSnapshot>> {
    // Simple loop — batch sizes here are small (one settlement run's
    // eligible user list). Tune when profiling shows it matters.
    const out: WalletHoldingSnapshot[] = [];
    for (const q of queries) {
      out.push(await this.getHoldingAtTime(q));
    }
    return out;
  }
}
