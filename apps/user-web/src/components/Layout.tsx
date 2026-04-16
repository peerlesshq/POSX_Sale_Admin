/**
 * Layout — user-web shell (Phase 2 audit remediation).
 *
 * Changes vs the Phase 0 state:
 *   - Real brand logo via <BrandLogo> instead of the bare "POSX" text.
 *   - Unauthenticated state renders <LandingHero> (hero + trust + how
 *     it works + why POSX) replacing the single "Connect Wallet" button.
 *   - Persistent <TrustFooter> on every authenticated page with
 *     chain / contract / T&C / privacy / audit placeholders.
 *   - Bottom mobile nav uses icons + safe-area insets so the last 20px
 *     don't sit under the iOS home indicator.
 *   - Top dev-banner is a higher-contrast warning strip.
 *   - Header contains the ThemeToggle explicitly (was already present
 *     but tightened so it renders on all screen sizes).
 */
import {
  Home,
  LayoutGrid,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { loadEnv } from '../env';
import { getStoredLocale, saveLocale, t, type Locale } from '../lib/i18n';
import { maskWallet } from '../lib/format';
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredSession,
} from '../lib/session';
import { NoWalletError, requestWalletAddress, signMessage } from '../lib/wallet';
import { api } from '../api/endpoints';
import { DevPersonaPicker } from './DevPersonaPicker';
import { ThemeToggle } from './ThemeToggle';
import { BrandLogo } from './brand/BrandLogo';
import { LandingHero } from './brand/LandingHero';
import { TrustFooter } from './brand/TrustFooter';

interface NavEntry {
  readonly to: string;
  readonly key: string;
  readonly icon: React.ComponentType<any>;
}

const NAV: readonly NavEntry[] = [
  { to: '/dashboard', key: 'nav.dashboard', icon: Home },
  { to: '/buy', key: 'nav.buy', icon: ShoppingBag },
  { to: '/rewards', key: 'nav.rewards', icon: TrendingUp },
  { to: '/my-team', key: 'nav.team', icon: Users },
  { to: '/invite', key: 'nav.invite', icon: LayoutGrid },
];

export function Layout() {
  const env = loadEnv();
  const navigate = useNavigate();
  const location = useLocation();

  const [locale, setLocale] = useState<Locale>(() =>
    getStoredLocale(env.defaultLocale),
  );
  const [session, setSession] = useState<StoredSession | null>(() => loadSession());
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveLocale(locale);
  }, [locale]);

  const handleConnect = useCallback(async () => {
    setError(null);
    setSigning(true);
    try {
      const address = await requestWalletAddress();
      const nonce = await api.authNonce(address);
      const signature = await signMessage(nonce.message_to_sign, address);
      const verified = await api.authVerify(address, nonce.nonce, signature);
      const stored: StoredSession = {
        token: verified.session_token,
        wallet: verified.wallet_address,
        expiresAt: verified.expires_at,
        userStatus: verified.user_status,
      };
      saveSession(stored);
      setSession(stored);
    } catch (err) {
      if (err instanceof NoWalletError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    } finally {
      setSigning(false);
    }
  }, []);

  const handlePersonaPick = useCallback((picked: StoredSession) => {
    saveSession(picked);
    setSession(picked);
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await api.authLogout();
    } catch {
      /* ignore — session may already be expired server-side */
    }
    clearSession();
    setSession(null);
    navigate('/');
  }, [navigate]);

  const showDevBanner = env.enableDevAuthBypass || env.useMockApi;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        session={session}
        locale={locale}
        onLocaleChange={setLocale}
        onDisconnect={handleDisconnect}
        onConnect={handleConnect}
        signing={signing}
        env={env}
        showDevBanner={showDevBanner}
        location={location}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-28 md:pb-10">
        {session ? (
          <Outlet context={{ locale, session } satisfies LayoutContext} />
        ) : (
          <LandingHero
            locale={locale}
            onConnect={handleConnect}
            signing={signing}
            error={error}
            devBypassAvailable={env.enableDevAuthBypass}
            devBypassSlot={
              env.enableDevAuthBypass ? (
                <DevPersonaPicker locale={locale} onPick={handlePersonaPick} />
              ) : null
            }
          />
        )}
      </main>

      <TrustFooter locale={locale} version={env.appEnv === 'local' ? 'local' : undefined} />

      {session && <MobileBottomNav locale={locale} location={location} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                              */
/* ------------------------------------------------------------------ */

interface HeaderProps {
  readonly session: StoredSession | null;
  readonly locale: Locale;
  readonly onLocaleChange: (next: Locale) => void;
  readonly onDisconnect: () => void;
  readonly onConnect: () => void;
  readonly signing: boolean;
  readonly env: ReturnType<typeof loadEnv>;
  readonly showDevBanner: boolean;
  readonly location: ReturnType<typeof useLocation>;
}

function Header({
  session,
  locale,
  onLocaleChange,
  onDisconnect,
  onConnect,
  signing,
  env,
  showDevBanner,
  location,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
      {showDevBanner && (
        <div className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-[11px] text-center py-1 px-2 font-medium">
          {t(locale, 'dev.banner')}
          {env.useMockApi && (
            <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-[10px]">
              {t(locale, 'dev.mock_api_badge')}
            </span>
          )}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to={session ? '/dashboard' : '/'}>
            <BrandLogo size="md" />
          </Link>
          {env.appEnv !== 'production' && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                env.appEnv === 'staging'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}
            >
              {env.appEnv.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle locale={locale} />
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value as Locale)}
            className="h-9 border border-slate-300 dark:border-slate-700 rounded-md px-2 text-xs bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 font-medium"
            aria-label="locale"
          >
            {env.supportedLocales.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          {session ? (
            <button
              onClick={onDisconnect}
              className="h-9 inline-flex items-center gap-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-md px-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={t(locale, 'auth.disconnect')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {maskWallet(session.wallet)}
            </button>
          ) : (
            !env.enableDevAuthBypass && (
              <button
                onClick={onConnect}
                disabled={signing}
                className="h-9 text-xs font-medium bg-brand-600 text-white rounded-md px-3 hover:bg-brand-700 disabled:opacity-50"
              >
                {signing ? t(locale, 'auth.signing') : t(locale, 'auth.connect')}
              </button>
            )
          )}
        </div>
      </div>

      {session && (
        <nav className="hidden md:block border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="max-w-6xl mx-auto px-4 flex gap-1 text-sm">
            {NAV.map((item) => {
              const active = location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 h-10 border-b-2 transition-colors',
                    active
                      ? 'text-brand-700 dark:text-brand-500 border-brand-600 font-medium'
                      : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100',
                  ].join(' ')}
                >
                  <Icon size={14} />
                  {t(locale, item.key)}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile bottom nav with icons + safe-area inset                     */
/* ------------------------------------------------------------------ */

function MobileBottomNav({
  locale,
  location,
}: {
  locale: Locale;
  location: ReturnType<typeof useLocation>;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="bottom navigation"
    >
      <div className="flex justify-around">
        {NAV.map((item) => {
          const active = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px]',
                active
                  ? 'text-brand-600 dark:text-brand-500'
                  : 'text-slate-500 dark:text-slate-400',
              ].join(' ')}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium">
                {t(locale, item.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export interface LayoutContext {
  readonly locale: Locale;
  readonly session: NonNullable<ReturnType<typeof loadSession>>;
}

// Exported so pages can import the helper icons if they want to mirror
// the nav look. Not used internally beyond the NAV const above.
export const NAV_ICONS: Record<string, ReactNode> = {
  dashboard: <Home size={14} />,
  buy: <ShoppingBag size={14} />,
  rewards: <TrendingUp size={14} />,
  team: <Users size={14} />,
  invite: <LayoutGrid size={14} />,
};
