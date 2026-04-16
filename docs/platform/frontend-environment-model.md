# Frontend Environment Model

Covers both **admin-web** and **user-web** across all three environments.

---

## Env Vars by App

### admin-web

| Var | local | staging | production |
|---|---|---|---|
| `VITE_ADMIN_APP_ENV` | `local` | `staging` | `production` |
| `VITE_API_BASE_URL` | `http://127.0.0.1:54321/functions/v1` | `https://<staging-ref>.supabase.co/functions/v1` | `https://<prod-ref>.supabase.co/functions/v1` |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<staging-ref>.supabase.co` | `https://<prod-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<local-anon-key>` | `<staging-anon-key>` | `<prod-anon-key>` |

### user-web

| Var | local | staging | production |
|---|---|---|---|
| `VITE_APP_ENV` | `local` | `staging` | `production` |
| `VITE_API_BASE_URL` | `http://127.0.0.1:54321/functions/v1` | `https://<staging-ref>.supabase.co/functions/v1` | `https://<prod-ref>.supabase.co/functions/v1` |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` | `https://<staging-ref>.supabase.co` | `https://<prod-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<local-anon-key>` | `<staging-anon-key>` | `<prod-anon-key>` |

---

## .env.staging Templates

### apps/admin-web/.env.staging

```env
VITE_ADMIN_APP_ENV=staging
VITE_API_BASE_URL=https://<staging-ref>.supabase.co/functions/v1
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
```

### apps/user-web/.env.staging

```env
VITE_APP_ENV=staging
VITE_API_BASE_URL=https://<staging-ref>.supabase.co/functions/v1
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-anon-key>
```

---

## API Base URL Resolution

Both apps connect to edge functions via the API base URL, **not** through the Supabase client directly.

```
Request flow:
  Frontend -> VITE_API_BASE_URL/<function-name> -> Supabase Edge Function -> DB
```

Resolution logic (at build time via Vite):
1. Vite reads `VITE_API_BASE_URL` from the active `.env.*` file.
2. The value is embedded into the build at compile time.
3. All API calls use this base URL as the prefix.
4. No runtime env var lookup -- the value is baked into the JS bundle.

Consequence: A staging build always talks to staging edge functions. A production build always talks to production. There is no runtime switch.

---

## Environment Indicator Display

### admin-web (existing)

- **Location**: topbar and sidebar.
- **Format**: colored badge showing the environment name.
- **Colors**:
  - `local` = green badge
  - `staging` = amber/yellow badge
  - `production` = red badge
- **Source**: reads `VITE_ADMIN_APP_ENV` at build time.
- **Visibility**: always visible to admin users.

### user-web (needs work)

- **Current state**: has a dev-mode banner but no environment name indicator for staging.
- **Required change**: add an env badge for staging similar to admin-web.
- **Behavior**:
  - `local` = show dev-mode banner (existing behavior)
  - `staging` = show amber "STAGING" badge (new)
  - `production` = show nothing (no badge, no banner)
- **Source**: reads `VITE_APP_ENV` at build time.

---

## What Changes Between Environments

| Aspect | local | staging | production |
|---|---|---|---|
| API endpoint | localhost Supabase | staging Supabase | production Supabase |
| Auth provider | local Supabase auth | staging Supabase auth | production Supabase auth |
| Env badge | green "local" | amber "staging" | red "production" (admin) / none (user) |
| Dev bypass | enabled | disabled | disabled |
| Dev-mode banner (user-web) | shown | hidden (replaced by staging badge) | hidden |
| Build target | dev server (Vite HMR) | `vite build --mode staging` | `vite build --mode production` |
| Source maps | included | included | excluded |

---

## Runtime Assertions

The following must be enforced at app startup (or build time where possible):

### Production guards

```typescript
// In app initialization
if (env === 'production') {
  // Dev bypass must be off
  assert(!DEV_BYPASS_ENABLED, 'Dev bypass must be disabled in production');

  // Mock services must not be active
  assert(!MOCK_SERVICES, 'Mock services must be disabled in production');
}
```

### Staging guards

```typescript
if (env === 'staging') {
  // Dev bypass must be off in staging too
  assert(!DEV_BYPASS_ENABLED, 'Dev bypass must be disabled in staging');
}
```

### All environments

```typescript
// API base URL must be set
assert(VITE_API_BASE_URL, 'VITE_API_BASE_URL is required');

// Env must be a known value
assert(['local', 'staging', 'production'].includes(env), `Unknown env: ${env}`);
```

---

## Deployment Domains

| App | local | staging | production |
|---|---|---|---|
| admin-web | `localhost:5181` | `admin-staging.example.com` | `admin.example.com` |
| user-web | `localhost:5180` | `app-staging.example.com` | `app.example.com` |

Staging domains can alternatively be Vercel preview URLs (e.g., `admin-staging-xxx.vercel.app`).

---

## Build Commands

```bash
# Local dev
pnpm --filter admin-web dev     # starts on :5181
pnpm --filter user-web dev      # starts on :5180

# Staging build
pnpm --filter admin-web build -- --mode staging
pnpm --filter user-web build -- --mode staging

# Production build
pnpm --filter admin-web build -- --mode production
pnpm --filter user-web build -- --mode production
```

Vite mode selects the corresponding `.env.<mode>` file automatically.
