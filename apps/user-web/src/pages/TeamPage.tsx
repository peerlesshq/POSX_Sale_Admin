/**
 * Team page — Phase 4 rewrite.
 *
 * Changes vs Phase 0:
 *   - Daily performance bar chart (BarMini) — first visualization on
 *     this page (closes CHT-02 for the team surface)
 *   - Proper Skeleton + InlineError states instead of raw text
 *   - Loading / error states now retry-capable
 *   - Members list gracefully degrades to a helpful empty state with
 *     a CTA back to the Invite page
 */
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { BarChart3, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { api } from '../api/endpoints';
import { BarMini } from '../components/charts';
import type { LayoutContext } from '../components/Layout';
import {
  Button,
  EmptyHint,
  InfoRow,
  InlineError,
  RestrictedBanner,
  SectionCard,
  Skeleton,
  SkeletonGroup,
  Stat,
  StatusPill,
} from '../components/ui';
import { formatAmount, formatRate, maskWallet } from '../lib/format';
import { t } from '../lib/i18n';

type AnyRow = Record<string, unknown>;

function asString(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function TeamPage() {
  const { locale, session } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  const overview = useQuery({ queryKey: ['team', 'overview'], queryFn: api.teamOverview });
  const members = useQuery({
    queryKey: ['team', 'members'],
    queryFn: () => api.teamMembers({ page: 1, page_size: 20 }),
  });
  const daily = useQuery({
    queryKey: ['team', 'daily-details'],
    queryFn: () => api.teamDailyDetails({ page: 1, page_size: 14 }),
  });

  const memberItems = (members.data?.['items'] as AnyRow[]) ?? [];
  const dailyItems = (daily.data?.['items'] as AnyRow[]) ?? [];

  const dailySeries = useMemo(() => {
    // Expect an array sorted newest → oldest; we reverse to chronological
    const chronological = [...dailyItems].reverse();
    return chronological.map((row) => {
      const date = asString(row['settlement_date'] ?? row['date']).slice(0, 10);
      const performance = asString(
        row['effective_performance'] ?? row['performance'],
        '0',
      );
      const reward = asString(row['reward_amount'] ?? row['amount'], '0');
      const rate = asString(row['team_rate'] ?? row['rate'], '0');
      let perfNum = 0;
      try {
        perfNum = new Decimal(performance).toNumber();
      } catch {
        /* ignore */
      }
      // Render label as short MM/DD to fit inside bar chart
      const label = date.length >= 10 ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : date;
      return { date, label, performance, reward, rate, perfNum };
    });
  }, [dailyItems]);

  const hasDailyData = dailySeries.some((d) => d.perfNum > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t(locale, 'team.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(locale, 'team.subtitle')}
        </p>
      </div>

      {/* FE-04: honest account-status gate. suspended / blacklisted
          users see a red banner BEFORE any stats so they are not
          surprised when a reward doesn't arrive. */}
      <RestrictedBanner
        status={session.userStatus ?? 'active'}
        locale={locale}
        scope="team"
      />

      {/* Overview KPIs */}
      <SectionCard
        title={t(locale, 'team.total_performance')}
        hint={t(locale, 'team.pending_confirmation')}
      >
        {overview.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton variant="text" width="5rem" />
                <div className="mt-2">
                  <Skeleton variant="line" width="80%" height="1.5rem" />
                </div>
              </div>
            ))}
          </div>
        ) : overview.isError ? (
          <InlineError
            title={t(locale, 'common.error')}
            description={
              overview.error instanceof Error ? overview.error.message : undefined
            }
            onRetry={() => void overview.refetch()}
            retryLabel={t(locale, 'common.retry')}
            compact
          />
        ) : overview.data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label={t(locale, 'team.total_performance')}
              value={`${formatAmount(asString(overview.data['team_total_performance'], '0'))} USDT`}
            />
            <Stat
              label={t(locale, 'team.today_effective')}
              value={`${formatAmount(asString(overview.data['today_effective_performance'], '0'))} USDT`}
            />
            <Stat
              label={t(locale, 'team.claimable_amount')}
              value={`${formatAmount(asString(overview.data['claimable_amount'], '0'))} USDT`}
              tone="brand"
            />
            <Stat
              label={t(locale, 'team.current_rate')}
              value={formatRate(asString(overview.data['current_team_rate'], '0'))}
            />
          </div>
        ) : null}
      </SectionCard>

      {/* Daily performance chart */}
      <SectionCard
        title={t(locale, 'team.daily.chart_title')}
        hint={t(locale, 'team.daily.chart_hint')}
        action={
          <StatusPill tone="brand">
            <BarChart3 size={11} /> {dailyItems.length}d
          </StatusPill>
        }
      >
        {daily.isLoading ? (
          <Skeleton variant="block" height="140px" />
        ) : daily.isError ? (
          <InlineError
            title={t(locale, 'common.error')}
            description={daily.error instanceof Error ? daily.error.message : undefined}
            onRetry={() => void daily.refetch()}
            retryLabel={t(locale, 'common.retry')}
            compact
          />
        ) : hasDailyData ? (
          <BarMini
            values={dailySeries.map((d) => d.perfNum)}
            labels={dailySeries.map((d) => d.label)}
            height={140}
            tone="brand"
          />
        ) : (
          <EmptyHint
            title={t(locale, 'team.daily.empty')}
            description={t(locale, 'team.daily.empty_sub')}
          />
        )}
      </SectionCard>

      {/* Daily settlement detail rows */}
      <SectionCard
        title={t(locale, 'team.daily.title')}
        hint={t(locale, 'team.daily.hint')}
        padded={false}
      >
        {daily.isLoading ? (
          <div className="p-4">
            <SkeletonGroup rows={4} />
          </div>
        ) : daily.isError ? (
          <div className="p-4">
            <InlineError
              title={t(locale, 'common.error')}
              description={daily.error instanceof Error ? daily.error.message : undefined}
              onRetry={() => void daily.refetch()}
              retryLabel={t(locale, 'common.retry')}
              compact
            />
          </div>
        ) : dailyItems.length === 0 ? (
          <EmptyHint
            title={t(locale, 'team.daily.empty')}
            description={t(locale, 'team.daily.empty_sub')}
          />
        ) : (
          <div className="px-4">
            {dailyItems.map((row, idx) => {
              const date = asString(row['settlement_date'] ?? row['date']).slice(0, 10);
              const performance = asString(
                row['effective_performance'] ?? row['performance'],
                '0',
              );
              const reward = asString(row['reward_amount'] ?? row['amount'], '0');
              const rate = asString(row['team_rate'] ?? row['rate'], '0');
              let hasReward = false;
              try {
                hasReward = new Decimal(reward).gt(0);
              } catch {
                /* ignore */
              }
              return (
                <InfoRow
                  key={idx}
                  label={date}
                  sublabel={`${formatAmount(performance)} USDT · ${formatRate(rate)}`}
                  value={`${formatAmount(reward)} USDT`}
                  accent={
                    hasReward ? <StatusPill tone="success">+{formatAmount(reward)}</StatusPill> : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Direct members */}
      <SectionCard
        title={t(locale, 'team.members.title')}
        hint={t(locale, 'team.members.hint')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/invite')}
          >
            {t(locale, 'team.members.cta_invite')}
          </Button>
        }
        padded={false}
      >
        {members.isLoading ? (
          <div className="p-4">
            <SkeletonGroup rows={4} />
          </div>
        ) : members.isError ? (
          <div className="p-4">
            <InlineError
              title={t(locale, 'common.error')}
              description={members.error instanceof Error ? members.error.message : undefined}
              onRetry={() => void members.refetch()}
              retryLabel={t(locale, 'common.retry')}
              compact
            />
          </div>
        ) : memberItems.length === 0 ? (
          <EmptyHint
            title={t(locale, 'team.members.empty')}
            description={t(locale, 'team.members.empty_sub')}
            icon={<Users size={24} />}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/invite')}
              >
                {t(locale, 'team.members.cta_invite')}
              </Button>
            }
          />
        ) : (
          <div className="px-4">
            {memberItems.map((row, idx) => {
              const wallet = asString(row['wallet_address'] ?? row['wallet'], '');
              const deposit = asString(row['cumulative_deposit'] ?? row['deposit'], '0');
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
    </div>
  );
}
