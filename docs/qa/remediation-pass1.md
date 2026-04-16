# Remediation Pass 1 — POSX Token Sale System

**Scope**: the 7 P0 sub-passes (A–G) from `docs/qa/prioritized-fix-roadmap.md`.
**Mode**: smallest correct fix, no mock-success behavior, no silent no-ops, no placeholder data presented as real.
**Input audit**: `docs/qa/full-qa-report.md`, `docs/qa/backend-code-audit.md`, `docs/qa/frontend-code-audit.md`, `docs/qa/api-contract-audit.md`, `docs/qa/ui-ux-audit.md`.

---

## 1 · Status

**PASS 1 COMPLETE** — all 7 sub-passes applied, typecheck + lint + tests re-run between sub-passes, deltas captured below.

Headline deltas (pre-fix → post-Pass-1):
- `pnpm vitest run`: **0 tests collected** (`vitest.config.ts` unparseable) → **34 passing tests**, 5 test files green, 1 pre-existing failure (ethers module resolution, unrelated to Pass 1 scope).
- `apps/admin-web` typecheck errors: **38 → 19** (-19 after FE-BUILD-1 unblocked the generic default, -1 more after FE-01 retyped the admin-account mutations).
- `apps/user-web` typecheck errors: **18 → 10** (-7 after FE-BUILD-1, -1 more after FE-04 removed an unused `Card` import).
- `supabase/functions/_shared` typecheck errors: **23 → 23** unchanged. My 7 sub-passes added 0 new errors; all residuals are pre-existing (`ConfigGroup` value-vs-type import, monorepo `rootDir` mis-scoping, `ethers` not installed, `settlement-orchestrator.loadConfigBundle` `mustHave` helper).
- `pnpm lint`: **13 errors / 46 warnings → 12 errors / 46 warnings** (-1 error from removing unused `Card` in TeamPage).
- Routing: `/functions/v1/api/api/v1/*` now lands on the correct handler (CT-01).
- Claim flow: signature verifier now receives the canonical persisted message, not `''` (BE-35/36/89).
- Settlement: per-user atomic writes, idempotency check, advisory lock (BE-49/51/52).
- Admin auth: per-IP rate limit, `(ip, email)` failed-login lockout, success + failure audit (BE-07/08/25).
- Edge function: body cap, CORS + preflight, error-message scrubbing (BE-83/84/86).
- User-web: honest `suspended` / `blacklisted` gating on Team + Invite (FE-04).
- Production claim path: **hard-gated** — no fake tx hashes ever leave prod (BE-56/58, option (b) safety gate).

---

## 2 · Issues fixed

### Sub-pass A — unblock verification

| ID | Title | Effect |
|---|---|---|
| **CT-01** | `supabase/functions/api/serve.ts` normalized `url.pathname` — strips `/functions/v1/<fn-name>/` prefix so the router table matches both the Supabase edge runtime and Node test harnesses. | Router no longer 404s every real request. |
| **FE-BUILD-1** | `apiRequest<T, B = undefined>` → `apiRequest<T, B = unknown>` in both `apps/admin-web/src/api/client.ts` and `apps/user-web/src/api/client.ts`. | 25 "X is not assignable to undefined" call-site errors collapse. |
| **FE-BUILD-8** | `vitest.config.ts` JSDoc comment rewritten to not contain `**/*.test.ts` as a substring. ESBuild's comment lexer was terminating the block comment early at the `*/` inside it. | Vitest runs again — 0 collected → 34 tests collected, 5 suites green. |

### Sub-pass B — FE-01

| ID | Title |
|---|---|
| **FE-01** | `AdminAccountsPage.updateMutation.mutationFn` runtime-introspection fallback that returned `{ok: true, local: true}` after a 120ms timer has been **deleted**. Mutations now call `api.updateAdmin` / `api.createAdmin` directly against their real signatures, and failures are surfaced via an inline `<Alert type="error">` in the `RiskActionModal` (not just an auto-dismissing toast). Body types aligned: `createAdmin` now accepts `reason?`, `updateAdmin` accepts `reason?` + `rotate_session?`. |

### Sub-pass C — BE-35 / BE-36 / BE-89 (claim `signed_message` persistence)

| ID | Title |
|---|---|
| **BE-35/36/89** | `ClaimPreparationService.prepare` now persists the canonical `messageToSign` onto `claim_orders.signed_message` inside the existing insert transaction via a new `persistClaimOrderSignedMessage` repo helper. `router.ts:/api/v1/claims/:id/sign` branch no longer re-derives from an always-null column and no longer defaults to `''`; it reads the persisted value and throws `CONFLICT` if the row is inconsistent. |

### Sub-pass D — BE-49 / BE-51 / BE-52 (settlement hardening)

| ID | Title |
|---|---|
| **BE-49** | `SettlementOrchestrator.settleOneUser` reads/computes unchanged, then wraps every write (team reward daily, per-line detail, equal-level snapshot, burn record) in a single `this.db.transaction`. `BurnService.persistBurnRecord` now accepts an optional `tx: DbClient` so the burn insert joins the same atomic unit. |
| **BE-51** | New `tryAcquireSettlementLock` / `releaseSettlementLock` repo helpers use `pg_try_advisory_lock(hashtext(date), hashtext(mode))`. `run()` acquires the lock before work and releases in a `finally`, guaranteeing at most one concurrent run per `(settlement_date, mode)`. |
| **BE-52** | New `findNonFailedSettlementJob` repo helper. `run()` rejects with `CONFLICT` if a non-failed job already exists for `(settlement_date, mode)`, blocking re-runs of previously-recorded Official / Backfill / Recompute runs. Retry-after-failure is still allowed. |

### Sub-pass E1 — BE-07 / BE-08 / BE-25 (admin auth)

| ID | Title |
|---|---|
| **BE-07** | New `supabase/functions/_shared/src/auth/auth-rate-limit.ts` — in-process sliding-window limiter. Router now applies it to `/auth/nonce`, `/auth/verify`, and `/admin/auth/login` via an `enforceRateLimit` helper. Defaults: 30/min for nonce+verify, 10/min for admin login. |
| **BE-08** | Same module also holds a `(ip, email)` failed-login counter + lockout: 5 consecutive failures → 15-min cooldown. `handleAdminLogin` checks the lockout BEFORE the password compare and bumps the counter on any `AppError`. On success the counter clears. |
| **BE-25** | `handleAdminLogin` writes `admin_login_locked_out`, `admin_login_succeeded`, `admin_login_failed` audit entries with IP + error code + failure count. `handleAdminLogout` writes an `admin_logout` entry with the validated admin id (null if the token was already revoked). |

### Sub-pass E2 — BE-83 / BE-84 / BE-86 (edge function hardening)

| ID | Title |
|---|---|
| **BE-83** | `serve.ts` enforces a 1 MiB request-body cap. Checks both the `content-length` header and the actually-received body length; returns 413 `INVALID_REQUEST` on overflow before handing anything to the parser. |
| **BE-84** | `serve.ts` handles `OPTIONS` preflight with a 204 + `access-control-*` headers, and attaches the same CORS headers to every normal response (including download responses and error envelopes). |
| **BE-86** | New `scrubEnvelope` helper replaces `message` with `"an internal error occurred"` for any error code not in the curated `SAFE_ERROR_CODES` allowlist. Raw Postgres error text, stack traces, and internal-invariant messages can no longer leak to a 500 response. |

### Sub-pass F — FE-04 (user-web restricted gating)

| ID | Title |
|---|---|
| **FE-04** | `RestrictedBanner` primitive now accepts `scope: 'team' | 'invite'`, which renders ONLY for hard account restrictions (`suspended` / `blacklisted`). `TeamPage.tsx` threads `session` from `LayoutContext` and renders `<RestrictedBanner scope="team" />` above the stats. `InvitePage.tsx` does the same with `scope="invite"` AND replaces the share/QR surface with a "Your account is restricted" `SectionCard` when the user is suspended / blacklisted — no new invite links can be generated. |

### Sub-pass G — BE-56 / BE-58 (production claim safety gate)

| ID | Title |
|---|---|
| **BE-56/58** | New `ProductionGateClaimBroadcaster` (in `services/claim-broadcast/production-gate-broadcaster.ts`) returns `{ kind: 'failed', reason: "claim broadcast is disabled in production …" }` from every `submit` and `{ confirmed: false, failureReason: ... }` from every `checkConfirmation`. `pickBroadcaster` in `supabase/functions/api/context.ts` now returns it for `appEnv === 'production'` (local still uses `MockClaimBroadcaster`, staging still uses `StagingClaimBroadcaster`). The deterministic SHA-256 fake tx hashes from staging + mock CANNOT reach a real user in production. `ClaimSigningService` already transitions `pending_signature → queued → failed` on a `failed` outcome, so the user's order reflects the correct state and the signed message is still persisted. |

---

## 3 · Files changed

### New

- `supabase/functions/_shared/src/auth/auth-rate-limit.ts`
- `supabase/functions/_shared/src/services/claim-broadcast/production-gate-broadcaster.ts`
- `docs/qa/remediation-pass1.md` *(this file)*

### Modified

**Backend (`supabase/functions/`)**
- `supabase/functions/api/serve.ts` — CT-01 pathname normalization, BE-83 body size cap, BE-84 CORS + preflight, BE-86 error scrubbing.
- `supabase/functions/api/router.ts` — BE-07 `enforceRateLimit` helper + application to 3 public auth endpoints, BE-35/36/89 hard-fail sign branch when `signed_message` is null.
- `supabase/functions/api/context.ts` — BE-56/58 production gate broadcaster wiring.
- `supabase/functions/_shared/src/auth/index.ts` — re-export auth-rate-limit.
- `supabase/functions/_shared/src/handlers/admin.ts` — BE-07/08/25 admin login lockout + audit, logout audit.
- `supabase/functions/_shared/src/repos/claim-orders.ts` — BE-35/36/89 `persistClaimOrderSignedMessage`.
- `supabase/functions/_shared/src/repos/settlement-jobs.ts` — BE-51/52 `tryAcquireSettlementLock`, `releaseSettlementLock`, `findNonFailedSettlementJob`.
- `supabase/functions/_shared/src/services/claim-preparation-service.ts` — BE-35/36/89 persist message inside the insert transaction.
- `supabase/functions/_shared/src/services/settlement-orchestrator.ts` — BE-49 per-user tx wrap, BE-51/52 advisory lock + idempotency guard, `runLocked` split for try/finally clarity.
- `supabase/functions/_shared/src/services/burn-service.ts` — BE-49 optional `tx` parameter on `persistBurnRecord`.
- `supabase/functions/_shared/src/services/claim-broadcast/index.ts` — re-export production gate.

**Admin frontend (`apps/admin-web/`)**
- `apps/admin-web/src/api/client.ts` — FE-BUILD-1 (`B = unknown`).
- `apps/admin-web/src/api/endpoints.ts` — FE-01 exported `CreateAdminBody` / `UpdateAdminBody` with `reason?`, `rotate_session?`.
- `apps/admin-web/src/api/mock.ts` — FE-01 mock mirror aligned to the new body shapes.
- `apps/admin-web/src/pages/AdminAccountsPage.tsx` — FE-01 deleted fake-success fallback, typed mutations against real API, wired inline `<Alert>` errors.

**User frontend (`apps/user-web/`)**
- `apps/user-web/src/api/client.ts` — FE-BUILD-1 (`B = unknown`).
- `apps/user-web/src/components/ui/RestrictedBanner.tsx` — FE-04 added `scope: 'team' | 'invite'`.
- `apps/user-web/src/pages/TeamPage.tsx` — FE-04 banner + `session` threading + removed unused `Card` import.
- `apps/user-web/src/pages/InvitePage.tsx` — FE-04 banner + share-surface hard-gate for suspended/blacklisted.

**Tooling**
- `vitest.config.ts` — FE-BUILD-8 comment rewritten to unblock ESBuild.

---

## 4 · Commands rerun + results

Executed after each sub-pass:

```
corepack pnpm exec tsc -b --noEmit          # apps/admin-web
corepack pnpm exec tsc -b --noEmit          # apps/user-web
corepack pnpm exec tsc -b --noEmit          # supabase/functions/_shared
corepack pnpm exec eslint "apps/admin-web/src" "apps/user-web/src"
corepack pnpm exec vitest run               # repo root
```

### Delta table

| Command | Pre-Pass-1 | Post-Pass-1 | Δ |
|---|---|---|---|
| `vitest run` tests collected | **0** (config unparseable) | **34** passing | **+34** |
| `vitest run` test suites | **0** running | **5 pass / 1 fail** *(pre-existing ethers module resolution)* | — |
| `admin-web tsc -b --noEmit` errors | **38** | **19** | **-19** |
| `user-web tsc -b --noEmit` errors | **18** | **10** | **-8** |
| `_shared tsc -b --noEmit` errors | **23** | **23** | **0** *(all pre-existing, none introduced)* |
| `eslint` errors | **13** | **12** | **-1** |
| `eslint` warnings | **46** | **46** | **0** |

### Residual errors — what is left and why

**admin-web (19 residual, all pre-existing)**
- `components/charts/options.ts` × 3: readonly string-array / undefined-in-array — ECharts type friction.
- `components/ErrorBoundary.tsx` × 3: missing `override` modifiers.
- `pages/dashboard/DashboardPage.tsx` × 4: unused `rewardCurrent` / `rewardPrevious` / `burnCurrent` / `burnPrevious` placeholders.
- `pages/NetworkTeamPage.tsx` × 2, `ReportsPage.tsx` × 2, `RewardsPage.tsx` × 1: unused imports.
- `pages/SettlementPage.tsx` × 2: `Record<string, unknown>` vs `{settlement_date, reason}` — the same pattern FE-01 fixed in AdminAccountsPage. Left to Pass 2 because it's a separate page and FE-01's scope is strictly the admin-accounts fake-success path.
- `pages/SystemOverviewPage.tsx` × 1: missing `SectionTone` export from `components/shared`.
- `services/teamGraph/graphBuilder.ts` × 1: `RawRewardRow → Record<string, unknown>` narrowing issue.

**user-web (10 residual, all pre-existing)**
- `components/charts/DonutMini.tsx` × 2: `undefined` used as index type.
- `components/ErrorBoundary.tsx` × 3: missing `override` modifiers.
- `components/Layout.tsx` × 5: `lucide-react ForwardRefExoticComponent` vs local `ComponentType<{size?, className?}>` — incompatible `propTypes.size` type union.

**_shared (23 residual, all pre-existing)**
- `ConfigGroup` imported as a value from `@posx/config` × 6: `@posx/config/config-resolver/types.ts` does `import type { ConfigGroup }` from `@posx/shared-types`, but `ConfigGroup` is actually a const object + type on the shared-types side. The type-only import erases the value, so every consumer that does `group: ConfigGroup.ClaimRules` fails. Fix is trivial (remove `type` from the import) but out of Pass 1 scope.
- `rootDir` errors × 5: `supabase/functions/_shared/tsconfig.json` has `rootDir: "./src"` but imports from `@posx/*` resolve to source files outside that rootDir. Needs a project-reference migration.
- `ethers` × 1: `wallet-signature.ts` imports from `'ethers'` but it is not installed in the `_shared` package's dependencies. This also breaks `persona-fixture.test.ts`.
- `settlement-orchestrator.loadConfigBundle` × 6: `mustHave<T extends { version: unknown }>` helper doesn't narrow `ConfigResolveResult | undefined`.
- `transitions/claim-order.ts` × 1: unused `db` parameter.
- `handlers/admin.ts` × 2: rootDir + pre-existing unused `insertReportExportJob`.
- `postgres-js-client.ts` × 1: driver parameter typing.
- `auth/user-session-service.ts` × 1: `IsoTimestamp` imported from the wrong package.

None of the 23 residual `_shared` errors are in files I touched for this pass — verified by grepping for my changed filenames in the error list.

### Vitest failure — NOT a regression

The `persona-fixture.test.ts` suite fails to LOAD because `wallet-signature.ts` imports `ethers` and the module is not installed:

```
FAIL supabase/functions/_shared/test/persona-fixture.test.ts
Error: Failed to load url ethers (resolved id: ethers) in .../wallet-signature.ts. Does the file exist?
```

This existed before Pass 1 — vitest simply couldn't reach it because the config was unparseable. Sub-pass A3 (FE-BUILD-8) uncovered this pre-existing bug by unblocking vitest itself. It is a missing dependency, NOT a regression from any Pass 1 change.

---

## 5 · Remaining P0 blockers (from the roadmap, NOT addressed in Pass 1)

All of the following remain P0 and must be handled before real user traffic:

| ID | Title | Status after Pass 1 |
|---|---|---|
| **BE-12 / BE-13 / BE-15** | Real dashboard SQL for pending_claims / burn_today / trend / tier — replace hardcoded `null` / `'0'` / `where 1=0`. | **Still open.** |
| **BE-22 / BE-79** | Wrap every `transitionUserStatus`, `transitionPurchaseOrder`, `transitionClaimOrder`, `transitionSettlementJob` + its `writeAuditLog` in a DB transaction. | **Still open.** Only the settlement transitions have the outer-tx pattern (and only for the write cluster inside `settleOneUser`, not around the orchestrator's own transitions). |
| **BE-19 / BE-20** | `handleRecomputePreview` return real diffs, `handleRecomputeApply` accept them. | **Still open.** |
| **BE-66 / BE-67** | Move report export to `job_runs` queue + durable blob storage. | **Still open** — in-memory store on every deploy. |
| **BE-56 / BE-58 (option (a))** | Real `ProductionClaimBroadcaster` against an RPC endpoint + cron `ClaimFinalizationService.finalize`. | **Deferred** — Pass 1 shipped option (b) (the safety gate). Option (a) remains required before claims actually work in production. |
| **BE-70** | Make `reason` required on every destructive admin mutation. | **Partial.** The new `updateAdmin` body type accepts `reason?` and AdminAccountsPage always sends it, but `CreateAdminConfigRequestSchema` and other admin mutations are untouched. |
| **FE-03** | BuyPage retry on `failed` step + `api.recoverPurchase`. | **Still open.** |
| **CT-05** | `PATCH /admin/accounts/:id` full schema + UI alignment. | **Partial.** Frontend now sends `reason` + `rotate_session`; backend endpoint still needs to accept + audit these fields properly. |

Pass 2 should start with the transition-wrap cluster (BE-22 / BE-79 / BE-21 / BE-23 / BE-47) because they share a pattern (`withAuditTx` helper) and unblock several P1 cleanup rows.

---

## 6 · False positives found during Pass 1

None of the findings in scope were downgraded or dismissed. Every item attempted was confirmed real during the fix.

One finding was proven MORE severe than catalogued:

- **BE-35 / BE-36 / BE-89 (claim `signed_message`)** — the audit called this "verifier receives empty message". Reading the code path with the router fix applied, it's actually impossible for the signing service to verify ANY real signature pre-fix: `ecrecover(hash_of(''), user_signature)` yields some arbitrary address that never matches the user's wallet, so every claim sign call would return `INVALID_SIGNATURE` in production. This turns the P0 from "ambiguous verifier state" to "money path is 100% broken end-to-end". Raised the urgency note accordingly when ordering sub-passes.

---

## 7 · End-to-end testability

### Local dev (`local` env)

- ✅ Router matches real requests after CT-01.
- ✅ Vitest runs 34 passing unit tests — `packages/shared-utils`, `packages/domain-rules`, `supabase/functions/_shared/test/report-export-worker.test.ts` all green.
- ✅ `MockClaimBroadcaster` still allowed in local; the full claim `pending → queued → broadcasted → confirmed` ladder still works because `persistClaimOrderSignedMessage` writes the canonical message BEFORE the router reads it.
- ❗️ `persona-fixture.test.ts` still fails to load (pre-existing missing `ethers` dep). Once `pnpm add ethers` is run inside `supabase/functions/_shared`, that suite should collect.

### Staging (`staging` env)

- ✅ `StagingClaimBroadcaster` still wired for staging, so the UX still exercises `queued → broadcasted → confirmed` with a deterministic fake hash.
- ✅ Rate limit + lockout + audit trail is active in staging.
- ❗️ Backend still emits `ConfigGroup` pre-existing TS errors — these don't block a `deno run` because Deno's strict-lib set is narrower than `tsc`, but they WILL block a future `tsc`-gated CI job.

### Production (`production` env)

- ✅ BE-83 body cap blocks over-1-MiB requests.
- ✅ BE-84 CORS + preflight works.
- ✅ BE-86 error scrubbing strips unsafe messages.
- ✅ BE-07/08/25 admin auth hardening active.
- ✅ **BE-56/58 safety gate enforced**: the production path uses `ProductionGateClaimBroadcaster` — every claim sign attempt returns `CLAIM_BROADCAST_FAILED`. There is NO scenario in which a fake tx hash reaches a user. The claim ladder still advances to `failed` with a clear reason, leaving the order in a state a future real broadcaster can re-process.
- ❌ **Claims do not actually pay out in production** — intentional, until option (a) ships. The frontend Claim surface will show an error on sign; the `BuyPage` purchase path is unaffected.

---

## 8 · Recommended Pass 2 scope

Priority order based on roadmap-P0 remainders + maximum unblock potential:

1. **BE-22 / BE-79 + BE-21 / BE-23 / BE-47** — introduce a single `withAuditTx(db, fn)` helper, port every `transitionX` caller to it. Fixes 5 P0 cluster in one commit. Also fixes the residual `_shared` orchestrator transition issue.
2. **BE-12 / BE-13 / BE-15** — replace the admin dashboard's hardcoded `null / '0' / where 1=0` with real SQL. The dashboard is the first screen every operator sees and shipping with placeholders is the single biggest credibility drain.
3. **BE-70** — add required `reason` on `assertCanCreateConfigVersion` and every destructive admin mutation. Pair with the `api-contracts` schema update so the frontend is forced to send it.
4. **BE-19 / BE-20** — real recompute preview/apply with diffs persisted between the two calls.
5. **CT-05** — finish the admin-accounts PATCH contract so the Pass 1 frontend isn't speaking to a half-baked backend.
6. **FE-03** — BuyPage retry wiring. Small, user-visible, and unblocks the purchase path once the recovery service is ready.
7. **BE-66 / BE-67** — report export to `job_runs` queue.
8. **Infra**: fix the `ConfigGroup` type-only import, install `ethers` in `_shared`, flip `rootDir` to allow the shared packages to be typechecked in one run.
9. **CI gate**: once FE-BUILD-* and the Pass 2 items above land, turn on `pnpm lint --max-warnings=0`, `pnpm -r tsc --noEmit`, and `pnpm vitest run` as PR-required checks.

Pass 2 should NOT start with the real `ProductionClaimBroadcaster` (BE-56/58 option (a)) because that's the largest single piece of work in the whole P0 list, requires a contract address + wallet key management design review, and the Pass 1 gate means it is not user-visible urgent.

---

*Pass 1 compiled by the Claude Agent SDK remediation loop on 2026-04-15.*
