/**
 * Type-safe Vite env accessor for admin-web.
 *
 * Dev-only flags are hard-disabled when appEnv === 'production'
 * regardless of what the VITE_* variable says. The gate lives here
 * so no page/component needs to remember to apply it.
 */
export interface AdminDevCredential {
  readonly labelKey: string;
  readonly email: string;
  readonly password: string;
  readonly role: 'super_admin' | 'operator' | 'viewer';
}

export interface AdminWebEnv {
  readonly apiBaseUrl: string;
  readonly appEnv: 'local' | 'staging' | 'production';
  /** `true` when the mock API client should replace the real fetch-based client. */
  readonly useMockApi: boolean;
  /** `true` when the login page should render dev-login shortcut buttons. */
  readonly enableAdminDevLogin: boolean;
  /**
   * Seeded dev credentials for the LoginPage dev shortcut buttons.
   * ALWAYS empty when appEnv === 'production'. Sourced from
   * VITE_ADMIN_DEV_CREDENTIALS (JSON) for local/staging, with a local
   * fallback so developers don't need to set anything to get started.
   */
  readonly devCredentials: readonly AdminDevCredential[];
}

function boolFlag(value: string | undefined): boolean {
  if (value === undefined || value === null) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Parse `VITE_ADMIN_DEV_CREDENTIALS` JSON safely. Returns an empty
 * array on any shape error so a malformed env var cannot explode
 * the login page.
 */
function parseDevCredentials(raw: string | undefined): readonly AdminDevCredential[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: AdminDevCredential[] = [];
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const role = rec['role'];
        if (
          typeof rec['labelKey'] === 'string' &&
          typeof rec['email'] === 'string' &&
          typeof rec['password'] === 'string' &&
          (role === 'super_admin' || role === 'operator' || role === 'viewer')
        ) {
          out.push({
            labelKey: rec['labelKey'],
            email: rec['email'],
            password: rec['password'],
            role,
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Local-only fallback for first-run developer convenience. Matches
 * what supabase/seed/ creates via `pnpm seed`. NOT used unless
 * appEnv === 'local' AND `VITE_ADMIN_DEV_CREDENTIALS` is unset AND
 * `VITE_ENABLE_ADMIN_DEV_LOGIN_LOCAL_FALLBACK=true`.
 *
 * This fallback exists so a fresh `git clone` still gives you the
 * dev-login shortcut without a manual env step. It is aggressively
 * gated: never runs in staging or production, never runs when an
 * operator has provided their own `VITE_ADMIN_DEV_CREDENTIALS` JSON.
 */
const LOCAL_FALLBACK_CREDENTIALS: readonly AdminDevCredential[] = [
  {
    labelKey: 'auth.dev_login_as_super',
    email: 'superadmin@posx.local',
    password: 'posx-local-super-admin-12',
    role: 'super_admin',
  },
  {
    labelKey: 'auth.dev_login_as_operator',
    email: 'operator@posx.local',
    password: 'posx-local-operator-12',
    role: 'operator',
  },
  {
    labelKey: 'auth.dev_login_as_viewer',
    email: 'viewer@posx.local',
    password: 'posx-local-viewer-12',
    role: 'viewer',
  },
];

export function loadEnv(): AdminWebEnv {
  const env = import.meta.env;
  const appEnv: AdminWebEnv['appEnv'] =
    (env.VITE_ADMIN_APP_ENV as AdminWebEnv['appEnv']) ?? 'local';

  const rawUseMock = boolFlag(env.VITE_USE_MOCK_API as string | undefined);
  const rawDevLogin = boolFlag(env.VITE_ENABLE_ADMIN_DEV_LOGIN as string | undefined);
  const rawLocalFallback = boolFlag(
    env.VITE_ENABLE_ADMIN_DEV_LOGIN_LOCAL_FALLBACK as string | undefined,
  );

  const useMockApi = appEnv === 'production' ? false : rawUseMock;
  const enableAdminDevLogin = appEnv === 'production' ? false : rawDevLogin;

  const credsFromEnv = parseDevCredentials(
    env.VITE_ADMIN_DEV_CREDENTIALS as string | undefined,
  );

  // Prefer operator-provided env JSON. Fall back to the hardcoded
  // local seed credentials only when `local` + fallback flag is set.
  // NEVER fall back in staging or production.
  let devCredentials: readonly AdminDevCredential[] = [];
  if (enableAdminDevLogin) {
    if (credsFromEnv.length > 0) {
      devCredentials = credsFromEnv;
    } else if (appEnv === 'local' && rawLocalFallback) {
      devCredentials = LOCAL_FALLBACK_CREDENTIALS;
    }
  }

  return {
    apiBaseUrl: env.VITE_ADMIN_API_BASE_URL ?? 'http://localhost:54321/functions/v1/api/v1',
    appEnv,
    useMockApi,
    enableAdminDevLogin,
    devCredentials,
  };
}
