# POSX Token Sale — Runbook

Operational guide for developers and operators. Covers local setup,
the three frontend modes (real / mock / seeded), deployment, and
Phase 6 dev affordances.

> **Phase 6 note**: This runbook reflects the state at the end of
> Phase 6. Tests, fixtures, export worker, and dev access support
> are all in place.

---

## 1. Prerequisites

- Node.js ≥ 18.18
- pnpm ≥ 8.15
- Docker (for local Supabase / Postgres)
- Supabase CLI (for edge-function local serve)

---

## 2. One-time bootstrap

```bash
pnpm install
cp apps/user-web/.env.example apps/user-web/.env.local
cp apps/admin-web/.env.example apps/admin-web/.env.local
```

Create `.env` at the repo root with:

```
SUPABASE_DB_URL=postgres://postgres:postgres@localhost:54322/postgres
# ...other backend env vars per packages/config/src/env/schema.ts
```

Apply migrations:

```bash
pnpm db:migrate
```

Seed minimal dataset:

```bash
pnpm db:seed
```

Seed with Phase 6 personas (local/staging only; refuses to run against
a production-like URL):

```bash
PHASE6_PERSONAS=true pnpm db:seed
```

---

## 3. Running the frontends

Three modes coexist. Pick one per frontend by editing the `.env.local` file.

### 3a. Real API mode (default)

```
# apps/user-web/.env.local
VITE_APP_ENV=local
VITE_API_BASE_URL=http://localhost:54321/functions/v1/api/v1
VITE_USE_MOCK_API=false
VITE_ENABLE_DEV_AUTH_BYPASS=false
```

```
# apps/admin-web/.env.local
VITE_ADMIN_APP_ENV=local
VITE_ADMIN_API_BASE_URL=http://localhost:54321/functions/v1/api/v1
VITE_USE_MOCK_API=false
VITE_ENABLE_ADMIN_DEV_LOGIN=false
```

Start:

```bash
pnpm --filter @posx/user-web run dev    # :3000
pnpm --filter @posx/admin-web run dev   # :3001
supabase functions serve api --import-map supabase/functions/import_map.json
```

In this mode the user-web expects a real wallet (TP Wallet / MetaMask)
for the signature flow. The admin-web expects real DB-backed accounts.

### 3b. Seeded integration mode

Same env vars as real API mode, but ensure `PHASE6_PERSONAS=true` was
passed to `pnpm db:seed`. The backend now has 8 persona users + 3
seeded admin accounts. The admin login works with:

| Email | Password | Role |
|---|---|---|
| `superadmin@posx.local` | `posx-local-super-admin-12` | super_admin |
| `operator@posx.local` | `posx-local-operator-12` | operator |
| `viewer@posx.local` | `posx-local-viewer-12` | viewer |

Admin-web can optionally turn on `VITE_ENABLE_ADMIN_DEV_LOGIN=true` to
show one-click "Sign in as..." buttons on the login screen — these
POST the real credentials to the real `/admin/auth/login` endpoint.

### 3c. Mock API mode (fully offline)

```
# apps/user-web/.env.local
VITE_APP_ENV=local
VITE_USE_MOCK_API=true
VITE_ENABLE_DEV_AUTH_BYPASS=true
```

```
# apps/admin-web/.env.local
VITE_ADMIN_APP_ENV=local
VITE_USE_MOCK_API=true
VITE_ENABLE_ADMIN_DEV_LOGIN=true
```

No backend needed. `pnpm --filter ... run dev` and go. The user-web
shows a persona picker in place of the wallet signature; the admin-web
renders the three dev-login buttons.

---

## 4. Phase 6 dev affordances

### User personas (apps/user-web)

Eight canonical states, each gated to local/staging:

| Key | Wallet suffix | Status | Notes |
|---|---|---|---|
| `elite_leader` | `…0001` | active | Elite tier, team + equal-level rewards |
| `advanced_user` | `…0002` | active | Mid-tier, team rewards only |
| `basic_user` | `…0003` | active | Entry tier |
| `new_user` | `…0004` | active | Zero purchases, invite locked |
| `burn_user` | `…0005` | active | Deposit 25k, holding 8k — burn triggers |
| `restricted_purchase_user` | `…0006` | restricted_purchase | Can't buy |
| `restricted_claim_user` | `…0007` | restricted_claim | Can't claim |
| `suspended_user` | `…0008` | suspended | Everything blocked |

The persona catalog lives in **two** places that must stay in sync:

1. `apps/user-web/src/lib/dev-personas.ts` — frontend shape
2. `supabase/seed/data/personas.ts` — backend fixture shape

If you add a ninth persona, update both.

### Admin accounts

The 3 test admin accounts are created by the main seed transaction
(not gated by `PHASE6_PERSONAS`) so they're available as soon as you
run `pnpm db:seed`.

### Production guarantees

All dev flags are hard-disabled in production at the source:

- `apps/user-web/src/env.ts` — force-zeroes `useMockApi` and
  `enableDevAuthBypass` when `VITE_APP_ENV === 'production'`
- `apps/admin-web/src/env.ts` — same force-zero for its own flags
- `supabase/seed/persona-fixture.ts::isProductionLike` — rejects
  connection strings that contain `prod`, `production`, `supabase.co`,
  or `live`

These are independent gates — breaking any one of them doesn't open
the others.

---

## 5. Report export worker (Phase 6)

The admin Reports page now produces real CSV files.

Supported report types (see
`supabase/functions/_shared/src/services/report-export-worker.ts`):

- `deposit`
- `direct_reward`
- `team_reward`
- `equal_level_reward`
- `reward_generation_raw`
- `reward_generation_actual`
- `burn`
- `claim_payout_history`
- `team_ranking`

Flow:

1. Admin clicks "Create Export" → POST `/admin/reports/export`
2. Handler inserts a `queued` row, immediately calls
   `ReportExportWorkerService.createAndRun()`
3. Worker transitions to `running`, runs the matching SQL, formats
   CSV, stores blob in-process, marks `completed`
4. Admin clicks the download link → GET
   `/admin/reports/export/:id/download` returns the raw CSV
5. Any failure transitions the row to `failed` with an error message

**In-process blob store.** Phase 6 uses `InMemoryBlobStore`. For
multi-replica production, swap in an S3/GCS implementation of
`BlobStore` — the rest of the worker is storage-agnostic.

Re-run: POST `/admin/reports/export/:id/run` (must be in `queued`
state; use when a background cron re-queues stale jobs).

---

## 6. Tests

```bash
pnpm test          # full suite
pnpm test:watch    # watch mode
```

Vitest picks up:

- `packages/**/test/**/*.test.ts` — domain-rules, shared-utils unit tests
- `supabase/functions/_shared/test/**/*.test.ts` — service layer tests
- `apps/**/test/**/*.test.ts` — frontend unit tests (future)

Coverage: `pnpm test -- --coverage`.

### Key test files

- `packages/domain-rules/test/burn.test.ts` — 01 §8 burn math
- `packages/domain-rules/test/equal-level.test.ts` — 01 §7 replacement
- `packages/domain-rules/test/team-differential.test.ts` — 01 §6 differential
- `packages/shared-utils/test/amount.test.ts` — decimal primitives
- `supabase/functions/_shared/test/report-export-worker.test.ts` — end-to-end
  export worker with a fake `DbClient`
- `supabase/functions/_shared/test/persona-fixture.test.ts` —
  `isProductionLike` guard + persona catalog shape

---

## 7. Frequently used commands

| Task | Command |
|---|---|
| Typecheck everything | `pnpm -r run typecheck` |
| Lint | `pnpm lint` |
| Run tests | `pnpm test` |
| Apply migrations | `pnpm db:migrate` |
| Seed minimal dataset | `pnpm db:seed` |
| Seed + personas | `PHASE6_PERSONAS=true pnpm db:seed` |
| Start user-web | `pnpm --filter @posx/user-web run dev` |
| Start admin-web | `pnpm --filter @posx/admin-web run dev` |
| Start edge function | `supabase functions serve api --import-map supabase/functions/import_map.json` |

---

## 8. Common operations

### Rotate a test admin password

Test admins are planted by `supabase/seed/index.ts::seedAdmins`.
Edit the hash inputs there and re-run `pnpm db:seed` against a clean
DB. (Password policy: minimum 12 characters, enforced by
`admin-action-guard`.)

### Force a settlement backfill

1. Admin console → Settlement → "Trigger Backfill"
2. Set `settlement_date`, `mode = backfill`, provide a reason
3. `settlement_jobs` row is created; reward snapshots are inserted
4. Never re-runs for `(settlement_date, wallet)` pairs that already
   completed (01 §9 official-vs-backfill semantics)

### Apply a recompute adjustment

1. Admin console → Recompute → Run Preview (always safe)
2. Review preview_result JSON
3. Apply → super admin only, creates adjustment records
4. Claimed history is never overwritten — only new adjustment rows

### Create a config version

1. Admin console → Config → New Version
2. Effective_from must be in the future or `next_settlement_day`
3. Never edit an existing version — always create a new one
4. Active version at evaluation time is chosen by
   `config-resolver-db` (not the UI)

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin login 401 | Wrong password or unseeded DB | `pnpm db:seed` and retry |
| `pnpm db:seed` refuses personas | SUPABASE_DB_URL looks prod-ish | Use a local/staging URL; `isProductionLike` is conservative |
| Mock login succeeds but API calls fail | `VITE_USE_MOCK_API` mismatch between frontends | Both must be true for full mock |
| Dev persona session rejected by real API | Dev session tokens have `dev-` prefix | Only use dev bypass with `VITE_USE_MOCK_API=true` |
| Export download returns 404 | Blob evicted on server restart | Create a new export — blobs are in-process |

---

## 10. Production readiness checklist

Before promoting a build to production:

- [ ] `VITE_APP_ENV=production` and `VITE_ADMIN_APP_ENV=production`
- [ ] All `VITE_USE_MOCK_API`, `VITE_ENABLE_DEV_AUTH_BYPASS`,
      `VITE_ENABLE_ADMIN_DEV_LOGIN` absent or `false`
- [ ] Seeded test admin accounts rotated or deleted
- [ ] Persona fixtures NOT applied (`PHASE6_PERSONAS` unset during
      production seed)
- [ ] `ReportExportWorkerService` pointed at an S3/GCS `BlobStore`
      (not the in-memory default) if running multi-replica
- [ ] All tests green: `pnpm test`
- [ ] Typecheck clean: `pnpm -r run typecheck`
- [ ] Lint clean: `pnpm lint`
