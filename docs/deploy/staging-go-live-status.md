# Staging Go-Live Status

Date: 2026-04-16

---

## What's deployed

### Database ✅
- **Supabase project**: `kzznfhtcevzysztzahzl` (us-east-1)
- **Pooler**: `aws-1-us-east-1.pooler.supabase.com:6543`
- **39 tables** created via 13 migrations
- **Seed data**: 20 users, 4 admins, 14 config versions, 16 purchase orders, 12 purchases, 5 settlement jobs, 20 team rewards, 12 admin logs, 10 job runs, 12 vesting lots, 3 claim orders, 12 referral bindings, 5 direct rewards, 5 burn records, 5 report export jobs

### Edge Functions ⚠️ BLOCKED
- **Secrets set**: APP_ENV, APP_NAME, APP_BASE_URL, ADMIN_BASE_URL, chain config, session secrets, job flags — all configured
- **SUPABASE_* vars**: auto-injected by Supabase runtime (URL, service role key, DB URL)
- **Deployment blocked**: requires Docker for Supabase CLI bundling. The monorepo structure (`supabase/functions/api/` imports from `supabase/functions/_shared/` via import map) means the CLI can't discover all source files without Docker-based bundling.
- **Workaround options**:
  1. Install Docker Desktop and run `supabase functions deploy api`
  2. Use `supabase functions serve` locally for development
  3. Create a single-file bundle using esbuild (requires fixing the barrel export chain)

### Admin-web ✅ (with SSO gate)
- **Vercel project**: `dist` (under `posx` team)
- **Deployment URLs**: 
  - `dist-itzhaag6a-posx.vercel.app` (latest)
  - `dist-tau-beryl-74.vercel.app` (alias)
  - `dist-posx.vercel.app` (team alias, SSO protected)
- **Built with**: `VITE_ADMIN_APP_ENV=staging`, mock API off, dev login off
- **SSO protection**: Vercel team has SSO enabled. Personal aliases work; team aliases require Vercel login.

### User-web ✅ (with SSO gate)
- **Deployment URL**: `dist-7idbud0ay-posx.vercel.app`
- **Built with**: `VITE_APP_ENV=staging`, mock API off, dev auth bypass off

---

## What's blocking full staging functionality

### 1. Edge Functions (critical path)
Without the edge function, both frontends will show errors because there's no API to connect to. Options:
- **Option A**: Install Docker Desktop → `supabase functions deploy api` 
- **Option B**: Run the API locally with `supabase functions serve api --env-file .env.staging`
- **Option C**: Deploy via GitHub Actions CI/CD (Docker is available in CI runners)

### 2. Vercel SSO Protection
The `posx` Vercel team has SSO protection enabled on all deployments. Either:
- Disable SSO protection for staging projects (Vercel Dashboard → Project → Settings → Deployment Protection)
- Use custom domains for staging (not SSO-gated)
- Access via personal deployment URLs (e.g., `dist-tau-beryl-74.vercel.app`)

### 3. Vercel Project Naming
Both admin-web and user-web deployed to the same "dist" Vercel project because they both deploy from `./dist`. Should be separated into dedicated projects (`posx-admin-staging`, `posx-user-staging`).

---

## Immediate next steps

1. **Install Docker Desktop** on the deployment machine
2. Run `supabase functions deploy api --project-ref kzznfhtcevzysztzahzl`
3. Disable Vercel SSO protection for staging projects
4. Create separate Vercel projects for admin and user staging apps
5. Run the full 52-point smoke test from `docs/deploy/staging-smoke-test.md`
