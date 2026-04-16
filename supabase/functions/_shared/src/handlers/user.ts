/**
 * User profile + dashboard handlers.
 */
import type { WalletAddress } from '@posx/shared-types';
import { addAmount } from '@posx/shared-utils';

import { findReferralBindingByChild } from '../repos/referral';
import {
  findUserRewardSummary,
} from '../repos/user-reward-summary';
import {
  findUserVestingSummary,
} from '../repos/summaries';
import { findUserByWallet } from '../repos/users';
import { sumCurrentLockedByWallet } from '../repos/vesting-lots';
import {
  listPurchasesByWallet,
  sumConfirmedDeposit,
} from '../repos/purchases';

import { success, type HandlerContext, type HandlerSuccess } from './types';

export async function handleGetUserProfile(
  ctx: HandlerContext,
  wallet: WalletAddress,
): Promise<
  HandlerSuccess<{
    wallet_address: string;
    status: string;
    referrer_address: string | null;
    referral_bound: boolean;
    bound_at: string | null;
    cumulative_deposit: string;
    holding_posx_amount: string;
    holding_value_usdt: string;
    current_tier: string | null;
    reward_qualified: boolean;
    team_reward_qualified: boolean;
    direct_rate: string | null;
    team_rate: string | null;
    created_at: string;
  }>
> {
  const user = await findUserByWallet(ctx.db, wallet);
  if (!user) throw new Error('user not found');
  const binding = await findReferralBindingByChild(ctx.db, wallet);
  const deposit = await sumConfirmedDeposit(ctx.db, wallet);
  const holdingPosx = await sumCurrentLockedByWallet(ctx.db, wallet);

  // Tier + rates are derived in Phase 5 via TierEvaluationService
  // wired through HandlerServices. For Phase 4.5 we return null and
  // keep the frontend unbreakable — the dashboard handler computes
  // the same values via services where it actually needs them.
  return success(ctx, {
    wallet_address: user.wallet_address,
    status: user.status,
    referrer_address: binding?.parent_wallet_address ?? null,
    referral_bound: !!binding,
    bound_at: binding?.bound_at ?? null,
    cumulative_deposit: deposit,
    holding_posx_amount: holdingPosx,
    holding_value_usdt: deposit, // v1 assumption: holding value = deposit
    current_tier: null,
    reward_qualified: false,
    team_reward_qualified: false,
    direct_rate: null,
    team_rate: null,
    created_at: user.created_at,
  });
}

export async function handleGetUserDashboard(
  ctx: HandlerContext,
  wallet: WalletAddress,
): Promise<HandlerSuccess<Record<string, unknown>>> {
  const deposit = await sumConfirmedDeposit(ctx.db, wallet);
  const holdingPosx = await sumCurrentLockedByWallet(ctx.db, wallet);
  const rewardSummary = await findUserRewardSummary(ctx.db, wallet);
  const vestingSummary = await findUserVestingSummary(ctx.db, wallet);
  const recentPurchases = (await listPurchasesByWallet(ctx.db, wallet)).slice(0, 5);

  const referralCountRow = await ctx.db.queryOne<{ count: number }>(
    `select count(*)::int as count from referral_closure
      where ancestor_wallet_address = $1 and depth = 1`,
    [wallet],
  );

  const directClaimable = '0';
  const teamClaimable = rewardSummary?.team_total ?? '0';
  const equalLevelClaimable = rewardSummary?.equal_level_total ?? '0';
  const adjustmentCreditClaimable = rewardSummary?.adjustment_credit_total ?? '0';

  return success(ctx, {
    overview: {
      cumulative_deposit: deposit,
      holding_value_usdt: deposit,
      current_tier: null,
      locked_posx_total: holdingPosx,
      referral_count: referralCountRow?.count ?? 0,
    },
    claimable: {
      direct_claimable: directClaimable,
      team_claimable: teamClaimable,
      equal_level_claimable: equalLevelClaimable,
      adjustment_credit_claimable: adjustmentCreditClaimable,
      total_claimable: rewardSummary?.claimable_total ?? '0',
    },
    reward_summary: {
      direct_total: rewardSummary?.direct_total ?? '0',
      team_total: rewardSummary?.team_total ?? '0',
      equal_level_total: rewardSummary?.equal_level_total ?? '0',
      burned_total: rewardSummary?.burned_total ?? '0',
    },
    burn_status: {
      burn_enabled: false,
      holding_value_usdt: deposit,
      burn_cap: null,
      used_burn_capacity: null,
      remaining_burn_capacity: null,
    },
    vesting_summary: {
      total_locked: vestingSummary?.total_locked ?? '0',
      total_released: vestingSummary?.total_released ?? '0',
      total_withdrawable: vestingSummary?.total_withdrawable ?? '0',
      total_withdrawn: vestingSummary?.total_withdrawn ?? '0',
    },
    recent_purchases: recentPurchases.map((p) => ({
      purchase_id: p.id,
      usdt_amount: p.usdt_amount,
      posx_amount: p.posx_amount,
      token_price_at_purchase: p.token_price_at_purchase,
      purchase_at: p.purchase_at,
    })),
  });
}

// Re-export so the router can register a single import.
export { addAmount };
