/**
 * TeamAggregateService.
 *
 * Computes the `team_total_performance` and per-line
 * `effective_performance` values used by the settlement orchestrator.
 * These come from fact queries against `referral_closure` joined to
 * `purchases` — not from the derived `team_performance_snapshot`
 * table. (We build that snapshot FROM these numbers, not the other
 * way round.)
 *
 * Effective depth is supplied by the caller as
 * `{ start, end }` — the settlement orchestrator resolves it from
 * config once per run.
 */
import type { AmountString, WalletAddress } from '@posx/shared-types';
import type { EffectiveDepthConfig } from '@posx/domain-rules';

import type { DbClient } from '../db';

export interface LineEffectivePerformance {
  readonly lineRoot: WalletAddress;
  readonly effectivePerformance: AmountString;
  readonly subordinateTeamTotalPerformance: AmountString;
}

export class TeamAggregateService {
  constructor(private readonly db: DbClient) {}

  /**
   * Sum of non-reversed purchase USDT amounts for every wallet in
   * the closure of `wallet`, excluding `wallet` itself.
   */
  async teamTotalPerformance(wallet: WalletAddress): Promise<AmountString> {
    const row = await this.db.queryOne<{ total: AmountString | null }>(
      `select coalesce(sum(p.usdt_amount), 0)::text as total
         from referral_closure rc
         join purchases p on p.wallet_address = rc.descendant_wallet_address
        where rc.ancestor_wallet_address = $1
          and p.is_reversed = false`,
      [wallet],
    );
    return row?.total ?? '0';
  }

  /**
   * Compute the list of direct subordinate lines for a user, plus
   * each line's effective performance from the USER'S perspective
   * (depth range applied from the user, not from the line root).
   *
   * Returns one entry per direct subordinate. Callers iterate this
   * list when computing per-user settlement.
   */
  async linesForUser(
    wallet: WalletAddress,
    depth: EffectiveDepthConfig,
  ): Promise<ReadonlyArray<LineEffectivePerformance>> {
    const lines = await this.db.query<{
      line_root: WalletAddress;
      effective_total: AmountString | null;
    }>(
      `
      with direct as (
        select descendant_wallet_address as line_root
          from referral_closure
         where ancestor_wallet_address = $1 and depth = 1
      ),
      descendants as (
        select
          d.line_root,
          p.usdt_amount,
          rc.depth as depth_from_user
        from direct d
        join referral_closure rc
          on rc.ancestor_wallet_address = $1
         and (
              rc.descendant_wallet_address = d.line_root
              or rc.descendant_wallet_address in (
                    select rc2.descendant_wallet_address
                      from referral_closure rc2
                     where rc2.ancestor_wallet_address = d.line_root
                  )
            )
        join purchases p
          on p.wallet_address = rc.descendant_wallet_address
         and p.is_reversed = false
      )
      select
        line_root,
        coalesce(sum(usdt_amount) filter (
          where depth_from_user between $2 and $3
        ), 0)::text as effective_total
      from descendants
      group by line_root
      order by line_root
      `,
      [wallet, depth.effective_level_start, depth.effective_level_end],
    );

    // For the subordinate team total performance we also need each
    // line root's own subtree sum, computed identically to
    // `teamTotalPerformance` but per line root.
    const withSubordinate: LineEffectivePerformance[] = [];
    for (const line of lines) {
      const subTotal = await this.teamTotalPerformance(line.line_root);
      withSubordinate.push({
        lineRoot: line.line_root,
        effectivePerformance: line.effective_total ?? '0',
        subordinateTeamTotalPerformance: subTotal,
      });
    }
    return withSubordinate;
  }
}
