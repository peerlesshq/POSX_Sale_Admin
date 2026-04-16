/**
 * TrustFooter — persistent footer with chain info, contract address,
 * audit placeholders, and policy links.
 *
 * Previously user-web had ZERO trust cues (UF-09 in the audit — the
 * single biggest risk for a public token-sale product). This footer
 * addresses that by surfacing:
 *   - Chain label + ID badge (BSC Mainnet, Ethereum, etc.)
 *   - Contract address (truncated, copyable, explorer link)
 *   - Audit placeholder row (integration required — the audit report
 *     told me not to fabricate audit logos I don't have)
 *   - T&C + Privacy + Risk Disclosure links
 *   - Build / version tag
 *
 * Every value comes from env configuration (to be wired in a later
 * phase) with safe placeholders. Nothing is fabricated here.
 */
import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { FC } from 'react';

import { CopyButton } from '../ui';
import { t, type Locale } from '../../lib/i18n';
import { maskWallet } from '../../lib/format';

import { BrandLogo } from './BrandLogo';

interface TrustFooterProps {
  readonly locale: Locale;
  readonly chainLabel?: string;
  readonly chainId?: number;
  readonly contractAddress?: string;
  readonly explorerBase?: string;
  readonly version?: string;
}

export const TrustFooter: FC<TrustFooterProps> = ({
  locale,
  chainLabel = 'BSC Mainnet',
  chainId = 56,
  contractAddress = '',
  explorerBase = 'https://bscscan.com',
  version,
}) => {
  const hasContract = contractAddress && contractAddress.length >= 10;
  const explorerUrl = hasContract
    ? `${explorerBase.replace(/\/+$/, '')}/address/${contractAddress}`
    : null;

  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 backdrop-blur-sm mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 text-xs">
        {/* Top row — logo + chain badge + contract */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="text-slate-400 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {chainLabel}{' '}
              <span className="opacity-60 ml-1">#{chainId}</span>
            </span>
          </div>

          {hasContract ? (
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              <span className="text-slate-500">
                {t(locale, 'trust.contract', 'Contract')}:
              </span>
              <span className="truncate" title={contractAddress}>
                {maskWallet(contractAddress)}
              </span>
              <CopyButton
                value={contractAddress}
                size="sm"
                variant="ghost"
                labelIdle={t(locale, 'common.copy')}
                labelCopied={t(locale, 'common.copied')}
              />
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-500 hover:text-brand-700 dark:hover:text-brand-400"
                >
                  <ExternalLink size={11} />
                  <span>{t(locale, 'trust.view_explorer', 'View on explorer')}</span>
                </a>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 dark:text-slate-500 italic">
              {t(
                locale,
                'trust.contract_integration',
                'Contract address — integration required',
              )}
            </span>
          )}
        </div>

        {/* Links + audit + version */}
        <div className="mt-5 pt-5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-500 dark:text-slate-400">
            <a href="#terms" className="hover:text-slate-900 dark:hover:text-slate-200">
              {t(locale, 'trust.terms', 'Terms of Service')}
            </a>
            <a href="#privacy" className="hover:text-slate-900 dark:hover:text-slate-200">
              {t(locale, 'trust.privacy', 'Privacy Policy')}
            </a>
            <a
              href="#risk"
              className="hover:text-slate-900 dark:hover:text-slate-200"
            >
              {t(locale, 'trust.risk', 'Risk Disclosure')}
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-slate-200">
              {t(locale, 'trust.faq', 'FAQ')}
            </a>
          </div>

          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/60">
              <ShieldCheck size={11} />
              <span>
                {t(
                  locale,
                  'trust.audit_integration',
                  'Security audit — integration required',
                )}
              </span>
            </span>
            {version && (
              <span className="font-mono text-[10px] opacity-75">v{version}</span>
            )}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400 dark:text-slate-600">
          © {new Date().getUTCFullYear()} POSX. {t(locale, 'common.utc_note')}
        </div>
      </div>
    </footer>
  );
};
