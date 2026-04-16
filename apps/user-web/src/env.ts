/**
 * Type-safe Vite env accessor.
 *
 * All dev/mock flags are hard-disabled when appEnv === 'production'
 * regardless of what the VITE_* variable says. The gate lives here so
 * no page/component needs to remember to apply it.
 */
export interface UserWebEnv {
  readonly apiBaseUrl: string;
  readonly appEnv: 'local' | 'staging' | 'production';
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  /** `true` when the mock API client should replace the real fetch-based client. */
  readonly useMockApi: boolean;
  /** `true` when the dev persona picker is shown in place of the wallet-signature login. */
  readonly enableDevAuthBypass: boolean;
}

function boolFlag(value: string | undefined): boolean {
  if (value === undefined || value === null) return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function loadEnv(): UserWebEnv {
  const env = import.meta.env;
  const appEnv: UserWebEnv['appEnv'] = (env.VITE_APP_ENV as UserWebEnv['appEnv']) ?? 'local';

  const rawUseMock = boolFlag(env.VITE_USE_MOCK_API as string | undefined);
  const rawDevBypass = boolFlag(env.VITE_ENABLE_DEV_AUTH_BYPASS as string | undefined);

  // Hard-disable dev affordances in production. No env override possible.
  const useMockApi = appEnv === 'production' ? false : rawUseMock;
  const enableDevAuthBypass = appEnv === 'production' ? false : rawDevBypass;

  return {
    apiBaseUrl: env.VITE_API_BASE_URL ?? 'http://localhost:54321/functions/v1/api/v1',
    appEnv,
    defaultLocale: env.VITE_DEFAULT_LOCALE ?? 'zh-CN',
    supportedLocales: (env.VITE_SUPPORTED_LOCALES ?? 'zh-CN,zh-TW,en,ko').split(','),
    useMockApi,
    enableDevAuthBypass,
  };
}
