# Staging Environment Plan

Three-environment model: **local**, **staging**, **production**.

---

## local

| Aspect | Value |
|---|---|
| DB | Local Supabase: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Auth | Local Supabase auth, dev bypass enabled |
| Edge Functions | `supabase functions serve` (hot-reload) |
| Claim Broadcaster | `MockClaimBroadcaster` (instant success, fake tx hashes) |
| Jobs | All disabled (`*_ENABLED=false`) |
| Frontend (user-web) | `http://localhost:5180` |
| Frontend (admin-web) | `http://localhost:5181` |
| Chain RPC | Stub (no real RPC client) |
| Reset | `pnpm db:bootstrap` (drop + migrate + seed) |
| Env indicator | Green "local" badge (admin-web topbar/sidebar) |

### local env vars

```
APP_ENV=local
APP_BASE_URL=http://localhost:5180
ADMIN_BASE_URL=http://localhost:5181
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
USER_SESSION_SECRET=local-user-secret
ADMIN_SESSION_SECRET=local-admin-secret
CHAIN_ID=97
RPC_URL=http://localhost:8545
CONTRACT_ADDRESS_MAIN=0x0000000000000000000000000000000000000000
```

---

## staging

| Aspect | Value |
|---|---|
| DB | Separate Supabase project (staging), dedicated DB |
| Auth | Staging Supabase auth pool (separate user base from production) |
| Edge Functions | Deployed to staging Supabase project |
| Claim Broadcaster | `StagingClaimBroadcaster` (fake tx hashes, full state ladder) |
| Jobs | Selective: `SETTLEMENT_ENABLED=false` (manual only), `SYNC_ENABLED=false`, `REBUILD_ENABLED=true` |
| Frontend (user-web) | `app-staging.example.com` or Vercel preview URL |
| Frontend (admin-web) | `admin-staging.example.com` or Vercel preview URL |
| Chain RPC | BSC testnet (`https://data-seed-prebsc-1-s1.binance.org:8545/`) or stub |
| Reset | `pnpm reset:staging` (drop + migrate + seed:staging) |
| Env indicator | Amber "staging" badge in both admin-web and user-web |

### staging env vars

```
APP_ENV=staging
APP_BASE_URL=https://app-staging.example.com
ADMIN_BASE_URL=https://admin-staging.example.com
SUPABASE_URL=https://<staging-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
SUPABASE_DB_URL=postgresql://postgres:<staging-db-password>@db.<staging-project-ref>.supabase.co:5432/postgres
USER_SESSION_SECRET=<staging-user-secret>
ADMIN_SESSION_SECRET=<staging-admin-secret>
CHAIN_ID=97
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
CONTRACT_ADDRESS_MAIN=<staging-contract-address>
```

### staging reset workflow

```bash
# 1. Drop and recreate schema
pnpm reset:staging

# Internally this runs:
#   supabase db reset --db-url $SUPABASE_DB_URL
#   pnpm migrate:staging
#   pnpm seed:staging
```

---

## production

| Aspect | Value |
|---|---|
| DB | Production Supabase project |
| Auth | Production Supabase auth pool |
| Edge Functions | Deployed to production Supabase project |
| Claim Broadcaster | `ProductionGateClaimBroadcaster` (blocks all claims until real adapter is implemented) |
| Jobs | Controlled via per-job enable flags |
| Frontend (user-web) | `app.example.com` |
| Frontend (admin-web) | `admin.example.com` |
| Chain RPC | BSC mainnet (`https://bsc-dataseed.binance.org/`) |
| Reset | **Never**. Manual ops only. |
| Env indicator | Red "production" badge (admin-web topbar/sidebar) |

### production env vars

```
APP_ENV=production
APP_BASE_URL=https://app.example.com
ADMIN_BASE_URL=https://admin.example.com
SUPABASE_URL=https://<prod-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>
SUPABASE_DB_URL=postgresql://postgres:<prod-db-password>@db.<prod-project-ref>.supabase.co:5432/postgres
USER_SESSION_SECRET=<prod-user-secret>
ADMIN_SESSION_SECRET=<prod-admin-secret>
CHAIN_ID=56
RPC_URL=https://bsc-dataseed.binance.org/
CONTRACT_ADDRESS_MAIN=<prod-contract-address>
```

---

## Key Differences Summary

| Feature | local | staging | production |
|---|---|---|---|
| Claim broadcaster | Mock | StagingClaim (fake tx) | ProductionGate (blocked) |
| DB reset | Routine | On demand | Never |
| Dev bypass | Enabled | Disabled | Disabled |
| Job flags | All off | Selective | Production-controlled |
| Chain | Stub | Testnet/stub | Mainnet |
| Auth pool | Local | Staging-only | Production-only |
| Side effects | None | Snapshots only (no payouts) | Full (when implemented) |
