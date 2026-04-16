/**
 * User status transition guard.
 *
 * Source of truth: 07_state_machines_and_exception_flows.md §5.2
 *
 * `blacklisted → active` and `blacklisted → suspended` are allowed
 * per spec "only by super-admin exceptional action if policy allows"
 * (07 §5.2). This guard does not encode the super-admin requirement
 * — callers must check role permission BEFORE invoking a transition
 * out of `blacklisted`. The guard only prevents transitions that are
 * never allowed regardless of actor.
 */
import {
  UserStatus,
  type UserStatus as Status,
} from '@posx/shared-types';

const ALLOWED: Readonly<Record<Status, ReadonlyArray<Status>>> = {
  [UserStatus.Active]: [
    UserStatus.RestrictedPurchase,
    UserStatus.RestrictedClaim,
    UserStatus.Suspended,
    UserStatus.Blacklisted,
  ],
  [UserStatus.RestrictedPurchase]: [
    UserStatus.Active,
    UserStatus.Suspended,
    UserStatus.Blacklisted,
  ],
  [UserStatus.RestrictedClaim]: [
    UserStatus.Active,
    UserStatus.Suspended,
    UserStatus.Blacklisted,
  ],
  [UserStatus.Suspended]: [
    UserStatus.Active,
    UserStatus.RestrictedPurchase,
    UserStatus.RestrictedClaim,
    UserStatus.Blacklisted,
  ],
  [UserStatus.Blacklisted]: [
    UserStatus.Active,
    UserStatus.Suspended,
  ],
};

export function canTransitionUserStatus(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertUserStatusTransition(from: Status, to: Status): void {
  if (!canTransitionUserStatus(from, to)) {
    throw new Error(`Forbidden user_status transition: ${from} -> ${to}`);
  }
}
