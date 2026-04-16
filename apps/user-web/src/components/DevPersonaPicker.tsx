/**
 * Developer persona picker.
 *
 * Shown in place of the wallet-signature login flow when
 * `env.enableDevAuthBypass` is true (local/staging only). Clicking a
 * persona synthesises a fake session and calls onPick so the parent
 * component can switch into the authenticated layout.
 *
 * The parent renders this inside a production-safe guard — the gate
 * exists at two layers:
 *   1. env.ts forces enableDevAuthBypass to false when appEnv === 'production'
 *   2. Layout.tsx only imports/renders this component when that flag is true
 */
import { buildDevSession, DEV_PERSONAS, type DevPersona } from '../lib/dev-personas';
import { t, type Locale } from '../lib/i18n';
import type { StoredSession } from './../lib/session';

interface Props {
  readonly locale: Locale;
  readonly onPick: (session: StoredSession) => void;
}

export function DevPersonaPicker({ locale, onPick }: Props): JSX.Element {
  const handlePick = (persona: DevPersona) => {
    const session = buildDevSession(persona);
    onPick(session);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-4 py-2 text-sm mb-4">
        {t(locale, 'dev.banner')}
      </div>
      <h2 className="text-lg font-semibold mb-3">{t(locale, 'dev.pick_persona')}</h2>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEV_PERSONAS.map((persona) => (
          <li key={persona.key}>
            <button
              type="button"
              onClick={() => handlePick(persona)}
              className="w-full text-left rounded border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {t(locale, `dev.persona.${persona.key}`, persona.label)}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {persona.userStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{persona.description}</p>
              <div className="mt-2 text-[11px] text-slate-400 font-mono break-all">
                {persona.walletAddress}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
