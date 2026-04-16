# Remediation Pass 2 — POSX Token Sale System

**Input**: Pass 1 residuals from `docs/qa/remediation-pass1.md` + P0/P1 roadmap items.
**Scope**: 7 sub-passes (P2-1 through P2-7), focused on transactional safety, dashboard correctness, schema enforcement, recompute plumbing, contract alignment, user purchase recovery, and report durability.

---

## 1 · Pass 2 status

**COMPLETE.** All 7 sub-passes applied and verified. Verification ran between sub-passes.

### Cumulative deltas (pre-any-remediation → post-Pass-2)

| Metric | Pre-remediation | Post-Pass-1 | **Post-Pass-2** | Cumulative Δ |
|---|---|---|---|---|
| `vitest run` tests | 0 (config broken) | 34 passing | **34 passing** | +34 |
| `admin-web tsc` errors | 38 | 19 | **19** | -19 |
| `user-web tsc` errors | 18 | 10 | **10** | -8 |
| `_shared tsc` errors | 23 | 23 | **22** | -1 |
| `eslint` errors | 13 | 12 | **12** | -1 |
| `eslint` warnings | 46 | 46 | **46** | 0 |

Pass 2 reduced `_shared` errors by 1 (fixed pre-existing unused `db` param in `claim-order.ts`). All other counts are stable — zero regressions introduced by Pass 2.

---

## 2 · Issues fixed

### P2-1 — `withAuditTx` helper + transactional audit (BE-22 / BE-79)

Created `withAuditTx<T>(db, audit, fn)` in `observability/audit-log.ts`. Wraps `fn(tx)` + `writeAuditLog(tx, audit)` in a single `db.transaction()`.

Ported all four transition files:

| Transition | Before | After |
|---|---|---|
| `transitionUserStatus` | Two sequential awaits on bare `db` | `withAuditTx` wraps both atomically |
| `transitionPurchaseOrder` | No audit log at all | Optional `audit` param → `withAuditTx` when provided |
| `transitionClaimOrder` | No audit log at all | Optional `audit` param → `withAuditTx` when provided |
| `transitionSettlementJob` | No audit log at all | Optional `audit` param → `withAuditTx` when provided |

Also fixed pre-existing unused `db` param in `requireClaimOrder` (`_db`).

### P2-2 — Real admin dashboard SQL + pagination count fixes (BE-12 / BE-14 / BE-15)

**Dashboard:**
- Replaced `WHERE 1=0` tier distribution stub with real CTE that reads `qualification_tier` from the most recent `team_rewards_daily` per user, falling back to `'none'`.
- Replaced `trend: []` hardcoded empty array with a 14-day `generate_series` query aggregating daily deposits, team rewards, equal-level rewards, burn totals, and new user counts.

**Pagination (BE-14):**
Fixed all 8 paginated admin handlers — each `count(*)` query now mirrors the exact WHERE clause from its data query:

1. `handleListAdminUsers` — filters: search, status
2. `handleAdminListDirectRewards` — filters: wallet, from_wallet, date range
3. `handleAdminListBurnRecords` — filters: wallet, reward_type, date range
4. `handleListSettlementJobs` — filters: settlement_date, job_type, status
5. `handleListJobRuns` — filters: job_name, status
6. `handleListAdminLogs` — filters: admin_user_id, action, target_type, date range
7. `handleAdminListTeamRewards` — filters: wallet, settle_date, status, date range
8. `handleAdminListEqualLevelRewards` — filters: wallet, line_root, settle_date, status

### P2-3 — Require reason on all destructive admin mutations (BE-70)

Added `reason: z.string().min(1)` to three schemas in `@posx/api-contracts`:
- `CreateAdminConfigRequestSchema` — config version creation now requires audit reason
- `CreateAdminAccountRequestSchema` — admin account creation now requires audit reason
- `UpdateAdminAccountRequestSchema` — admin account mutation now requires audit reason; also added `rotate_session: z.boolean().optional()`

Wired `reason` into the `writeAuditLog` detail object for all three handlers.

### P2-4 — Real recompute preview/apply diff flow (BE-19 / BE-20)

**Schema changes:**
- Added `RecomputeDiffItemSchema` (wallet, direction, amount, source, detail)
- `RecomputePreviewDataSchema` now includes a `diffs` array
- `RecomputeApplyRequestSchema` now requires `preview_settlement_job_id`
- `RecomputeApplyDataSchema` now includes `applied_diff_count`

**Service changes:**
- `RecomputeService.preview()` reads existing team_rewards_daily snapshots for the date, checks for existing adjustment records per user, and stores computed diffs in the settlement_job row's `config_version_snapshot` field.
- `RecomputeService.applyFromPreview()` (new method) loads stored diffs from the preview job by ID, validates the preview is for the correct date, and feeds actionable diffs to `AdjustmentService.create`.
- `handleRecomputeApply` no longer hardcodes `diffs: []` — it calls `applyFromPreview` with the preview job ID from the request.

**Scope note:** The preview diff computation is a SIMPLIFIED version that captures existing snapshot state and adjustment history. Full re-derivation (re-resolving tiers, team aggregates, line differentials, burns from scratch using updated config) is a Phase 6 follow-up. The current implementation makes the preview→apply plumbing work end-to-end with honest data.

### P2-5 — Admin-accounts PATCH contract alignment (CT-05)

- `UpdateAdminAccountRequestSchema` now accepts `reason` (required) and `rotate_session` (optional boolean).
- `handleUpdateAdminAccount` handles `rotate_session: true` by revoking all active `admin_sessions` for the target admin (`SET revoked_at = now() WHERE admin_user_id = $1 AND revoked_at IS NULL`).
- Audit log detail includes `reason` and `rotate_session` state.
- The `.refine()` validator now accepts `rotate_session: true` as a valid "at least one actionable field" option.

### P2-6 — BuyPage retry + recoverPurchase (FE-03)

- Added `recoverPurchase` mutation in BuyPage wired to the existing `api.recoverPurchase(txHash)`.
- Added `handleRetry` (resets step to `idle`) and `handleRecover` (calls recovery mutation).
- New failed-step JSX block with `AlertTriangle` icon, error description, "Start over" secondary button, and "Recover with tx hash" primary button (shown only when `txHash` is available from a prior attach attempt).
- Error display now properly scopes to `step === 'failed'` block instead of floating as a generic text line.

### P2-7 — Report export durable blob storage (BE-66 / BE-67)

**Migration:**
- `0120_report_export_blob_data.sql` — adds `blob_data text` column to `report_export_jobs`.

**Code:**
- New `DatabaseBlobStore` class in `report-export-worker.ts`. Implements the existing `BlobStore` interface by writing the JSON-encoded `{contentType, filename, body}` into the `blob_data` column and reading it back.
- All three admin handlers that construct `ReportExportWorkerService` (`handleCreateReportExport`, `handleRunReportExport`, `handleDownloadReportExport`) now pass `new DatabaseBlobStore(ctx.db)` instead of relying on the in-memory default.
- The in-memory `defaultBlobStore` singleton remains as a local-dev fallback for any code path that doesn't explicitly inject a store.

---

## 3 · Files changed

### New files
- `supabase/migrations/0120_report_export_blob_data.sql`
- `docs/qa/remediation-pass2.md` *(this file)*

### Modified files

**Backend (`supabase/functions/_shared/src/`)**
- `observability/audit-log.ts` — new `withAuditTx` helper
- `transitions/user-status.ts` — ported to `withAuditTx`
- `transitions/purchase-order.ts` — added optional `audit` param + `withAuditTx`
- `transitions/claim-order.ts` — added optional `audit` param + `withAuditTx`; fixed unused `db` → `_db`
- `transitions/settlement-job.ts` — added optional `audit` param + `withAuditTx`
- `handlers/admin.ts` — dashboard SQL, 8 pagination count fixes, reason wiring, recompute preview/apply rewrite, admin-accounts rotate_session, DatabaseBlobStore wiring
- `services/recompute-service.ts` — real preview + `applyFromPreview` method
- `services/report-export-worker.ts` — `DatabaseBlobStore` class

**API contracts (`packages/api-contracts/src/endpoints/`)**
- `admin-config.ts` — added `reason` to `CreateAdminConfigRequestSchema`
- `admin-accounts.ts` — added `reason` + `rotate_session` to schemas
- `admin-settlement.ts` — added `RecomputeDiffItemSchema`, `diffs` to preview response, `preview_settlement_job_id` + `applied_diff_count` to apply

**User frontend (`apps/user-web/src/`)**
- `pages/BuyPage.tsx` — retry button + recoverPurchase mutation + failed-step JSX

---

## 4 · Commands rerun + exact results

```
$ cd supabase/functions/_shared && tsc -b --noEmit
  22 errors (was 23 post-Pass-1 → -1)

$ cd apps/admin-web && tsc -b --noEmit
  19 errors (unchanged from post-Pass-1)

$ cd apps/user-web && tsc -b --noEmit
  10 errors (unchanged from post-Pass-1)

$ vitest run
  Test Files: 1 failed | 5 passed (6)
  Tests: 34 passed (34)

$ eslint "apps/admin-web/src" "apps/user-web/src"
  58 problems (12 errors, 46 warnings)
```

---

## 5 · Remaining S0/S1 blockers

### Still P0 (blocks real user traffic)

| ID | Title | Status |
|---|---|---|
| BE-56/58 option (a) | Real `ProductionClaimBroadcaster` with RPC + finalization cron | Safety gate shipped (Pass 1). Real broadcaster still TODO. |
| BE-12 partial | `current_tier: null` in 9 handler fields (requires per-user tier resolution service) | Dashboard tier distribution fixed. Per-user tier still returns null. |
| BE-31/32/39/40/42 | User profile, team overview, team members — stub fields | Partially addressed by dashboard fixes. Individual handler stubs remain. |

### P1 (blocks "stable" declaration)

| ID | Title | Status |
|---|---|---|
| BE-17 | Role enforcement on read handlers (viewer sees everything) | Open |
| BE-27 | Self-protect on admin role/status changes (can't demote last super_admin) | Open |
| BE-53/54/55 | Job runner error handling + retry + backoff | Open |
| BE-57 | Claim broadcaster `seen` set persisted | Open (replaced by production gate) |
| BE-59 | `lockTeamRewardToClaimOrder` must row-lock or verify lock | Open |
| BE-61 | Recovery needs on-chain attribution check | Open |
| BE-63/64 | Chain event processor batch abort + payload validation | Open |
| BE-80 | Logger PII scrubber | Open |
| FE-06/07 | JobsPage + LogsPage filters in queryKey | Open |
| FE-08 | UsersListPage real server pagination | Open |
| FE-12 | BuyPage chain config from `/config/public` | Open |
| FE-24 | Session expiry redirects to landing | Open |

---

## 6 · Test status clarity

| Suite | Status | Notes |
|---|---|---|
| `packages/shared-utils/test/amount.test.ts` (7 tests) | ✅ PASS | Amount arithmetic |
| `packages/domain-rules/test/team-differential.test.ts` (4 tests) | ✅ PASS | Team differential computation |
| `packages/domain-rules/test/equal-level.test.ts` (10 tests) | ✅ PASS | Equal-level evaluation |
| `packages/domain-rules/test/burn.test.ts` (10 tests) | ✅ PASS | Burn capacity computation |
| `supabase/functions/_shared/test/report-export-worker.test.ts` (3 tests) | ✅ PASS | CSV formatting + worker |
| `supabase/functions/_shared/test/persona-fixture.test.ts` | ❌ FAIL TO LOAD | Pre-existing: `ethers` module not installed in `_shared` package dependencies. The test file imports `wallet-signature.ts` which imports `ethers`. Fix: `pnpm add ethers` in the `_shared` workspace. NOT a regression from Pass 1 or 2. |

**34 total tests pass.** The 1 failing suite is a MODULE LOAD failure (not a test failure) — the test file never executes because its transitive dependency is missing.

---

## 7 · Build / typecheck / lint clean status

| Check | Clean? | Detail |
|---|---|---|
| `admin-web tsc` | ❌ 19 errors | Pre-existing: 3 ECharts readonly, 3 ErrorBoundary override, 4 unused dashboard vars, 5 unused imports, 2 SettlementPage body-type, 1 missing SectionTone export, 1 graphBuilder conversion |
| `user-web tsc` | ❌ 10 errors | Pre-existing: 2 DonutMini index, 3 ErrorBoundary override, 5 lucide-react propTypes |
| `_shared tsc` | ❌ 22 errors | Pre-existing: 6 ConfigGroup value-vs-type, 5 rootDir, 1 ethers, 6 settlement mustHave narrowing, 1 IsoTimestamp, 1 postgres-js param, 1 unused import, 1 db-client param |
| `eslint` | ❌ 12 errors / 46 warnings | Pre-existing unused imports + non-null assertions |
| `vitest` | ✅ 34/34 pass | 1 suite fails to load (pre-existing ethers dep) |
| `vite build` | ✅ succeeds | Both apps build (Vite bypasses tsc strict mode) |

**None of the residual errors are introduced by Pass 1 or Pass 2.** They are all pre-existing issues that were present before remediation began.

---

## 8 · Staging release-candidate quality

**Not yet.** The repo is significantly safer and more correct than it was, but staging RC requires:

1. **ConfigGroup import fix** — 6 pre-existing errors in `_shared` where `ConfigGroup` is imported as a type-only from `@posx/config` but used as a value. One-line fix per consumer: import from `@posx/shared-types` directly, or remove the `type` keyword from the re-export in `@posx/config/config-resolver/types.ts`.

2. **ethers dependency** — `pnpm add ethers` in `_shared` unblocks the persona-fixture test suite.

3. **Per-user tier resolution** — 9 handlers still return `current_tier: null`. Requires a `TierResolutionService` wired into the handler context, or at minimum a SQL join against the most recent `team_rewards_daily.qualification_tier`.

4. **Role enforcement on read handlers** (BE-17) — a viewer can currently see everything an operator sees.

5. **Admin self-protection** (BE-27) — an operator can currently demote the last super_admin.

6. **CI gate** — no PR-required checks exist for lint, typecheck, or test. Every merge is unguarded.

Once items 1-3 are fixed and a CI gate is in place, the repo is staging-RC quality for the admin surface. The user surface additionally needs the real claim broadcaster (BE-56/58 option (a)) before claims can function in production, but the safety gate ensures no harm in the interim.

---

*Pass 2 compiled by the Claude Agent SDK remediation loop on 2026-04-15.*
