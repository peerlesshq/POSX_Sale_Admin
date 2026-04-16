/**
 * UserAccessPolicyService.
 *
 * Source of truth: 08_auth_and_permissions_spec.md §7, §21. Wraps
 * `resolveUserCapabilities` from `@posx/domain-rules` so that every
 * handler / service asks ONE function "can this user do X?" rather
 * than inlining status comparisons.
 *
 * All mutation APIs (purchase creation, claim creation, referral
 * binding, invite actions) must invoke the appropriate `assert*`
 * method before running business logic.
 */
import {
  type UserStatus as UserStatusType,
  type WalletAddress,
} from '@posx/shared-types';
import {
  resolveUserCapabilities,
  type UserCapabilities,
} from '@posx/domain-rules';

import type { DbClient } from '../db';
import { AppError } from '../errors';
import { findUserByWallet } from '../repos/users';

export class UserAccessPolicyService {
  constructor(private readonly db: DbClient) {}

  async resolveForWallet(wallet: WalletAddress): Promise<{
    status: UserStatusType;
    capabilities: UserCapabilities;
  }> {
    const user = await findUserByWallet(this.db, wallet);
    if (!user) {
      throw new AppError('NOT_FOUND', 'user not found');
    }
    return {
      status: user.status,
      capabilities: resolveUserCapabilities(user.status),
    };
  }

  async assertCanPurchase(wallet: WalletAddress): Promise<void> {
    const { capabilities, status } = await this.resolveForWallet(wallet);
    if (!capabilities.can_purchase) {
      throw new AppError(
        'PURCHASE_NOT_ALLOWED',
        `purchase not allowed for user status ${status}`,
        { details: { user_status: status } },
      );
    }
  }

  async assertCanClaim(wallet: WalletAddress): Promise<void> {
    const { capabilities, status } = await this.resolveForWallet(wallet);
    if (!capabilities.can_claim) {
      throw new AppError(
        'CLAIM_NOT_ALLOWED',
        `claim not allowed for user status ${status}`,
        { details: { user_status: status } },
      );
    }
  }

  async assertCanBindReferralOnFirstPurchase(
    wallet: WalletAddress,
  ): Promise<void> {
    const { capabilities, status } = await this.resolveForWallet(wallet);
    if (!capabilities.can_bind_referral_on_first_purchase) {
      throw new AppError(
        'USER_STATUS_RESTRICTED',
        `referral binding not allowed for user status ${status}`,
      );
    }
  }

  async canAccrueOffChainRewards(wallet: WalletAddress): Promise<boolean> {
    const { capabilities } = await this.resolveForWallet(wallet);
    return capabilities.can_accrue_offchain_rewards;
  }
}
