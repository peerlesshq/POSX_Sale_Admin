/**
 * User Dashboard — Phase 4 rewrite.
 *
 * Changes vs Phase 0 version:
 *   - 7-day purchase history **area chart** (AreaMini) — first chart
 *     on user-web, closes CHT-02
 *   - Proper **Skeleton** loading state instead of `Loading...` text
 *   - **InlineError** with retry button instead of a red text line
 *   - **First-time onboarding** card shown when the session has zero
 *     cumulative_deposit and zero purchases (IA-05)
 *   - Vesting progress bar uses real numbers, no fabrication
 *   - Everything wired through shared primitives — no raw Tailwind
 *     card/button classes
 */
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { ArrowRight, CheckCircle2, TrendingUp, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { api } from '../api/endpoints';
import { AreaMini } from '../components/charts';
import type { LayoutContext } from '../components/Layout';
import {
  Button,
  Card,
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
import { useClaimAll } from '../hooks/useClaimAll';
import { formatAmount } from '../lib/format';
import { t, type Locale } from '../lib/i18n';

type AnyRow = Record<string, unknown>;

function asString(v: unknown, fallback = '0'): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function readDecimal(v: unknown): Decimal {
  try {
    return new Decimal(asString(v, '0'));
  } catch {
    return new Decimal(0);
  }
}

/**
 * Bucket recent purchases into 7 daily totals ending today. Returns
 * an array of {day, total} pairs suitable for AreaMini.
 */
function bucketLast7Days(
  rows: readonly AnyRow[],
): { readonly day: string; readonly total: number; readonly label: string }[] {
  const days = 7;
  const now = new Date();
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const day = d.toISOString().slice(0, 10);
    const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    return { day, total: 0, label };
  });
  const idxByDay = new Map<string, number>();
  buckets.forEach((b, i) => idxByDay.set(b.day, i));
  for (const row of rows) {
    const raw = asString(row['purchase_at'], '').slice(0, 10);
    const idx = idxByDay.get(raw);
    if (idx === undefined) continue;
    try {
      const val = new Decimal(asString(row['usdt_amount'], '0')).toNumber();
      buckets[idx]!.total += val;
    } catch {
      /* ignore */
    }
  }
  return buckets;
}

export function DashboardPage() {
  const { locale, session } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch, error } = useQuery({
    queryKey: ['user', 'dashboard'],
    queryFn: () => api.userDashboard(),
  });

  const claim = useClaimAll({
    wallet: session.wallet,
    userStatus: session.userStatus,
  });

  // IMPORTANT: every hook call must happen unconditionally BEFORE any
  // early return, otherwise React's hook order check fails on the
  // transition from loading → loaded.
  const recent = useMemo<AnyRow[]>(
    () => ((data?.['recent_purchases'] as AnyRow[]) ?? []),
    [data],
  );
  const trendBuckets = useMemo(() => bucketLast7Days(recent), [recent]);

  /* ---------- Loading ---------- */
  if (isLoading) {
    return <DashboardSkeleton locale={locale} />;
  }

  /* ---------- Error ---------- */
  if (isError || !data) {
    return (
      <InlineError
        title={t(locale, 'common.error')}
        description={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
        retryLabel={t(locale, 'common.retry')}
      />
    );
  }

  /* ---------- Data ---------- */
  const overview = (data['overview'] as AnyRow) ?? {};
  const claimable = (data['claimable'] as AnyRow) ?? {};
  const vesting = (data['vesting_summary'] as AnyRow) ?? {};

  const totalClaimable = readDecimal(claimable['total_claimable']);
  const hasClaimable = totalClaimable.gt(0);

  const cumulativeDeposit = readDecimal(overview['cumulative_deposit']);
  const isFirstTime = cumulativeDeposit.lte(0) && recent.length === 0;

  const locked = readDecimal(vesting['total_locked']);
  const released = readDecimal(vesting['total_released']);
  const withdrawn = readDecimal(vesting['total_withdrawn']);
  const vestingTotal = locked.plus(released).plus(withdrawn);
  const vestingReleasedPct = vestingTotal.gt(0)
    ? released.plus(withdrawn).dividedBy(vestingTotal).times(100).toNumber()
    : 0;

  const trendValues = trendBuckets.map((b) => b.total);
  const trendLabels = trendBuckets.map((b) => b.label);
  const hasTrend = trendValues.some((v) => v > 0);

  const claimLabelKey = ((): string => {
    if (claim.isBlocked) return 'rewards.claim.blocked';
    switch (claim.state) {
      case 'preparing':
        return 'rewards.claim.preparing';
      case 'signing':
        return 'rewards.claim.signing';
      case 'broadcasting':
        return 'rewards.claim.broadcasting';
      case 'confirmed':
        return 'rewards.claim.confirmed';
      case 'failed':
        return 'rewards.claim.failed';
      default:
        return 'rewards.claim.idle';
    }
  })();

  return (
    <div className="space-y-6">
      <RestrictedBanner status={session.userStatus} locale={locale} scope="any" />

      {isFirstTime && <OnboardingCard locale={locale} onGoBuy={() => navigate('/buy')} />}

      {/* KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <Stat
            label={t(locale, 'dashboard.cumulative_deposit')}
            value={`${formatAmount(asString(overview['cumulative_deposit']))} USDT`}
          />
        </Card>
        <Card>
          <Stat
            label={t(locale, 'dashboard.holding_value')}
            value={`${formatAmount(asString(overview['holding_value_usdt']))} USDT`}
          />
        </Card>
        <Card>
          <Stat
            label={t(locale, 'dashboard.current_tier')}
            value={<TierValue tier={asString(overview['current_tier'], '')} locale={locale} />}
          />
        </Card>
        <Card>
          <Stat
            label={t(locale, 'dashboard.referral_count')}
            value={asString(overview['referral_count'], '0')}
          />
        </Card>
      </section>

      {/* Claimable hero */}
      <SectionCard
        title={t(locale, 'dashboard.total_claimable')}
        hint={t(locale, 'dashboard.claim_hint')}
        action={
          <Button
            variant="primary"
            size="lg"
            disabled={!hasClaimable || claim.isBlocked || claim.isBusy}
            loading={claim.isBusy}
            onClick={() => void claim.run()}
            leftIcon={<Wallet size={16} />}
          >
            {t(locale, claimLabelKey)}
          </Button>
        }
      >
        <div className="text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
          {formatAmount(totalClaimable.toString())}
          <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-2">
            USDT
          </span>
        </div>
        {claim.error && (
          <div className="mt-2 text-xs text-rose-500 dark:text-rose-400">{t(locale, claim.error, claim.error)}</div>
        )}
        {!hasClaimable && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t(locale, 'rewards.claim.empty')}
          </div>
        )}
      </SectionCard>

      {/* 7-day deposit trend chart */}
      <SectionCard
        title={t(locale, 'dashboard.trend.title')}
        hint={t(locale, 'dashboard.trend.hint')}
        action={
          <StatusPill tone="brand">
            <TrendingUp size={11} /> 7d
          </StatusPill>
        }
      >
        {hasTrend ? (
          <AreaMini values={trendValues} labels={trendLabels} height={140} tone="brand" />
        ) : (
          <EmptyHint
            title={t(locale, 'dashboard.trend.empty')}
            description={t(locale, 'dashboard.empty.purchases_sub')}
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/buy')}>
                {t(locale, 'dashboard.cta.go_buy')}
              </Button>
            }
          />
        )}
      </SectionCard>

      {/* Vesting summary */}
      <SectionCard
        title={t(locale, 'dashboard.vesting.title')}
        hint={t(locale, 'dashboard.vesting.hint')}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Stat label={t(locale, 'buy.vesting.locked')} value={formatAmount(locked.toString(), 4)} />
          <Stat
            label={t(locale, 'buy.vesting.released')}
            value={formatAmount(released.toString(), 4)}
          />
          <Stat
            label={t(locale, 'buy.vesting.withdrawable')}
            value={formatAmount(asString(vesting['total_withdrawable'], '0'), 4)}
          />
          <Stat
            label={t(locale, 'buy.vesting.withdrawn')}
            value={formatAmount(withdrawn.toString(), 4)}
          />
        </div>
        {vestingTotal.gt(0) && (
          <ProgressBar
            value={vestingReleasedPct}
            max={100}
            label={t(locale, 'buy.vesting.progress')}
            trailing={`${vestingReleasedPct.toFixed(1)}%`}
            tone="brand"
          />
        )}
      </SectionCard>

      {/* Recent purchases */}
      <SectionCard
        title={t(locale, 'dashboard.recent_purchases')}
        hint={t(locale, 'dashboard.recent_purchases.hint')}
        action={
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight size={14} />}
            onClick={() => navigate('/buy')}
          >
            {t(locale, 'dashboard.cta.go_buy')}
          </Button>
        }
        padded={false}
      >
        {recent.length === 0 ? (
          <EmptyHint
            title={t(locale, 'dashboard.empty.purchases')}
            description={t(locale, 'dashboard.empty.purchases_sub')}
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/buy')}>
                {t(locale, 'dashboard.cta.go_buy')}
              </Button>
            }
          />
        ) : (
          <div className="px-4">
            {recent.map((row, idx) => (
              <InfoRow
                key={idx}
                label={asString(row['purchase_at'], '').slice(0, 10)}
                sublabel={asString(row['status'], '')}
                value={`${formatAmount(asString(row['usdt_amount']))} USDT`}
                accent={`${asString(row['received_posx'], '0')} POSX`}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onboarding first-screen                                             */
/* ------------------------------------------------------------------ */

function OnboardingCard({
  locale,
  onGoBuy,
}: {
  locale: Locale;
  onGoBuy: () => void;
}) {
  return (
    <SectionCard
      title={t(locale, 'dashboard.onboarding.title')}
      hint={t(locale, 'dashboard.onboarding.subtitle')}
      action={
        <Button
          variant="primary"
          size="md"
          onClick={onGoBuy}
          rightIcon={<ArrowRight size={14} />}
        >
          {t(locale, 'dashboard.cta.go_buy')}
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <OnboardingStep
          step="1"
          title={t(locale, 'dashboard.onboarding.step1')}
          body={t(locale, 'dashboard.onboarding.step1_body')}
        />
        <OnboardingStep
          step="2"
          title={t(locale, 'dashboard.onboarding.step2')}
          body={t(locale, 'dashboard.onboarding.step2_body')}
        />
        <OnboardingStep
          step="3"
          title={t(locale, 'dashboard.onboarding.step3')}
          body={t(locale, 'dashboard.onboarding.step3_body')}
        />
      </div>
    </SectionCard>
  );
}

function OnboardingStep({
  step,
  title,
  body,
}: {
  step: string;
  title: React.ReactNode;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-500 inline-flex items-center justify-center font-semibold text-sm">
        {step}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton state                                                     */
/* ------------------------------------------------------------------ */

function DashboardSkeleton({ locale }: { locale: Locale }) {
  void locale;
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton variant="text" width="4rem" />
            <div className="mt-2">
              <Skeleton variant="line" width="70%" height="1.4rem" />
            </div>
          </Card>
        ))}
      </section>
      <Card>
        <SkeletonGroup rows={2} />
        <div className="mt-3">
          <Skeleton variant="block" height="2.5rem" width="10rem" />
        </div>
      </Card>
      <Card>
        <Skeleton variant="block" height="140px" />
      </Card>
      <Card>
        <SkeletonGroup rows={4} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function TierValue({ tier, locale }: { tier: string; locale: Locale }) {
  if (!tier || tier === '-' || tier === 'null') {
    return (
      <span className="text-slate-500 dark:text-slate-500">
        {t(locale, 'common.none')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <CheckCircle2 size={14} className="text-brand-600 dark:text-brand-500" />
      <StatusPill tone="brand">{tier.toUpperCase()}</StatusPill>
    </span>
  );
}
