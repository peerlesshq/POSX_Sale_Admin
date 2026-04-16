# POSX Token Sale System — Deployment and Env Spec

## 1. Document Control

- Document Name: `14_Deployment_And_Env_Spec.md`
- System Name: POSX Token Sale System
- Purpose: Define the practical environment-variable model, environment separation, startup flow, migration flow, seed flow, cron/job enablement, and minimum deployment requirements for local, staging, and production
- Audience: Backend engineers, frontend engineers, DevOps, QA, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `09_Config_Center_Spec.md`
  - `13_Seed_Data_And_Mock_Data.md`

---

## 2. Purpose and Scope

This document is the practical runtime spec for getting the POSX system running in real environments.

It covers:
- required environments
- required environment variables
- environment separation rules
- local development startup
- staging deployment baseline
- production deployment baseline
- migration and seed flow
- cron/job enablement
- secrets handling
- runtime safety rules

This is intentionally a practical version, not a heavy infrastructure blueprint.

It is designed to prevent the most common failure modes:
- wrong RPC in wrong environment
- wrong contract address in wrong environment
- missing service-role credentials
- running settlement jobs in unintended environments
- mixing staging data with production rules
- inconsistent startup behavior across engineers

---

## 3. Environment Strategy

The system should support exactly three standard environments:

- `local`
- `staging`
- `production`

Optional future environments such as `preview` or `qa` may be added later, but these three are the baseline.

## 3.1 Local

Purpose:
- development
- integration testing
- UI building
- local backend debugging

Characteristics:
- local Supabase or isolated dev project
- seed data enabled
- mock/test RPC allowed
- cron/jobs may be selectively enabled

## 3.2 Staging

Purpose:
- end-to-end validation
- internal testing
- pre-production checks

Characteristics:
- isolated Supabase project
- staging contract address
- testnet or safe staging RPC
- more realistic config and seed data
- scheduled jobs enabled in controlled form

## 3.3 Production

Purpose:
- live system

Characteristics:
- production Supabase project
- production RPC and contract addresses
- no mock data
- only approved cron/jobs enabled
- strongest secret hygiene

---

## 4. Environment Separation Rules

1. Never reuse production secrets in local or staging.
2. Never point staging or local to production contract addresses unless explicitly intended and approved.
3. Never point local/staging to production database.
4. Never run production settlement or sync jobs against staging data.
5. Never load dev seed data into production.
6. Every environment must have its own:
   - Supabase URL
   - Supabase keys
   - RPC URL
   - contract addresses
   - session secrets
7. The running app should surface its environment in the admin UI.

---

## 5. Required Runtime Components

At minimum, the system runtime consists of:

### 5.1 User Frontend
- user-facing web app

### 5.2 Admin Panel
- admin-facing web app

### 5.3 Backend / Edge Functions
- auth
- user APIs
- admin APIs
- claim flow
- purchase flow
- config APIs

### 5.4 Database
- PostgreSQL via Supabase

### 5.5 Scheduled Jobs / Workers
- chain event sync
- settlement jobs
- summary rebuilds
- export jobs
- cleanup jobs

### 5.6 Chain Connectivity
- RPC provider
- chain id
- contract addresses

---

## 6. Environment Variable Principles

1. All secrets must come from environment variables, not code.
2. `.env.example` should contain keys but no real secrets.
3. Variable names must be consistent across apps and scripts.
4. Backend should fail fast on missing required variables.
5. Frontend should only receive safe public variables.
6. Service-role keys and admin secrets must never be exposed to frontend bundles.

---

## 7. Standard Environment Variables

Below is the recommended practical env model.

## 7.1 Core App Variables

```env
APP_ENV=local
APP_NAME=POSX Token Sale System
APP_BASE_URL=http://localhost:3000
ADMIN_BASE_URL=http://localhost:3001
DEFAULT_TIMEZONE=UTC
LOG_LEVEL=debug
```

Notes:
- `APP_ENV` must be one of `local`, `staging`, `production`
- `DEFAULT_TIMEZONE` should remain `UTC`

---

## 7.2 User Frontend Public Variables

These may be exposed to the user frontend bundle if needed.

```env
VITE_APP_ENV=local
VITE_APP_BASE_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:54321/functions/v1/api/v1
VITE_SUPPORTED_LOCALES=zh-CN,zh-TW,en,ko
VITE_DEFAULT_LOCALE=zh-CN
```

Notes:
- do not expose any secret here
- `VITE_API_BASE_URL` should point to the environment-specific API host

---

## 7.3 Admin Frontend Public Variables

```env
VITE_ADMIN_APP_ENV=local
VITE_ADMIN_BASE_URL=http://localhost:3001
VITE_ADMIN_API_BASE_URL=http://localhost:54321/functions/v1/api/v1
VITE_ADMIN_DEFAULT_LOCALE=en
```

---

## 7.4 Supabase Variables

Required for backend and sometimes frontend public config.

### Backend-only
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=replace_me
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Safe public frontend variable if needed
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace_me_public
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in frontend
- use service role only in secure backend execution contexts

---

## 7.5 Auth and Session Variables

```env
USER_SESSION_SECRET=replace_with_long_random_secret
ADMIN_SESSION_SECRET=replace_with_long_random_secret
USER_SESSION_TTL_HOURS=168
ADMIN_SESSION_TTL_HOURS=168
NONCE_TTL_MINUTES=5
```

Notes:
- local may use simple dev secrets
- staging and production must use strong random secrets
- user and admin session secrets should be different

---

## 7.6 Chain / RPC Variables

```env
CHAIN_ID=1
RPC_URL=https://example-rpc-url
CONTRACT_ADDRESS_MAIN=0x0000000000000000000000000000000000000001
MIN_CONFIRMATIONS=12
CHAIN_SYNC_BATCH_SIZE=500
CHAIN_REORG_SAFETY_WINDOW=20
```

Optional if multiple contracts later:

```env
PURCHASE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001
REWARD_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000002
CLAIM_PAYOUT_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000003
```

Practical v1 recommendation:
- if one contract is enough, keep one main contract variable
- do not overcomplicate unless multiple contracts actually exist

---

## 7.7 Job / Scheduler Flags

```env
ENABLE_CHAIN_SYNC_JOB=true
ENABLE_SETTLEMENT_JOB=true
ENABLE_SUMMARY_REBUILD_JOB=true
ENABLE_EXPORT_JOB=true
ENABLE_CLEANUP_JOB=true
```

Optional more granular schedule tuning:

```env
CHAIN_SYNC_INTERVAL_SECONDS=60
SETTLEMENT_RUN_HOUR_UTC=0
SETTLEMENT_RUN_MINUTE_UTC=10
SUMMARY_REBUILD_INTERVAL_MINUTES=60
EXPORT_POLL_INTERVAL_SECONDS=30
```

Notes:
- local may disable some jobs and run them manually
- staging should enable the same job categories as production where possible

---

## 7.8 Claim Flow Variables

```env
MIN_CLAIM_AMOUNT_DEFAULT=10
CLAIM_PENDING_SIGNATURE_TTL_MINUTES=30
CLAIM_MAX_RETRY_COUNT=3
```

Notes:
- official business values should still come from config resolver where appropriate
- these env variables are best treated as safety/runtime defaults, not the business source of truth

---

## 7.9 Purchase Flow Variables

```env
MIN_PURCHASE_AMOUNT_DEFAULT=1000
PURCHASE_ORDER_EXPIRY_MINUTES=60
```

Same note:
- env values are runtime fallbacks or boot defaults
- business logic should prefer config versions once system initialized

---

## 7.10 Reporting / Export Variables

```env
EXPORT_STORAGE_PATH=/tmp/posx_exports
EXPORT_RETENTION_DAYS=7
REPORT_MAX_EXPORT_ROWS=100000
```

---

## 7.11 Observability / Debug Variables

```env
ENABLE_REQUEST_LOGGING=true
ENABLE_SQL_DEBUG=false
ENABLE_JOB_DEBUG=true
```

Recommended:
- local: more verbose
- staging: moderate
- production: careful and structured only

---

## 8. Suggested `.env.example`

Use a repo-level `.env.example` with placeholders only.

```env
APP_ENV=local
APP_NAME=POSX Token Sale System
APP_BASE_URL=http://localhost:3000
ADMIN_BASE_URL=http://localhost:3001
DEFAULT_TIMEZONE=UTC
LOG_LEVEL=debug

VITE_APP_ENV=local
VITE_APP_BASE_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:54321/functions/v1/api/v1
VITE_SUPPORTED_LOCALES=zh-CN,zh-TW,en,ko
VITE_DEFAULT_LOCALE=zh-CN

VITE_ADMIN_APP_ENV=local
VITE_ADMIN_BASE_URL=http://localhost:3001
VITE_ADMIN_API_BASE_URL=http://localhost:54321/functions/v1/api/v1
VITE_ADMIN_DEFAULT_LOCALE=en

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=replace_me
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace_me_public

USER_SESSION_SECRET=replace_with_long_random_secret
ADMIN_SESSION_SECRET=replace_with_long_random_secret
USER_SESSION_TTL_HOURS=168
ADMIN_SESSION_TTL_HOURS=168
NONCE_TTL_MINUTES=5

CHAIN_ID=1
RPC_URL=https://example-rpc-url
CONTRACT_ADDRESS_MAIN=0x0000000000000000000000000000000000000001
MIN_CONFIRMATIONS=12
CHAIN_SYNC_BATCH_SIZE=500
CHAIN_REORG_SAFETY_WINDOW=20

ENABLE_CHAIN_SYNC_JOB=true
ENABLE_SETTLEMENT_JOB=true
ENABLE_SUMMARY_REBUILD_JOB=true
ENABLE_EXPORT_JOB=true
ENABLE_CLEANUP_JOB=true
CHAIN_SYNC_INTERVAL_SECONDS=60
SETTLEMENT_RUN_HOUR_UTC=0
SETTLEMENT_RUN_MINUTE_UTC=10
SUMMARY_REBUILD_INTERVAL_MINUTES=60
EXPORT_POLL_INTERVAL_SECONDS=30

MIN_CLAIM_AMOUNT_DEFAULT=10
CLAIM_PENDING_SIGNATURE_TTL_MINUTES=30
CLAIM_MAX_RETRY_COUNT=3
MIN_PURCHASE_AMOUNT_DEFAULT=1000
PURCHASE_ORDER_EXPIRY_MINUTES=60

EXPORT_STORAGE_PATH=/tmp/posx_exports
EXPORT_RETENTION_DAYS=7
REPORT_MAX_EXPORT_ROWS=100000

ENABLE_REQUEST_LOGGING=true
ENABLE_SQL_DEBUG=false
ENABLE_JOB_DEBUG=true
```

---

## 9. Local Development Setup

## 9.1 Minimum Local Dependencies

Required locally:
- Node.js / package manager
- Supabase local stack or isolated dev Supabase project
- access to a safe RPC endpoint or mocked chain layer
- environment variables configured

## 9.2 Recommended Local Startup Flow

1. copy `.env.example` to local env files
2. start Supabase local stack
3. run database migrations
4. seed baseline data
5. start edge functions / backend local runner
6. start user frontend
7. start admin frontend

Example flow:

```bash
cp .env.example .env.local
supabase start
npm run db:migrate
npm run db:seed
npm run dev:user
npm run dev:admin
npm run dev:functions
```

The exact command names can vary, but the sequence should remain consistent.

## 9.3 Local Recommended Defaults

- use `APP_ENV=local`
- use local/stub RPC or testnet
- seed data enabled
- settlement and sync jobs optional by default

Recommended local job policy:
- `ENABLE_CHAIN_SYNC_JOB=false` unless actively testing sync
- `ENABLE_SETTLEMENT_JOB=false` unless actively testing cron flow
- allow manual trigger scripts instead

---

## 10. Staging Setup

## 10.1 Purpose

Staging should behave like production as much as possible without using production secrets or data.

## 10.2 Staging Requirements

- isolated Supabase project
- isolated admin accounts
- staging contract address or safe testnet contract
- cron jobs enabled in realistic schedule
- staging seed data or controlled test dataset

## 10.3 Staging Env Differences

Typical staging values:
- `APP_ENV=staging`
- `LOG_LEVEL=info`
- `ENABLE_CHAIN_SYNC_JOB=true`
- `ENABLE_SETTLEMENT_JOB=true`
- `ENABLE_SUMMARY_REBUILD_JOB=true`
- `ENABLE_EXPORT_JOB=true`

## 10.4 Staging Safety Rules

- never use production DB URL
- never use production service-role key
- clearly mark environment in Admin Panel
- no dev seed reset commands allowed casually

---

## 11. Production Setup

## 11.1 Purpose

Production is the live environment and must use the strictest operational controls.

## 11.2 Production Requirements

- isolated production Supabase project
- production RPC URL
- production contract address
- production-grade secrets
- job scheduling enabled intentionally
- no mock data or dev seed data
- environment clearly labeled in admin shell

## 11.3 Production Runtime Defaults

Typical production values:
- `APP_ENV=production`
- `LOG_LEVEL=info` or `warn`
- all required jobs enabled
- `ENABLE_SQL_DEBUG=false`

## 11.4 Production Hard Rules

- no plaintext secrets committed anywhere
- no seed scripts that create demo users should run in production
- no local/staging contract addresses in production env
- any config boot defaults must match approved production baseline

---

## 12. Database Migration Flow

## 12.1 Migration Rules

- migrations must be versioned and deterministic
- schema changes should be applied through migration scripts only
- manual hot-editing tables in shared environments should be avoided

## 12.2 Recommended Migration Flow

For any environment:
1. verify env points to correct DB
2. run migrations
3. verify schema health
4. run seed/bootstrap only where appropriate

Example:

```bash
npm run db:migrate
```

## 12.3 Production Migration Safety

Before production migration:
- confirm environment variables
- confirm DB target
- confirm backup/rollback readiness according to team practice
- confirm no incompatible seed task bundled into migration command

---

## 13. Seed Flow

## 13.1 Local Seed

Allowed:
- full baseline business seed data
- mock users
- referral trees
- purchases, rewards, burns, claims, logs

Example:

```bash
npm run db:seed
```

## 13.2 Staging Seed

Allowed:
- controlled realistic test dataset
- no fake production secrets
- should support QA scenarios

## 13.3 Production Seed

Allowed only for:
- bootstrap admin account
- required config versions
- chain sync initialization
- optional content defaults

Never run full demo seed in production.

---

## 14. Job / Cron Enablement Rules

## 14.1 Required Job Categories

Core jobs:
- chain sync
- daily settlement
- summary rebuild
- export job processing
- cleanup jobs

## 14.2 Local Job Policy

Recommended local policy:
- enable manually or selectively
- avoid background noise during frontend-only development

## 14.3 Staging Job Policy

Recommended staging policy:
- run all core jobs on real schedules where possible
- use safe staging data and contracts

## 14.4 Production Job Policy

Recommended production policy:
- run all required jobs with alerting and logs
- ensure one authoritative scheduler path for each job

## 14.5 Double-Run Prevention

Important rule:
- do not allow duplicate schedulers to execute the same settlement or sync job concurrently without coordination

Recommended safeguards:
- job locks
- idempotent job semantics
- settlement job uniqueness by date/mode

---

## 15. Secrets Management Rules

## 15.1 Secrets Never Stored In

Never store real secrets in:
- source code
- committed `.env` files
- frontend bundle
- seed documents
- screenshots or shared plaintext docs

## 15.2 Secrets That Must Remain Backend-Only

- `SUPABASE_SERVICE_ROLE_KEY`
- `USER_SESSION_SECRET`
- `ADMIN_SESSION_SECRET`
- any payout/broadcast secret or signer if introduced later
- private RPC auth credentials if sensitive

## 15.3 Recommended Storage

Use environment secret storage provided by the runtime/platform.

Local development may use uncommitted `.env.local` files.

---

## 16. Frontend Runtime Rules

## 16.1 User Frontend

Safe to expose only public values such as:
- API base URL
- public Supabase URL
- public anon key if actually needed
- supported locales
- default locale
- environment label

## 16.2 Admin Frontend

Same principle:
- expose only what admin UI needs publicly
- never expose backend service-role secrets

## 16.3 Environment Labels in UI

Recommended:
- admin shell shows `local`, `staging`, or `production`
- staging and production should be visually distinguishable

---

## 17. Practical Startup Commands

These command names are illustrative and should be adapted to the repo, but this is the recommended practical split.

## 17.1 Install

```bash
npm install
```

## 17.2 Start Local Infra

```bash
supabase start
```

## 17.3 Run Migrations

```bash
npm run db:migrate
```

## 17.4 Seed Local Data

```bash
npm run db:seed
```

## 17.5 Start User Frontend

```bash
npm run dev:user
```

## 17.6 Start Admin Frontend

```bash
npm run dev:admin
```

## 17.7 Start Functions / Backend Local

```bash
npm run dev:functions
```

## 17.8 Run Jobs Manually

Recommended helper commands:

```bash
npm run job:chain-sync
npm run job:settlement -- --date=2026-04-12
npm run job:summary-rebuild
npm run job:export-worker
```

These are especially useful in local development.

---

## 18. Minimum Health Checklist Per Environment

## 18.1 Local

Before starting feature work, verify:
- DB reachable
- migrations applied
- baseline config exists
- at least one admin login works
- at least one user seed exists

## 18.2 Staging

Before QA round, verify:
- DB reachable
- jobs enabled
- chain sync source configured
- config baseline correct
- export path writable
- admin UI environment clearly marked

## 18.3 Production

Before release, verify:
- correct environment label
- correct DB target
- correct RPC target
- correct contract address
- required jobs enabled
- no demo seed actions included
- secrets injected successfully

---

## 19. Failure Modes This Spec Must Prevent

The following are the most common runtime mistakes this document is intended to prevent:

1. Running staging against production DB
2. Running production against staging contract
3. Missing service-role key causing backend failures
4. Missing session secret causing auth inconsistency
5. Jobs disabled accidentally in staging/production
6. Duplicate settlement job runners
7. Frontend pointed to wrong API host
8. Production seeded with demo data
9. Admin UI not showing environment clearly
10. Missing baseline config causing runtime logic failure

---

## 20. Recommended File Structure for Env Usage

Example practical structure:

```text
.env.example
.env.local
.env.staging
.env.production
apps/user-web/.env.local
apps/admin-web/.env.local
supabase/functions/.env.local
```

Recommended rule:
- keep shared keys documented centrally
- actual real values injected per deployment environment
- avoid duplicating secret definitions unnecessarily across many files

---

## 21. Acceptance Criteria

This document is sufficient when all are true:

1. engineers can boot the project locally from a clean repo using documented env variables
2. staging and production can be separated safely by env configuration alone
3. required secrets and runtime variables are clearly named and scoped
4. frontend public variables are separated from backend secret variables
5. migrations and seed flow are clear and environment-appropriate
6. job enablement and scheduling intent are explicit
7. common misconfiguration risks are reduced significantly

---

## 22. Final Recommendation

For v1, keep deployment simple:
- one clear env model
- one migration flow
- one seed flow for local/staging
- one safe bootstrap path for production
- explicit job toggles
- no over-engineered infrastructure document until the product is truly running

This practical version is enough for Cursor and Claude Code to generate runnable code and env scaffolding without drifting into inconsistent setups.

