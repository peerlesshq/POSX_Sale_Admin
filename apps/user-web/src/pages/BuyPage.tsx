/**
 * Buy page — Phase 0 remediation.
 *
 * Changes from the wireframe:
 *   - Uses shared `Card / SectionCard / Button / Stat / ProgressBar /
 *     InfoRow / RestrictedBanner` primitives.
 *   - Vesting section is a real summary grid + release progress bar,
 *     NOT a `<pre>{JSON.stringify(vesting['summary'])}</pre>` dump.
 *   - Step state is communicated via a proper stepper header with
 *     step labels, and the tx-hash attach field lives below the
 *     stepper instead of being a dangling `<input>`.
 *   - Restricted-purchase gate: banner + disabled CTA + tooltip.
 *   - Every string localized via i18n.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { api } from '../api/endpoints';
import type { LayoutContext } from '../components/Layout';
import {
  Button,
  CopyButton,
  EmptyHint,
  ProgressBar,
  RestrictedBanner,
  SectionCard,
  Skeleton,
  Stat,
} from '../components/ui';
import { formatAmount, maskWallet } from '../lib/format';
import { t } from '../lib/i18n';

// Trust-layer placeholders — replaced at integration time.
const CHAIN_LABEL = 'BSC Mainnet';
const CHAIN_ID = 56;
const CONTRACT_ADDRESS = ''; // empty → integration-required UI
const EXPLORER_BASE = 'https://bscscan.com';

type Step = 'idle' | 'creating' | 'awaiting_tx' | 'confirmed' | 'failed';

type AnyRow = Record<string, unknown>;

const BLOCKED_STATUSES = new Set([
  'restricted_purchase',
  'suspended',
  'blacklisted',
]);

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

export function BuyPage() {
  const { locale, session } = useOutletContext<LayoutContext>();
  const blocked = BLOCKED_STATUSES.has(session.userStatus);

  const { data: publicConfig } = useQuery({
    queryKey: ['public-config'],
    queryFn: api.publicConfig,
  });
  const { data: vesting } = useQuery({
    queryKey: ['vesting'],
    queryFn: () => api.vesting(1, 20),
  });

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const createOrder = useMutation({
    mutationFn: (usdt: string) =>
      api.createPurchaseOrder({
        client_order_id: `client_${Date.now()}`,
        usdt_amount: usdt,
      }),
    onSuccess: (data) => {
      setOrderId(String((data as AnyRow)['purchase_order_id']));
      setStep('awaiting_tx');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setStep('failed');
    },
  });

  const attachTx = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('Order not created');
      if (!txHash) throw new Error('Enter tx hash');
      return api.attachPurchaseTx(orderId, { purchase_tx_hash: txHash });
    },
    onSuccess: () => {
      setStep('confirmed');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to attach tx');
      setStep('failed');
    },
  });

  // FE-03: recoverPurchase mutation. Called when the user had a
  // partially-completed purchase (order created, tx sent on-chain,
  // but the attach call failed). The user can paste their tx hash
  // and recover without starting over.
  const recoverPurchase = useMutation({
    mutationFn: async () => {
      if (!txHash) throw new Error('Enter your transaction hash');
      return api.recoverPurchase(txHash);
    },
    onSuccess: () => {
      setError(null);
      setStep('confirmed');
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : 'Recovery failed — please contact support',
      );
    },
  });

  const handleCreate = () => {
    setError(null);
    setStep('creating');
    createOrder.mutate(amount);
  };

  const handleRetry = () => {
    setError(null);
    setStep('idle');
  };

  const handleRecover = () => {
    setError(null);
    recoverPurchase.mutate();
  };

  const tokenPrice = asString(publicConfig?.token_price, '0');
  const minPurchase = asString(publicConfig?.min_purchase_amount, '0');
  const expectedPosx = useMemo(() => {
    try {
      const a = new Decimal(amount || '0');
      const p = new Decimal(tokenPrice || '0');
      if (p.lte(0)) return '0';
      return a.dividedBy(p).toFixed(4, Decimal.ROUND_DOWN);
    } catch {
      return '0';
    }
  }, [amount, tokenPrice]);

  const vestingSummary = (vesting?.['summary'] as AnyRow) ?? {};
  const locked = readDecimal(vestingSummary['total_locked']);
  const released = readDecimal(vestingSummary['total_released']);
  const withdrawable = readDecimal(vestingSummary['total_withdrawable']);
  const withdrawn = readDecimal(vestingSummary['total_withdrawn']);
  const vestingTotal = locked.plus(released).plus(withdrawn);
  const releasedPct = vestingTotal.gt(0)
    ? released.plus(withdrawn).dividedBy(vestingTotal).times(100).toNumber()
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t(locale, 'buy.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t(locale, 'buy.subtitle')}
        </p>
      </div>

      <RestrictedBanner status={session.userStatus} locale={locale} scope="purchase" />

      {/* Trust strip — chain + recipient + explorer */}
      <TrustStrip locale={locale} />

      {/* Purchase card */}
      <SectionCard>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat
            label={t(locale, 'buy.token_price')}
            value={`${formatAmount(tokenPrice, 4)} USDT`}
          />
          <Stat
            label={t(locale, 'buy.min_purchase')}
            value={`${formatAmount(minPurchase)} USDT`}
          />
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t(locale, 'buy.amount_label')}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            disabled={blocked}
            className={[
              'mt-1.5 w-full h-11 rounded-md border px-3 py-2 text-base tabular-nums',
              'border-slate-300 dark:border-slate-700',
              'bg-white dark:bg-slate-900',
              'text-slate-900 dark:text-slate-100',
              'placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500',
              'disabled:opacity-50',
            ].join(' ')}
          />
        </label>

        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
          {t(locale, 'buy.expected_posx')}:{' '}
          <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
            {expectedPosx} POSX
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-slate-500 self-center">
            {t(locale, 'buy.quick_amount')}:
          </span>
          {publicConfig?.quick_amount_options?.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(q)}
              disabled={blocked}
              className={[
                'h-9 rounded-md border border-slate-300 dark:border-slate-700',
                'px-3 text-xs font-medium tabular-nums',
                'text-slate-700 dark:text-slate-300',
                'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {formatAmount(q, 0)}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
          disabled={blocked || !amount || createOrder.isPending}
          loading={createOrder.isPending}
          onClick={handleCreate}
        >
          {t(locale, 'buy.confirm')}
        </Button>

        {/* Stepper — shows only when a flow is in progress or done */}
        {step !== 'idle' && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Stepper current={step} locale={locale} />
          </div>
        )}

        {step === 'awaiting_tx' && orderId && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(locale, 'buy.step.order_created').replace(
                '{id}',
                orderId.slice(0, 8) + '…',
              )}
              {' · '}
              {t(locale, 'buy.step.order_hint')}
            </p>
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder={t(locale, 'buy.step.tx_hash_placeholder')}
              className={[
                'w-full h-10 rounded-md border px-3 text-xs font-mono',
                'border-slate-300 dark:border-slate-700',
                'bg-white dark:bg-slate-900',
                'text-slate-900 dark:text-slate-100',
                'placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500',
              ].join(' ')}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!txHash || attachTx.isPending}
              loading={attachTx.isPending}
              onClick={() => attachTx.mutate()}
              rightIcon={<ArrowRight size={14} />}
            >
              {t(locale, 'buy.step.attach_tx')}
            </Button>
          </div>
        )}
        {step === 'confirmed' && (
          <div className="mt-4 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2 flex items-start gap-2">
            <CheckCircle2
              size={16}
              className="mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0"
            />
            <div className="text-sm">
              <div className="font-medium text-emerald-800 dark:text-emerald-300">
                {t(locale, 'buy.step.confirmed')}
              </div>
              <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                {t(locale, 'buy.step.confirmed_hint')}
              </div>
            </div>
          </div>
        )}
        {/* FE-03: explicit failed-step block with Retry + Recover */}
        {step === 'failed' && (
          <div className="mt-4 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={16}
                className="mt-0.5 text-rose-600 dark:text-rose-400 flex-shrink-0"
              />
              <div className="text-sm min-w-0">
                <div className="font-medium text-rose-800 dark:text-rose-300">
                  {t(locale, 'buy.step.failed', 'Purchase failed')}
                </div>
                {error && (
                  <div className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">
                    {error}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRetry}
              >
                <RefreshCw size={12} />
                {t(locale, 'buy.retry', 'Start over')}
              </Button>
              {txHash && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRecover}
                  disabled={recoverPurchase.isPending}
                >
                  {recoverPurchase.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={12} />
                  )}
                  {t(locale, 'buy.recover', 'Recover with tx hash')}
                </Button>
              )}
            </div>
          </div>
        )}
        {error && step !== 'failed' && (
          <div className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</div>
        )}
      </SectionCard>

      {/* Vesting summary — real grid + progress bar, no JSON dump */}
      <SectionCard
        title={t(locale, 'buy.vesting.title')}
        hint={t(locale, 'buy.vesting.hint')}
      >
        {vesting ? (
          vestingTotal.gt(0) ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Stat
                  label={t(locale, 'buy.vesting.locked')}
                  value={formatAmount(locked.toString(), 4)}
                />
                <Stat
                  label={t(locale, 'buy.vesting.released')}
                  value={formatAmount(released.toString(), 4)}
                  tone="success"
                />
                <Stat
                  label={t(locale, 'buy.vesting.withdrawable')}
                  value={formatAmount(withdrawable.toString(), 4)}
                  tone="brand"
                />
                <Stat
                  label={t(locale, 'buy.vesting.withdrawn')}
                  value={formatAmount(withdrawn.toString(), 4)}
                />
              </div>
              <ProgressBar
                value={releasedPct}
                max={100}
                label={t(locale, 'buy.vesting.progress')}
                trailing={`${releasedPct.toFixed(1)}%`}
                tone="brand"
              />
            </>
          ) : (
            <EmptyHint
              title={t(locale, 'dashboard.empty.purchases')}
              description={t(locale, 'dashboard.empty.purchases_sub')}
            />
          )
        ) : (
          <div className="space-y-3">
            <Skeleton variant="block" height="4rem" />
            <Skeleton variant="line" width="70%" />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trust strip — chain badge, recipient, explorer link                 */
/* ------------------------------------------------------------------ */

function TrustStrip({ locale }: { locale: string }) {
  const hasContract = CONTRACT_ADDRESS.length >= 10;
  const explorerUrl = hasContract
    ? `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`
    : null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {t(locale as never, 'buy.trust.chain')}: {CHAIN_LABEL}{' '}
          <span className="opacity-60 ml-0.5">#{CHAIN_ID}</span>
        </span>
        {hasContract ? (
          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono">
            <span className="text-slate-500">
              {t(locale as never, 'buy.trust.recipient')}:
            </span>
            <span title={CONTRACT_ADDRESS}>{maskWallet(CONTRACT_ADDRESS)}</span>
            <CopyButton value={CONTRACT_ADDRESS} size="sm" variant="ghost" />
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-500 hover:text-brand-700"
              >
                <ExternalLink size={11} />
                {t(locale as never, 'buy.trust.explorer')}
              </a>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-500 italic">
            <ShieldCheck size={11} />
            {t(locale as never, 'trust.contract_integration')}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {t(locale as never, 'buy.trust.note')}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Stepper — purchase state machine visualisation                      */
/* ------------------------------------------------------------------ */

const STEPS: readonly {
  key: 'creating' | 'awaiting_tx' | 'confirmed';
  labelKey: string;
}[] = [
  { key: 'creating', labelKey: 'buy.confirm' },
  { key: 'awaiting_tx', labelKey: 'buy.step.attach_tx' },
  { key: 'confirmed', labelKey: 'buy.step.confirmed' },
];

function Stepper({
  current,
  locale,
}: {
  current: 'creating' | 'awaiting_tx' | 'confirmed' | 'failed';
  locale: string;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, idx) => {
        const done = idx < currentIdx || current === 'confirmed';
        const active = idx === currentIdx && current !== 'confirmed';
        const failed = current === 'failed' && idx === currentIdx;

        return (
          <div key={s.key} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={[
                'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                failed
                  ? 'bg-rose-500 text-white'
                  : done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500',
              ].join(' ')}
            >
              {done ? (
                <CheckCircle2 size={14} />
              ) : active ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Circle size={12} />
              )}
            </div>
            <div
              className={[
                'text-xs font-medium truncate',
                done || active
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-500',
              ].join(' ')}
            >
              {t(locale as never, s.labelKey)}
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={[
                  'hidden md:block h-px flex-1',
                  done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
