/**
 * LandingHero — unauthenticated landing section.
 *
 * Shown in place of the bare "Connect Wallet" button screen the audit
 * flagged (IA-04 / UF-09). Structure:
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ [brand logo + chain badge]                                  │
 *   │                                                             │
 *   │ HERO HEADLINE (what is POSX)                                │
 *   │ supporting subhead                                          │
 *   │                                                             │
 *   │ [Connect Wallet CTA]   [Learn more]                         │
 *   │                                                             │
 *   │ [chain · contract · audit · locale badges]                  │
 *   │                                                             │
 *   │ ─────────── How it works ───────────                         │
 *   │ 1. Connect wallet                                            │
 *   │ 2. Buy POSX with USDT                                        │
 *   │ 3. Earn team + direct rewards                                │
 *   │                                                             │
 *   │ ─────────── Why POSX ───────────                             │
 *   │ [three-column feature strip with icons]                      │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Everything in this component is static marketing copy driven by
 * i18n. No business data is fetched here — the hero must render
 * before the user has a session.
 */
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { Button, Card } from '../ui';
import { t, type Locale } from '../../lib/i18n';

import { BrandLogo } from './BrandLogo';

interface LandingHeroProps {
  readonly locale: Locale;
  readonly onConnect: () => void;
  readonly signing?: boolean;
  readonly chainLabel?: string;
  readonly chainId?: number;
  readonly error?: string | null;
  readonly devBypassAvailable?: boolean;
  readonly devBypassSlot?: ReactNode;
}

export const LandingHero: FC<LandingHeroProps> = ({
  locale,
  onConnect,
  signing = false,
  chainLabel = 'BSC Mainnet',
  chainId = 56,
  error,
  devBypassAvailable = false,
  devBypassSlot,
}) => {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-brand-50/40 to-white dark:from-slate-900 dark:via-brand-900/10 dark:to-slate-950 px-6 md:px-12 py-10 md:py-14">
        {/* Decorative backdrop */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-brand-500/5 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <BrandLogo size="md" />
            <span className="text-slate-400 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {chainLabel}
              <span className="opacity-60 ml-1">#{chainId}</span>
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 max-w-2xl">
            {t(locale, 'landing.hero.title', 'Buy POSX, earn team rewards, claim anytime.')}
          </h1>
          <p className="mt-3 text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            {t(
              locale,
              'landing.hero.subtitle',
              'Connect your wallet to purchase POSX with USDT. Rewards accrue on a daily settlement cycle. All claims settle on-chain.',
            )}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              loading={signing}
              onClick={onConnect}
              leftIcon={<Wallet size={16} />}
            >
              {signing ? t(locale, 'auth.signing') : t(locale, 'auth.connect')}
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-500 hover:text-brand-800 dark:hover:text-brand-400"
            >
              {t(locale, 'landing.hero.learn_more', 'Learn how it works')}
              <ArrowRight size={14} />
            </a>
          </div>

          {error && (
            <div className="mt-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </div>
          )}

          {/* Trust row */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={12} />
              {t(locale, 'landing.trust.contract_verified', 'Contract verified on explorer')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 size={12} />
              {t(locale, 'landing.trust.daily_settlement', 'Daily on-chain settlement')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              {t(locale, 'landing.trust.no_custody', 'Self-custody — we never hold your keys')}
            </span>
          </div>
        </div>
      </section>

      {/* Dev persona slot — only shown in local/staging envs */}
      {devBypassAvailable && devBypassSlot && (
        <section className="mt-6">{devBypassSlot}</section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="mt-10 scroll-mt-20">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t(locale, 'landing.how.title', 'How it works')}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t(
              locale,
              'landing.how.subtitle',
              'Three steps from connecting your wallet to claiming rewards.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StepCard
            step="1"
            title={t(locale, 'landing.how.step1.title', 'Connect wallet')}
            body={t(
              locale,
              'landing.how.step1.body',
              'Sign in with TP Wallet or any EIP-1193 wallet. Signature only — no approval required.',
            )}
          />
          <StepCard
            step="2"
            title={t(locale, 'landing.how.step2.title', 'Buy POSX with USDT')}
            body={t(
              locale,
              'landing.how.step2.body',
              'Enter an amount, send USDT, and attach your tx hash. Orders confirm automatically.',
            )}
          />
          <StepCard
            step="3"
            title={t(locale, 'landing.how.step3.title', 'Earn and claim')}
            body={t(
              locale,
              'landing.how.step3.body',
              'Rewards accrue daily from direct, team, and equal-level settlements. Claim any time.',
            )}
          />
        </div>
      </section>

      {/* Why POSX — feature strip */}
      <section className="mt-10">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t(locale, 'landing.why.title', 'Why POSX')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={<ShieldCheck size={20} />}
            title={t(locale, 'landing.why.trust.title', 'Self-custody first')}
            body={t(
              locale,
              'landing.why.trust.body',
              'You keep your keys. POSX never holds user funds — every claim settles via an on-chain signature from your wallet.',
            )}
          />
          <FeatureCard
            icon={<BarChart3 size={20} />}
            title={t(locale, 'landing.why.settlement.title', 'Transparent settlement')}
            body={t(
              locale,
              'landing.why.settlement.body',
              'Rewards are settled on a published daily cycle. Every epoch is auditable from the explorer.',
            )}
          />
          <FeatureCard
            icon={<Sparkles size={20} />}
            title={t(locale, 'landing.why.team.title', 'Team-aware rewards')}
            body={t(
              locale,
              'landing.why.team.body',
              'Direct, team, and equal-level bonuses compound as your network grows. Detailed breakdowns per day.',
            )}
          />
        </div>
      </section>
    </div>
  );
};

const StepCard: FC<{ step: string; title: ReactNode; body: ReactNode }> = ({
  step,
  title,
  body,
}) => (
  <Card>
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-500 inline-flex items-center justify-center font-semibold">
        {step}
      </span>
      <div className="min-w-0">
        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  </Card>
);

const FeatureCard: FC<{
  icon: ReactNode;
  title: ReactNode;
  body: ReactNode;
}> = ({ icon, title, body }) => (
  <Card>
    <div className="text-brand-600 dark:text-brand-500 mb-3">{icon}</div>
    <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
      {title}
    </div>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
      {body}
    </p>
  </Card>
);
