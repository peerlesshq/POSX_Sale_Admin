/**
 * RestrictedBanner — honest restricted-status communication.
 *
 * Previously the app never read `session.userStatus`; a restricted
 * user pressed Claim and discovered the ban only via an API error.
 * This banner appears above affected CTAs explaining what's blocked
 * and why.
 *
 * Usage:
 *   <RestrictedBanner status={session.userStatus} scope="claim" />
 */
import { AlertTriangle } from 'lucide-react';
import type { FC } from 'react';

import { t, type Locale } from '../../lib/i18n';

export type UserStatus =
  | 'active'
  | 'restricted_purchase'
  | 'restricted_claim'
  | 'suspended'
  | 'blacklisted'
  | string;

interface RestrictedBannerProps {
  readonly status: UserStatus;
  readonly locale: Locale;
  /**
   * Which feature this banner is guarding. Used to decide whether to
   * render:
   *   - 'purchase' hides for non-purchase restrictions
   *   - 'claim' hides for non-claim restrictions
   *   - 'team'   shows only for hard account restrictions
   *              (`suspended`, `blacklisted`) — soft purchase/claim
   *              restrictions do not block reading the team view
   *   - 'invite' shows only for hard account restrictions — the
   *              invite surface is an action, so suspended users see
   *              the banner AND the share UI hides itself
   *   - 'any'    shows for all non-active states
   */
  readonly scope: 'purchase' | 'claim' | 'team' | 'invite' | 'any';
}

export const RestrictedBanner: FC<RestrictedBannerProps> = ({ status, locale, scope }) => {
  if (status === 'active') return null;

  // Scope filter: only render when the status actually blocks this page.
  if (scope === 'purchase') {
    if (status !== 'restricted_purchase' && status !== 'suspended' && status !== 'blacklisted') {
      return null;
    }
  }
  if (scope === 'claim') {
    if (status !== 'restricted_claim' && status !== 'suspended' && status !== 'blacklisted') {
      return null;
    }
  }
  if (scope === 'team' || scope === 'invite') {
    // Team stats stay visible (read-only) but hard account
    // restrictions must surface here too — the user deserves to
    // know their account is suspended before they try to share an
    // invite link or dispute a missing reward.
    if (status !== 'suspended' && status !== 'blacklisted') {
      return null;
    }
  }

  const statusKey = `status.${status}`;
  const label = t(locale, statusKey, status);

  const toneClass =
    status === 'suspended' || status === 'blacklisted'
      ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
      : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300';

  return (
    <div
      role="alert"
      className={[
        'rounded-lg border px-3 py-2 flex items-start gap-3 text-sm',
        toneClass,
      ].join(' ')}
    >
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-xs opacity-85 mt-0.5">
          {t(
            locale,
            `restricted.${scope}`,
            scope === 'purchase'
              ? 'Purchases are disabled while your account is in this state.'
              : scope === 'claim'
                ? 'Claims are disabled while your account is in this state.'
                : scope === 'team'
                  ? 'Your account is restricted — team stats may be stale until this is resolved.'
                  : scope === 'invite'
                    ? 'Your account is restricted — new invitations and referral rewards are disabled.'
                    : 'Some actions are disabled while your account is in this state.',
          )}
        </div>
      </div>
    </div>
  );
};
