/**
 * Rewards page — Phase 0 remediation.
 *
 * Changes from the wireframe:
 *   - Tab labels come from i18n (`rewards.tab.overview`, `.direct`,
 *     `.team`, `.equal`, `.burn`, `.history`) — previously they rendered
 *     the raw English enum keys.
 *   - The claim flow uses the shared `useClaimAll` hook and degrades
 *     gracefully for `restricted_claim / suspended / blacklisted`.
 *   - Burn tab renders a real summary card with progress bar —
 *     previously it was `<pre>{JSON.stringify(burn.data)}</pre>`.
 *   - Direct / Team / Equal / History tabs render through `RewardList`
 *     which produces a real list of `InfoRow` entries — previously
 *     those were also `<pre>` dumps.
 *   - Every string localized.
 */
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { ShieldCheck, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { api } from '../api/endpoints';
import { DonutMini, type DonutSegment } from '../components/charts';
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
import { t } from '../lib/i18n';

type Tab = 'overview' | 'direct' | 'team' | 'equal' | 'burn' | 'history';

type AnyRow = Record<string, unknown>;

const TABS: readonly Tab[] = ['overview', 'direct', 'team', 'equal', 'burn', 'history'];

const TAB_LABEL_KEYS: Record<Tab, string> = {
  overview: 'rewards.tab.overview',
  direct: 'rewards.tab.direct',
  team: 'rewards.tab.team',
  equal: 'rewards.tab.equal',
  burn: 'rewards.tab.burn',
  history: 'rewards.tab.history',
};

const REWARD_TYPE_LABEL: Record<string, string> = {
  direct_reward: 'rewards.direct',
  team_reward: 'rewards.team',
  equal_level_reward: 'rewards.equal_level',
  direct: 'rewards.direct',
  team: 'rewards.team',
  equal: 'rewards.equal_level',
};

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

export function RewardsPage() {
  const { locale, session } = useOutletContext<LayoutContext>();
  const [tab, setTab] = useState<Tab>('overview');

  const overview = useQuery({
    queryKey: ['rewards', 'overview'],
    queryFn: api.rewardOverview,
  });
  const burn = useQuery({
    queryKey: ['rewards', 'burn-status'],
    queryFn: api.burnStatus,
  });

  const claim = useClaimAll({
    wallet: session.wallet,
    userStatus: session.userStatus,
  });

  const claimable = (overview.data?.['claimable'] as Record<string, string>) ?? {};
  const totalClaimable = useMemo(() => {
    let sum = new Decimal(0);
    for (const v of Object.values(claimable)) {
      try {
        sum = sum.plus(new Decimal(v));
      } catch {
        /* ignore */
      }
    }
    return sum;
  }, [claimable]);

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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t(locale, 'rewards.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(locale, 'rewards.subtitle')}
        </p>
      </div>

      <RestrictedBanner status={session.userStatus} locale={locale} scope="claim" />

      {/* Tab nav — translated labels */}
      <nav
        className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800"
        role="tablist"
      >
        {TABS.map((k) => {
          const active = tab === k;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(k)}
              className={[
                'h-10 px-3 text-sm font-medium transition-colors relative',
                active
                  ? 'text-brand-600 dark:text-brand-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
              ].join(' ')}
            >
              {t(locale, TAB_LABEL_KEYS[k])}
              {active && (
                <span className="absolute left-3 right-3 bottom-[-1px] h-0.5 rounded-full bg-brand-600 dark:bg-brand-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {overview.isLoading && <OverviewSkeleton />}
          {overview.isError && !overview.isLoading && (
            <InlineError
              title={t(locale, 'common.error')}
              description={
                overview.error instanceof Error ? overview.error.message : undefined
              }
              onRetry={() => void overview.refetch()}
              retryLabel={t(locale, 'common.retry')}
            />
          )}
          {!overview.isLoading && !overview.isError && (
            <>
              <SectionCard
                title={t(locale, 'rewards.claimable.total')}
                action={
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={
                      totalClaimable.lte(0) || claim.isBlocked || claim.isBusy
                    }
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
                  <div className="mt-2 text-xs text-rose-500 dark:text-rose-400">
                    {claim.error}
                  </div>
                )}
                {totalClaimable.lte(0) && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t(locale, 'rewards.claim.empty_sub')}
                  </div>
                )}
              </SectionCard>

              {/* Donut breakdown — new in Phase 4 */}
              {Object.keys(claimable).length > 0 && (
                <SectionCard title={t(locale, 'rewards.donut.title')}>
                  <DonutMini
                    segments={buildDonutSegments(claimable, locale)}
                    centerLabel={t(locale, 'rewards.donut.center_label')}
                    centerValue={`${formatAmount(totalClaimable.toString())}`}
                    size={160}
                  />
                </SectionCard>
              )}

              <SectionCard
                title={t(locale, 'rewards.claimable.by_type')}
                padded={false}
              >
                {Object.keys(claimable).filter((k) => !DONUT_SKIP_KEYS.has(k)).length === 0 ? (
                  <EmptyHint
                    title={t(locale, 'rewards.claim.empty')}
                    description={t(locale, 'rewards.claim.empty_sub')}
                  />
                ) : (
                  <div className="px-4">
                    {Object.entries(claimable)
                      .filter(([k]) => !DONUT_SKIP_KEYS.has(k))
                      .map(([k, v]) => (
                        <InfoRow
                          key={k}
                          label={
                            <StatusPill tone="brand">
                              {t(locale, REWARD_TYPE_LABEL[k] ?? `rewards.${k}`, k)}
                            </StatusPill>
                          }
                          value={`${formatAmount(v)} USDT`}
                        />
                      ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      )}

      {/* Burn tab */}
      {tab === 'burn' && (
        <BurnView locale={locale} data={burn.data as AnyRow | undefined} />
      )}

      {/* List tabs */}
      {(tab === 'direct' || tab === 'team' || tab === 'equal' || tab === 'history') && (
        <RewardList type={tab} locale={locale} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Burn view                                                          */
/* ------------------------------------------------------------------ */

function BurnView({ locale, data }: { locale: string; data: AnyRow | undefined }) {
  if (!data) {
    return (
      <Card>
        <div className="h-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800/60" />
      </Card>
    );
  }

  const holding = readDecimal(data['holding_value_usdt']);
  const required = readDecimal(data['required_holding']);
  const burned = readDecimal(data['total_burned'] ?? data['burn_total']);

  const safe = holding.gte(required) && required.gt(0);
  const pct = required.gt(0)
    ? Math.min(100, holding.dividedBy(required).times(100).toNumber())
    : 0;

  return (
    <div className="space-y-4">
      <SectionCard
        title={t(locale as never, 'rewards.burn_status')}
        action={
          <StatusPill tone={safe ? 'success' : 'warning'}>
            {t(
              locale as never,
              safe ? 'rewards.burn.safe' : 'rewards.burn.at_risk',
            )}
          </StatusPill>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <Stat
            label={t(locale as never, 'rewards.burn.holding')}
            value={`${formatAmount(holding.toString())} USDT`}
            tone={safe ? 'success' : 'warning'}
          />
          <Stat
            label={t(locale as never, 'rewards.burn.required')}
            value={`${formatAmount(required.toString())} USDT`}
          />
          <Stat
            label={t(locale as never, 'rewards.burn.burned_total')}
            value={`${formatAmount(burned.toString(), 4)} POSX`}
            tone={burned.gt(0) ? 'danger' : 'default'}
          />
        </div>
        <ProgressBar
          value={pct}
          max={100}
          label={t(locale as never, 'rewards.burn.holding')}
          trailing={`${pct.toFixed(1)}%`}
          tone={safe ? 'success' : 'warning'}
        />
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reward list                                                        */
/* ------------------------------------------------------------------ */

function RewardList({
  type,
  locale,
}: {
  type: 'direct' | 'team' | 'equal' | 'history';
  locale: string;
}) {
  const query = useQuery({
    queryKey: ['rewards', type],
    queryFn: () => {
      if (type === 'direct') return api.rewardsDirect();
      if (type === 'team') return api.rewardsTeam();
      if (type === 'equal') return api.rewardsEqualLevel();
      return api.claimHistory();
    },
  });

  if (query.isLoading) {
    return (
      <Card>
        <SkeletonGroup rows={4} />
      </Card>
    );
  }

  if (query.isError) {
    return (
      <InlineError
        title={t(locale as never, 'common.error')}
        description={
          query.error instanceof Error ? query.error.message : undefined
        }
        onRetry={() => void query.refetch()}
        retryLabel={t(locale as never, 'common.retry')}
      />
    );
  }

  const items = (query.data?.['items'] as AnyRow[]) ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <EmptyHint
          title={t(locale as never, 'rewards.list.empty')}
          description={t(locale as never, 'rewards.list.empty_sub')}
          icon={<ShieldCheck size={24} />}
        />
      </Card>
    );
  }

  return (
    <SectionCard
      title={t(locale as never, TAB_LABEL_KEYS[type])}
      padded={false}
    >
      <div className="px-4">
        {items.map((row, idx) => {
          const dateRaw = asString(
            row['settlement_date'] ?? row['created_at'] ?? row['claimed_at'],
            '',
          );
          const amount = asString(
            row['reward_amount'] ?? row['amount'] ?? row['claim_amount'],
            '0',
          );
          const typeKey = asString(row['reward_type'] ?? row['type'] ?? type, type);
          const source = asString(
            row['source_wallet_address'] ?? row['claim_scope'],
            '',
          );
          return (
            <InfoRow
              key={(row['id'] as string) ?? idx}
              label={
                <span className="inline-flex items-center gap-2">
                  <StatusPill tone="brand">
                    {t(
                      locale as never,
                      REWARD_TYPE_LABEL[typeKey] ?? `rewards.${typeKey}`,
                      typeKey,
                    )}
                  </StatusPill>
                  <span className="text-xs text-slate-500">{dateRaw.slice(0, 10)}</span>
                </span>
              }
              sublabel={source ? shortenWallet(source) : undefined}
              value={`${formatAmount(amount)} USDT`}
            />
          );
        })}
      </div>
    </SectionCard>
  );
}

function shortenWallet(wallet: string): string {
  if (!wallet || wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Donut segment builder                                              */
/* ------------------------------------------------------------------ */

const DONUT_TONE_MAP: Record<string, DonutSegment['tone']> = {
  direct_reward: 'brand',
  team_reward: 'emerald',
  equal_level_reward: 'violet',
  direct: 'brand',
  team: 'emerald',
  equal: 'violet',
};

/**
 * Aggregate keys that should NOT appear as donut segments. These are
 * "grand total" fields returned alongside the per-type buckets — the
 * mock API (and some real backends) put them in the same object.
 */
const DONUT_SKIP_KEYS = new Set([
  'total_claimable',
  'total',
  'grand_total',
  'claimable_total',
]);

function buildDonutSegments(
  claimable: Record<string, string>,
  locale: string,
): DonutSegment[] {
  return Object.entries(claimable)
    .filter(([k]) => !DONUT_SKIP_KEYS.has(k))
    .map(([k, v]) => {
      let val = 0;
      try {
        val = new Decimal(v).toNumber();
      } catch {
        /* ignore */
      }
      return {
        key: k,
        label: t(locale as never, REWARD_TYPE_LABEL[k] ?? `rewards.${k}`, k),
        value: val,
        tone: DONUT_TONE_MAP[k] ?? 'brand',
      } satisfies DonutSegment;
    })
    .filter((s) => s.value > 0);
}

/* ------------------------------------------------------------------ */
/*  Overview skeleton                                                  */
/* ------------------------------------------------------------------ */

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <Skeleton variant="text" width="8rem" />
        <div className="mt-3">
          <Skeleton variant="line" width="60%" height="2rem" />
        </div>
      </Card>
      <Card>
        <SkeletonGroup rows={3} />
      </Card>
    </div>
  );
}
