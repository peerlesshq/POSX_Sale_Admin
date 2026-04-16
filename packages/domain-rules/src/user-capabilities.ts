/**
 * User capability policy.
 *
 * Sources of truth:
 *   - 01_business_rules_spec.md §13
 *   - 08_auth_and_permissions_spec.md §7
 *
 * Converts a `UserStatus` into the concrete capability flags used by
 * both backend guards and frontend UI. These rules are deterministic
 * and intentionally simple — if the status matrix changes, update it
 * here in ONE place. Callers never inline status comparisons outside
 * this module.
 */
import { UserStatus, type UserStatus as UserStatusType } from '@posx/shared-types';

export interface UserCapabilities {
  readonly can_purchase: boolean;
  readonly can_claim: boolean;
  readonly can_bind_referral_on_first_purchase: boolean;
  readonly can_accrue_offchain_rewards: boolean;
  readonly can_use_invite_actions: boolean;
}

const CAPABILITIES: Readonly<Record<UserStatusType, UserCapabilities>> = {
  [UserStatus.Active]: {
    can_purchase: true,
    can_claim: true,
    can_bind_referral_on_first_purchase: true,
    can_accrue_offchain_rewards: true,
    can_use_invite_actions: true,
  },
  [UserStatus.RestrictedPurchase]: {
    can_purchase: false,
    can_claim: true,
    can_bind_referral_on_first_purchase: false,
    can_accrue_offchain_rewards: true,
    can_use_invite_actions: true,
  },
  [UserStatus.RestrictedClaim]: {
    can_purchase: true,
    can_claim: false,
    can_bind_referral_on_first_purchase: true,
    can_accrue_offchain_rewards: true,
    can_use_invite_actions: true,
  },
  [UserStatus.Suspended]: {
    can_purchase: false,
    can_claim: false,
    can_bind_referral_on_first_purchase: false,
    // 01 §13.5: from effective suspension time forward, no new
    // off-chain team/equal-level rewards should be generated.
    can_accrue_offchain_rewards: false,
    can_use_invite_actions: false,
  },
  [UserStatus.Blacklisted]: {
    can_purchase: false,
    can_claim: false,
    can_bind_referral_on_first_purchase: false,
    can_accrue_offchain_rewards: false,
    can_use_invite_actions: false,
  },
};

export function resolveUserCapabilities(status: UserStatusType): UserCapabilities {
  return CAPABILITIES[status];
}

export function canPurchase(status: UserStatusType): boolean {
  return CAPABILITIES[status].can_purchase;
}

export function canClaim(status: UserStatusType): boolean {
  return CAPABILITIES[status].can_claim;
}

export function canBindReferralOnFirstPurchase(status: UserStatusType): boolean {
  return CAPABILITIES[status].can_bind_referral_on_first_purchase;
}

export function canAccrueOffChainRewards(status: UserStatusType): boolean {
  return CAPABILITIES[status].can_accrue_offchain_rewards;
}

export function canUseInviteActions(status: UserStatusType): boolean {
  return CAPABILITIES[status].can_use_invite_actions;
}
