# Staging Go-Live Runbook

Step-by-step operational runbook for deploying the POSX staging environment.

---

## Prerequisites

- [ ] Supabase staging project created (separate from production)
- [ ] Project ref, URL, anon key, service role key, DB connection string noted
- [ ] Vercel account authenticated (`npx vercel whoami`)
- [ ] Node.js 18+ and pnpm available
- [ ] Repo is CI-green (`pnpm lint && pnpm test`)

---

## Phase 1: Database

### 1.1 Run migrations

```bash
export SUPABASE_DB_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
export APP_ENV=staging
export SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"
export USER_SESSION_SECRET="staging_user_session_secret_32chars"
export ADMIN_SESSION_SECRET="staging_admin_session_secret_32chars"
export CHAIN_ID=97
export RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545"
export CONTRACT_ADDRESS_MAIN="0x0000000000000000000000000000000000000000"
export APP_BASE_URL="https://posx-user-staging.vercel.app"
export ADMIN_BASE_URL="https://posx-admin-staging.vercel.app"

pnpm db:migrate
```

### 1.2 Seed staging data

```bash
pnpm seed:staging
```

### 1.3 Verify seed

```bash
# Quick check (requires psql or any DB client)
# Users: expect 20
# Admin users: expect 4
# Config versions: expect 14
# Settlement jobs: expect 5+
```

---

## Phase 2: Edge Functions

### 2.1 Set secrets on staging project

```bash
npx supabase secrets set --project-ref [PROJECT_REF] \
  APP_ENV=staging \
  APP_NAME="POSX Token Sale (Staging)" \
  APP_BASE_URL="https://posx-user-staging.vercel.app" \
  ADMIN_BASE_URL="https://posx-admin-staging.vercel.app" \
  SUPABASE_URL="https://[PROJECT_REF].supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]" \
  SUPABASE_DB_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
  USER_SESSION_SECRET="staging_user_session_secret_32chars" \
  ADMIN_SESSION_SECRET="staging_admin_session_secret_32chars" \
  CHAIN_ID=97 \
  RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545" \
  CONTRACT_ADDRESS_MAIN="0x0000000000000000000000000000000000000000" \
  LOG_LEVEL=debug \
  ENABLE_SUMMARY_REBUILD_JOB=true \
  ENABLE_EXPORT_JOB=true
```

### 2.2 Deploy edge function

```bash
npx supabase functions deploy api \
  --project-ref [PROJECT_REF] \
  --import-map supabase/functions/import_map.json
```

### 2.3 Verify edge function

```bash
curl -s "https://[PROJECT_REF].supabase.co/functions/v1/api/v1/config/public" | head -c 200
```

Should return a JSON envelope with `"success": true`.

---

## Phase 3: Frontend Deployment

### 3.1 Deploy admin-web

```bash
cd apps/admin-web

# Set staging env vars for Vercel build
npx vercel env add VITE_ADMIN_APP_ENV staging preview
npx vercel env add VITE_ADMIN_API_BASE_URL "https://[PROJECT_REF].supabase.co/functions/v1/api/v1" preview
npx vercel env add VITE_USE_MOCK_API false preview
npx vercel env add VITE_ENABLE_ADMIN_DEV_LOGIN false preview

# Deploy
npx vercel --prod
```

### 3.2 Deploy user-web

```bash
cd apps/user-web

# Set staging env vars for Vercel build
npx vercel env add VITE_APP_ENV staging preview
npx vercel env add VITE_API_BASE_URL "https://[PROJECT_REF].supabase.co/functions/v1/api/v1" preview
npx vercel env add VITE_USE_MOCK_API false preview
npx vercel env add VITE_ENABLE_DEV_AUTH_BYPASS false preview

# Deploy
npx vercel --prod
```

---

## Phase 4: Verification

### 4.1 Environment check

```bash
APP_ENV=staging pnpm verify:env
```

### 4.2 Admin smoke test

1. Navigate to admin staging URL
2. Verify amber "STAGING" badge in topbar
3. Login as `superadmin@staging.local` / `Staging2025!!`
4. Verify dashboard loads with real data (tier distribution, trend chart)
5. Navigate to Users page — expect 20 users
6. Navigate to Settlement — expect 5 jobs
7. Navigate to Admin Accounts — expect 4 accounts
8. Verify viewer role cannot see destructive buttons

### 4.3 User smoke test

1. Navigate to user staging URL
2. Verify amber "STAGING" pill badge in header
3. Verify landing page renders
4. Verify mock API is disabled (no persona picker)

### 4.4 Isolation check

1. Confirm admin staging login does NOT work on production (if production exists)
2. Confirm staging API URL is not the production URL
3. Confirm edge function logs show `[POSX] Environment: staging`

---

## Rollback

If staging deployment fails:

```bash
# Vercel: revert to previous deployment
npx vercel rollback [DEPLOYMENT_URL]

# Database: full reset
APP_ENV=staging pnpm reset:staging
```

---

## Post-deployment

- [ ] Share admin staging URL with QA team
- [ ] Share test account credentials (see `docs/platform/staging-test-accounts.md`)
- [ ] Schedule first QA session
- [ ] Set up monitoring/alerting on staging edge function (Supabase dashboard)
