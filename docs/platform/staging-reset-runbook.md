# Staging Reset Runbook

How to reset the staging environment to a known baseline. Use this after schema changes, before QA cycles, or when staging data has diverged from the seed fixtures.

---

## Quick reference

| Command | What it does | When to use |
|---|---|---|
| `pnpm seed:staging` | Runs the 4 seed SQL files (drops existing data, re-inserts) | Data corruption, quick reset |
| `pnpm reset:staging` | Drops all tables, re-runs migrations, then seeds | Schema changes, full reset |
| `pnpm verify:env` | Validates env vars for the current APP_ENV | Before any deployment |
| `pnpm db:bootstrap` | Migrate + seed (local dev seed, not staging) | Local dev only |

---

## Full reset procedure

### Prerequisites

1. `.env` or environment variables must have `APP_ENV=staging`
2. `SUPABASE_DB_URL` must point to the staging Supabase project
3. The staging database must be accessible from your machine

### Steps

```bash
# 1. Verify you're targeting staging (not production!)
APP_ENV=staging pnpm verify:env

# 2. Full reset: drop + migrate + seed
APP_ENV=staging pnpm reset:staging

# 3. Verify the seed took effect
# Connect to staging DB and spot-check:
#   SELECT count(*) FROM users;          -- expect 20
#   SELECT count(*) FROM admin_users;    -- expect 4
#   SELECT count(*) FROM settlement_jobs; -- expect 5+
```

### What `reset:staging` does internally

1. **Safety check**: refuses to run unless `APP_ENV=staging`
2. **Drop**: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
3. **Migrate**: runs all SQL files from `supabase/migrations/` in order
4. **Seed**: runs the 4 files from `supabase/seeds/` in order:
   - `base.sql` — config versions (14 rows)
   - `admin-fixtures.sql` — admin accounts + logs (4 admins, 12 log entries)
   - `user-fixtures.sql` — users, purchases, vesting, claims, referrals (20 users)
   - `ops-scenarios.sql` — settlement jobs, job runs, chain sync, reports, rewards

### Seed-only reset

If the schema hasn't changed, you can re-seed without dropping tables:

```bash
APP_ENV=staging pnpm seed:staging
```

This is faster because it skips migrations. The seed files use `DELETE FROM ... WHERE TRUE` for idempotent cleanup.

---

## After a schema migration

When a new migration is added:

```bash
# 1. Run the new migration against staging
APP_ENV=staging pnpm db:migrate

# 2. Re-seed if the migration altered table structure
APP_ENV=staging pnpm seed:staging

# 3. Verify
APP_ENV=staging pnpm verify:env
```

---

## Edge function redeployment

After backend code changes:

```bash
# Deploy to staging Supabase project
supabase functions deploy api \
  --project-ref YOUR_STAGING_PROJECT_REF \
  --import-map supabase/functions/import_map.json

# Set env vars (first time only, or when changed)
supabase secrets set --project-ref YOUR_STAGING_PROJECT_REF \
  APP_ENV=staging \
  SUPABASE_DB_URL="postgresql://..." \
  # ... all required vars from .env.staging.example
```

---

## Frontend redeployment

```bash
# Admin-web
cd apps/admin-web
cp .env.staging .env.production.local   # Vite reads .env.production.local for `vite build`
pnpm exec vite build
# Deploy dist/ to staging hosting

# User-web
cd apps/user-web
cp .env.staging .env.production.local
pnpm exec vite build
# Deploy dist/ to staging hosting
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `reset:staging` refuses to run | `APP_ENV` is not `staging` | Set `APP_ENV=staging` in your shell or `.env` |
| Seed fails with FK violation | Table order wrong in seed SQL | Check `supabase/seeds/` file order, ensure parents before children |
| Admin login fails after reset | Password hash placeholder not replaced | Generate bcrypt hash and update `admin-fixtures.sql` |
| Frontend shows "LOCAL" badge | `.env.staging` not loaded by Vite | Ensure the staging env file is named correctly for your build mode |
| Edge function returns 500 | Missing env vars in Supabase project | Check `supabase secrets list --project-ref ...` |

---

## Emergency: rollback to previous seed

If a bad seed was applied:

```bash
# Full reset to known good state
APP_ENV=staging pnpm reset:staging
```

The reset is designed to be fast (~10 seconds for a fresh DB) and completely repeatable.
