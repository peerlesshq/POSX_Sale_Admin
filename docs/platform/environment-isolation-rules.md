# Environment Isolation Rules

Every rule below must hold true for staging to be safe. Violations are deployment blockers.

---

## 1. Supabase Project Isolation

- Each environment uses a **separate Supabase project** (separate project ref, separate dashboard).
- Supabase URLs are distinct per environment:
  - local: `http://127.0.0.1:54321`
  - staging: `https://<staging-ref>.supabase.co`
  - production: `https://<prod-ref>.supabase.co`
- Anon keys, service role keys, and JWT secrets are unique per project.
- **No shared Supabase project** between any two environments.

## 2. Database Isolation

- Each environment has its own PostgreSQL database instance (Supabase-managed or local).
- No cross-project queries. No foreign data wrappers pointing to another environment.
- No shared connection strings. `SUPABASE_DB_URL` must differ per environment.
- DB migrations run independently per environment.
- Staging DB can be reset at any time without affecting production.

## 3. Auth User Pool Isolation

- Each Supabase project maintains its own auth user pool.
- Staging admin accounts are **not** production admin accounts.
- Staging user accounts are **not** production user accounts.
- Session secrets differ per environment (`USER_SESSION_SECRET`, `ADMIN_SESSION_SECRET`).
- A session token from staging must not authenticate against production (enforced by different secrets).

## 4. Storage Bucket Isolation

- Each environment uses storage buckets within its own Supabase project.
- No shared storage buckets across environments.
- Staging uploads do not appear in production storage.

## 5. Edge Function Deploy Isolation

- Edge functions are deployed independently to each Supabase project.
- `supabase functions deploy` targets the correct project ref via `--project-ref` or linked project.
- Staging edge functions read staging env vars only.
- A staging edge function must never call a production Supabase URL.

## 6. Secrets Isolation

| Secret | Must differ per env |
|---|---|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `SUPABASE_DB_URL` | Yes |
| `USER_SESSION_SECRET` | Yes |
| `ADMIN_SESSION_SECRET` | Yes |
| `RPC_URL` | Yes (testnet vs mainnet) |
| `CONTRACT_ADDRESS_MAIN` | Yes (staging contract vs prod contract) |
| `CHAIN_ID` | Yes if using different chains (97 testnet vs 56 mainnet) |

## 7. Side-Effect Blocking

### Claim broadcasting
- **local**: `MockClaimBroadcaster` -- returns instant success, no chain interaction.
- **staging**: `StagingClaimBroadcaster` -- generates fake tx hashes, walks full state ladder (queued -> broadcasting -> finalized), no real chain tx.
- **production**: `ProductionGateClaimBroadcaster` -- blocks all claim broadcasts until a real chain adapter is implemented.

### Settlement
- Staging settlement writes reward snapshots to DB but **does not move real money**.
- No payout side effects in staging.

### Email / Webhooks
- No email sending exists in the current codebase.
- No webhook dispatching exists in the current codebase.
- If added later, they must be gated per environment (staging uses a sink/mock).

## 8. Frontend Env Var Rules

- `VITE_ADMIN_APP_ENV` must match the target environment exactly.
- `VITE_APP_ENV` must match the target environment exactly.
- API base URL (`VITE_API_BASE_URL` or equivalent) must point to the matching environment's edge functions.
- **A staging frontend build must never contain a production Supabase URL or production API URL.**
- Frontend `.env.staging` is a separate file from `.env.production`.

## 9. Fail-Closed on Missing Config

- If `APP_ENV` is not set, the backend must **refuse to start** (not default to production).
- If `SUPABASE_URL` is missing, the backend must **refuse to start**.
- `loadServerEnv()` from `@posx/config` validates all 9 required vars at startup.
- Missing env vars must throw, not silently fall back.

## 10. Production-Only Feature Gates

- Features that require production config (e.g., real chain RPC, real payouts) must check `APP_ENV === 'production'` explicitly.
- Staging must not accidentally enable production-only code paths.
- The `ProductionGateClaimBroadcaster` is the reference pattern: it blocks unless explicitly production.

## 11. Chain RPC Isolation

- **local**: stub RPC (no real chain client exists).
- **staging**: BSC testnet RPC URL or stub. `CHAIN_ID=97`.
- **production**: BSC mainnet RPC URL. `CHAIN_ID=56`.
- A staging backend must never submit transactions to mainnet.

## 12. Job Flag Isolation

- All job enable flags default to `false` across all environments.
- Staging enables only what is needed for QA:
  - `SETTLEMENT_ENABLED=false` (manual trigger only)
  - `SYNC_ENABLED=false`
  - `REBUILD_ENABLED=true`
- Production sets flags based on operational readiness.
- A job enabled in staging must not perform production-grade side effects (enforced by broadcaster and settlement isolation above).

---

## Verification Checklist

Before any staging deployment, confirm:

- [ ] Staging Supabase project URL does not match production
- [ ] Staging service role key does not match production
- [ ] Staging DB URL does not match production
- [ ] Session secrets differ from production
- [ ] RPC URL points to testnet (not mainnet)
- [ ] Contract address is a staging contract (not production)
- [ ] Frontend env vars point to staging API, not production
- [ ] `APP_ENV=staging` is set (not `production`, not empty)
- [ ] Claim broadcaster resolves to `StagingClaimBroadcaster`
- [ ] Settlement writes snapshots only (no payout calls)
