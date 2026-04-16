# Staging Deploy Checklist

Step-by-step checklist for initial staging environment setup. Complete in order.

---

## Phase 1: Supabase Project Setup

- [ ] **1. Create staging Supabase project**
  - Go to https://supabase.com/dashboard
  - Create new project with name: `posx-staging`
  - Select region (same as production for consistency)
  - Set a strong database password
  - Wait for project to provision

- [ ] **2. Record staging credentials**
  - Project URL: `https://<staging-ref>.supabase.co`
  - Anon key: from Settings > API
  - Service role key: from Settings > API
  - DB URL: `postgresql://postgres:<password>@db.<staging-ref>.supabase.co:5432/postgres`
  - Store these in a secure location (1Password / team vault), never in git

- [ ] **3. Set edge function secrets**
  ```bash
  supabase secrets set --project-ref <staging-ref> \
    APP_ENV=staging \
    APP_BASE_URL=https://app-staging.example.com \
    ADMIN_BASE_URL=https://admin-staging.example.com \
    SUPABASE_URL=https://<staging-ref>.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key> \
    SUPABASE_DB_URL=<staging-db-url> \
    USER_SESSION_SECRET=<staging-user-secret> \
    ADMIN_SESSION_SECRET=<staging-admin-secret> \
    CHAIN_ID=97 \
    RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/ \
    CONTRACT_ADDRESS_MAIN=<staging-contract-address>
  ```

---

## Phase 2: Database Setup

- [ ] **4. Run migrations against staging DB**
  ```bash
  supabase db push --db-url <staging-db-url>
  # or
  supabase migration up --db-url <staging-db-url>
  ```
  Verify: all tables created, no migration errors.

- [ ] **5. Run staging seed**
  ```bash
  APP_ENV=staging SUPABASE_DB_URL=<staging-db-url> pnpm seed:staging
  ```
  Verify:
  - 4 admin accounts exist (super_admin, operator, viewer, disabled)
  - 20+ user accounts exist with expected states
  - Settlement job records, chain sync states, report data present

---

## Phase 3: Edge Functions

- [ ] **6. Deploy edge functions to staging**
  ```bash
  supabase functions deploy --project-ref <staging-ref>
  ```
  Verify: all functions listed in Supabase dashboard under Functions.

---

## Phase 4: Frontend Deployment

- [ ] **7. Configure admin-web `.env.staging`**
  Create `apps/admin-web/.env.staging`:
  ```env
  VITE_ADMIN_APP_ENV=staging
  VITE_API_BASE_URL=https://<staging-ref>.supabase.co/functions/v1
  VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<staging-anon-key>
  ```

- [ ] **8. Configure user-web `.env.staging`**
  Create `apps/user-web/.env.staging`:
  ```env
  VITE_APP_ENV=staging
  VITE_API_BASE_URL=https://<staging-ref>.supabase.co/functions/v1
  VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<staging-anon-key>
  ```

- [ ] **9. Build and deploy admin-web**
  ```bash
  pnpm --filter admin-web build -- --mode staging
  # Deploy dist/ to admin-staging.example.com (Vercel, Cloudflare, etc.)
  ```

- [ ] **10. Build and deploy user-web**
  ```bash
  pnpm --filter user-web build -- --mode staging
  # Deploy dist/ to app-staging.example.com (Vercel, Cloudflare, etc.)
  ```

---

## Phase 5: Verification

- [ ] **11. Verify staging admin login**
  - Navigate to `https://admin-staging.example.com`
  - Confirm amber "staging" badge is visible in topbar
  - Log in as `staging-super@example.com`
  - Verify dashboard loads with seeded KPI data
  - Verify settlement page shows seeded job records
  - Verify user list shows 20+ seeded users

- [ ] **12. Verify staging user flow**
  - Navigate to `https://app-staging.example.com`
  - Confirm staging indicator is visible (amber badge)
  - Log in as `normal-user@example.com`
  - Verify rewards balance displays correctly
  - Verify purchase flow reaches expected state
  - Verify claim flow uses `StagingClaimBroadcaster` (fake tx hash returned)

- [ ] **13. Verify environment isolation**
  - Confirm staging frontend does **not** call production Supabase URL
    - Open browser DevTools > Network tab, verify all API calls go to `<staging-ref>.supabase.co`
  - Confirm staging DB has only staging seed data (no production users)
  - Confirm staging session tokens do not work against production endpoints
  - Confirm `APP_ENV=staging` in edge function logs (check Supabase dashboard > Functions > Logs)
  - Confirm claim broadcaster is `StagingClaimBroadcaster` (trigger a test claim, verify fake tx hash)

---

## Post-Deploy

- [ ] **14. Document staging URLs in team wiki/README**
  - Admin: `https://admin-staging.example.com`
  - User: `https://app-staging.example.com`
  - Supabase dashboard: `https://supabase.com/dashboard/project/<staging-ref>`

- [ ] **15. Set up staging reset command**
  Ensure `pnpm reset:staging` works end-to-end:
  ```bash
  pnpm reset:staging
  ```
  Verify: DB dropped, migrations re-run, seed applied, apps still work.

---

## Troubleshooting

| Problem | Check |
|---|---|
| Edge functions return 500 | Verify secrets are set: `supabase secrets list --project-ref <staging-ref>` |
| Admin login fails | Verify admin auth users exist in staging Supabase auth dashboard |
| API calls hit production | Check `.env.staging` has correct `VITE_API_BASE_URL` pointing to staging |
| Migrations fail | Run `supabase db push --db-url <url> --debug` for verbose output |
| Seed fails | Ensure migrations ran first; seed assumes schema exists |
| Claim returns real tx | Verify `APP_ENV=staging` is set -- broadcaster selection depends on it |
