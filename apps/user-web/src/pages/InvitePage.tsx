/**
 * Invite page — Phase 4 rewrite.
 *
 * Changes vs Phase 0:
 *   - QR code tile (UF-05) — finally closed. Uses `qrcode.react`.
 *   - Social share buttons (Telegram / X / WhatsApp) with pre-filled
 *     share URLs that open in a new tab.
 *   - Proper Skeleton + InlineError states for loading + failures.
 *   - Retry capability on both queries.
 *   - Locked state still shows the progress bar + CTA back to /buy.
 *
 * `qrcode.react` is ~20KB gzipped and is the de-facto React QR library.
 */
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { MessageCircle, Phone, Send, Share2, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { api } from '../api/endpoints';
import type { LayoutContext } from '../components/Layout';
import {
  Button,
  Card,
  CopyButton,
  EmptyHint,
  InfoRow,
  InlineError,
  ProgressBar,
  RestrictedBanner,
  SectionCard,
  Skeleton,
  SkeletonGroup,
  Stat,
  StatusPill,
} from '../components/ui';
import { formatAmount, maskWallet } from '../lib/format';
import { t, type Locale } from '../lib/i18n';

type AnyRow = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function safeDecimal(v: unknown): Decimal {
  try {
    return new Decimal(asString(v, '0'));
  } catch {
    return new Decimal(0);
  }
}

export function InvitePage() {
  const { locale, session } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const userStatus = session.userStatus ?? 'active';
  const hardBlocked =
    userStatus === 'suspended' || userStatus === 'blacklisted';

  const invite = useQuery({ queryKey: ['invite'], queryFn: api.invite });
  const referrals = useQuery({
    queryKey: ['invite', 'referrals'],
    queryFn: () => api.inviteReferrals({ page: 1, page_size: 20 }),
  });

  /* ---------- Loading ---------- */
  if (invite.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton variant="text" width="10rem" height="1.6rem" />
          <div className="mt-2">
            <Skeleton variant="line" width="70%" />
          </div>
        </div>
        <Card>
          <SkeletonGroup rows={4} />
        </Card>
      </div>
    );
  }

  /* ---------- Error ---------- */
  if (invite.isError || !invite.data) {
    return (
      <InlineError
        title={t(locale, 'common.error')}
        description={invite.error instanceof Error ? invite.error.message : undefined}
        onRetry={() => void invite.refetch()}
        retryLabel={t(locale, 'common.retry')}
      />
    );
  }

  const data = invite.data;
  // The real backend sends `invite_unlocked`; the mock sends `locked`
  // (inverted). Accept either shape so the UI works in both modes.
  const unlocked =
    'invite_unlocked' in data
      ? Boolean(data['invite_unlocked'])
      : !data['locked'];
  const link = asString(data['invite_link'], '');
  const threshold = safeDecimal(data['unlock_threshold']);
  const current = safeDecimal(data['current_cumulative_deposit']);
  const needMore = Decimal.max(0, threshold.minus(current));
  const unlockPct = threshold.gt(0)
    ? Math.min(100, current.dividedBy(threshold).times(100).toNumber())
    : 0;
  const referralCount = Number(data['referral_count'] ?? 0);
  const referralItems = (referrals.data?.['items'] as AnyRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t(locale, 'invite.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(locale, 'invite.subtitle')}
        </p>
      </div>

      {/* FE-04: hard account restrictions show the banner here AND
          hide the share surface below so a suspended/blacklisted
          user can't generate new invites that would never earn
          referral rewards. */}
      <RestrictedBanner status={userStatus} locale={locale} scope="invite" />

      {hardBlocked ? (
        <SectionCard title={t(locale, 'restricted.invite', 'Invite disabled')}>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {t(
              locale,
              'restricted.invite.long',
              'Your account is currently restricted. Contact support to resolve the issue before inviting new users.',
            )}
          </div>
        </SectionCard>
      ) : !unlocked ? (
        <SectionCard title={t(locale, 'invite.locked')}>
          <div className="space-y-4">
            <ProgressBar
              value={unlockPct}
              max={100}
              label={t(locale, 'invite.unlock.progress_label')}
              trailing={`${unlockPct.toFixed(1)}%`}
              tone="brand"
            />
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label={t(locale, 'dashboard.cumulative_deposit')}
                value={`${formatAmount(current.toString())} USDT`}
              />
              <Stat
                label={t(locale, 'invite.unlock.need_more').replace('{amount}', '')}
                value={`${formatAmount(needMore.toString())} USDT`}
                tone="warning"
              />
            </div>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => navigate('/buy')}
            >
              {t(locale, 'invite.unlock.cta_buy')}
            </Button>
          </div>
        </SectionCard>
      ) : (
        <>
          {/* QR + Link + Share */}
          <SectionCard
            title={t(locale, 'invite.link')}
            hint={t(locale, 'invite.link.hint')}
            action={
              <StatusPill tone="brand">
                {referralCount} {t(locale, 'invite.referrals.count')}
              </StatusPill>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-start">
              {/* QR tile */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-100 border border-slate-200 dark:border-slate-300 shadow-sm">
                  <QRCodeSVG
                    value={link}
                    size={156}
                    level="M"
                    marginSize={0}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center max-w-[180px]">
                  {t(locale, 'invite.qr.hint')}
                </div>
              </div>

              {/* Link + actions */}
              <div className="space-y-3 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                    className={[
                      'flex-1 h-11 rounded-md border px-3 text-xs font-mono',
                      'border-slate-300 dark:border-slate-700',
                      'bg-slate-50 dark:bg-slate-900',
                      'text-slate-900 dark:text-slate-100',
                      'focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500',
                    ].join(' ')}
                  />
                  <CopyButton
                    value={link}
                    labelIdle={t(locale, 'invite.copy')}
                    labelCopied={t(locale, 'common.copied')}
                    size="md"
                    variant="primary"
                  />
                </div>

                {/* Social share buttons */}
                <ShareButtons locale={locale} link={link} />

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Share2 size={12} />
                  <span>{t(locale, 'invite.link.hint')}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Referrals list */}
          <SectionCard
            title={t(locale, 'invite.referrals.title')}
            hint={t(locale, 'invite.referrals.hint')}
            padded={false}
          >
            {referrals.isLoading ? (
              <div className="p-4">
                <SkeletonGroup rows={4} />
              </div>
            ) : referrals.isError ? (
              <div className="p-4">
                <InlineError
                  title={t(locale, 'common.error')}
                  description={
                    referrals.error instanceof Error ? referrals.error.message : undefined
                  }
                  onRetry={() => void referrals.refetch()}
                  retryLabel={t(locale, 'common.retry')}
                  compact
                />
              </div>
            ) : referralItems.length === 0 ? (
              <EmptyHint
                title={t(locale, 'invite.referrals.empty')}
                description={t(locale, 'invite.referrals.empty_sub')}
                icon={<Users size={24} />}
              />
            ) : (
              <div className="px-4">
                {referralItems.map((row, idx) => {
                  const wallet = asString(row['wallet_address'] ?? row['wallet'], '');
                  const deposit = asString(
                    row['cumulative_deposit'] ?? row['deposit'],
                    '0',
                  );
                  const joinedRaw = asString(
                    row['bound_at'] ?? row['created_at'] ?? row['joined_at'],
                    '',
                  );
                  const status = asString(row['status'] ?? 'active', 'active');
                  return (
                    <InfoRow
                      key={(row['id'] as string) ?? idx}
                      label={<span className="font-mono text-xs">{maskWallet(wallet)}</span>}
                      sublabel={
                        <span className="inline-flex items-center gap-2">
                          <StatusPill tone={status === 'active' ? 'success' : 'warning'}>
                            {t(locale, `status.${status}`, status)}
                          </StatusPill>
                          <span>{joinedRaw.slice(0, 10)}</span>
                        </span>
                      }
                      value={`${formatAmount(deposit)} USDT`}
                    />
                  );
                })}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social share buttons                                                */
/* ------------------------------------------------------------------ */

function ShareButtons({ locale, link }: { locale: Locale; link: string }) {
  const encodedLink = encodeURIComponent(link);
  const shareText = encodeURIComponent(t(locale, 'landing.hero.title'));

  const telegramUrl = `https://t.me/share/url?url=${encodedLink}&text=${shareText}`;
  const xUrl = `https://twitter.com/intent/tweet?url=${encodedLink}&text=${shareText}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}%20${encodedLink}`;

  return (
    <div className="flex flex-wrap gap-2">
      <ShareButton
        href={telegramUrl}
        icon={<Send size={13} />}
        label={t(locale, 'invite.share.telegram')}
      />
      <ShareButton
        href={xUrl}
        icon={<MessageCircle size={13} />}
        label={t(locale, 'invite.share.x')}
      />
      <ShareButton
        href={whatsappUrl}
        icon={<Phone size={13} />}
        label={t(locale, 'invite.share.whatsapp')}
      />
    </div>
  );
}

function ShareButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={[
        'inline-flex items-center gap-2 h-9 px-3',
        'rounded-md border border-slate-300 dark:border-slate-700',
        'bg-white dark:bg-slate-900/50',
        'text-xs font-medium text-slate-700 dark:text-slate-300',
        'hover:bg-slate-50 dark:hover:bg-slate-800',
        'hover:text-brand-600 dark:hover:text-brand-500',
        'transition-colors',
      ].join(' ')}
    >
      {icon}
      {label}
    </a>
  );
}
