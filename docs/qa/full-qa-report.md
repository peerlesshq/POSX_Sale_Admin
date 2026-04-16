# POSX Token Sale — Full QA Audit Report

**Audit date**: 2026-04-15
**Scope**: admin-web, user-web, `supabase/functions/api` edge function + `_shared/src` backend core, `packages/api-contracts`, `packages/shared-*`, `packages/domain-rules`, `packages/config`.
**Methodology**: static analysis, TypeScript build, lint, vitest, manual read of 70+ source files, three parallel sub-agent deep audits (backend, frontend, contract).
**Evidence discipline**: every finding below has a file path, line range, and direct quote.

---

## Executive summary

The product **is not ready to ship**. A single root-cause defect (**CT-01**, router path prefix mismatch) means that **every frontend → backend HTTP request currently returns 404 `NOT_FOUND`** in any environment where the frontend points at a real Supabase edge-function base URL. The app has been running on mock data; the real backend has never been reachable from the real frontend through a real URL.

Beneath CT-01 sit three other release-blocker classes:

1. **Claim signing is broken by construction** (BE-35 / BE-36 / BE-89). The signed message is generated inside `ClaimPreparationService.prepare` with a fresh nonce, returned to the client, and never persisted. The sign handler reads `claim_orders.signed_message` from the DB — which is NULL until *after* signing. Every first sign attempt verifies against an empty string. Either all claim signing fails, or the verifier accepts empty-message signatures and claims can be forged.
2. **Settlement has no idempotency, no concurrency lock, no per-user transaction, and no real broadcaster** (BE-49 / BE-51 / BE-52 / BE-56 / BE-58). Re-running settlement for the same date double-writes every reward. There is no real on-chain payout adapter. Broadcasted claims never finalize because no cron calls `ClaimFinalizationService.finalize`.
3. **Multiple handlers ship hardcoded stub responses** (BE-12, BE-13, BE-15, BE-19, BE-20, BE-31, BE-32, BE-39, BE-40, BE-42). Dashboard trend is `[]`, tier distribution queries `users where 1=0`, user profile's `current_tier / reward_qualified / team_reward_qualified / direct_rate / team_rate` are all literal `null/false`, invite link is `https://posx.example/`, recompute apply accepts empty diffs and writes nothing but audit-logs as a success. Operators and users will trust data that is literally a placeholder.

The admin panel UI surfaces look good at first glance — the visible pages have been refactored through multiple phases — but several pages carry **runtime-dangerous** bugs that the pretty UI hides: `AdminAccountsPage.updateMutation` fakes success on every destructive admin action (FE-01); `BuyPage` purchase flow has no recovery path from `failed` (FE-03); `TeamPage` / `InvitePage` never render the `RestrictedBanner` so suspended / blacklisted users have full UI access (FE-04); the Rewards overview Sankey chart invents claim/burn ratios (FE-05).

The full build pipeline fails: `pnpm lint` produces **13 errors + 46 warnings**, `pnpm test` can't even load `vitest.config.ts` (ESBuild misparses `/**/*.test.ts` inside a JSDoc comment as a premature close-comment marker), and `pnpm build` fails on `tsc -b --noEmit` in both apps — **56 TypeScript errors** across admin-web and user-web. The only reason the dev servers run is Vite skipping the type check.

---

## Release-readiness scorecard

| Dimension | Score (0-10) | Rationale |
|---|---|---|
| **Overall release readiness** | **2 / 10** | Single-line router path bug blocks every real backend call; claim signing broken; settlement non-idempotent; no real on-chain broadcaster; test suite cannot run at all. |
| **UI / UX** | **6.5 / 10** | Admin panel has a strong design system and recent rebuilds. Several high-visibility bugs (FE-01 fake success, FE-04 missing restricted banners, FE-17 dashboard time-range does nothing) drag the score. User-web has charts + QR + trust cues but still carries S0 UX gaps. |
| **Frontend code quality** | **4.5 / 10** | Builds succeed only with `tsc -b` bypassed. 13 lint errors, 46 warnings. 56 TS errors. Mock/page schema drift hides real bugs. Multiple inline-style-heavy pages. |
| **Backend reliability** | **2 / 10** | 24 S0, 53 S1 findings. Money path (claim signing, settlement) broken by construction. Zero rate limiting, zero admin-login audit, zero password lockout. Transactions missing around audit + state updates. |
| **API contract health** | **1 / 10** | Router patterns mismatch Supabase pathnames (every request → 404). On top of that, 12+ frontend fields the backend never returns (or stubs to null/0), 6+ backend fields the frontend ignores, pagination `count(*)` queries ignore WHERE filters. |

---

## Severity summary

| Severity | Backend | Frontend | Contract | **Total** |
|---|---|---|---|---|
| **S0 — release blocker / auth or money risk** | 24 | 5 | 2 | **31** |
| **S1 — major user-facing or admin bug** | 53 | 7 | 12 | **72** |
| **S2 — important but non-blocking** | 17 | 16 | 14 | **47** |
| **S3 — nit / cleanup** | 0 | 7 | 2 | **9** |
| **Total** | **94** | **35** | **30** | **159** |

See `frontend-code-audit.md`, `backend-code-audit.md`, `api-contract-audit.md`, `ui-ux-audit.md` for the full finding list per category.

---

## Top 10 highest-leverage problems

Ranked by worst-case blast radius × evidence strength.

1. **CT-01 · S0 · Router path prefix mismatch** — `supabase/functions/api/router.ts` patterns start with `/api/v1/...`, but the Supabase edge runtime delivers `url.pathname` as `/functions/v1/api/v1/...`. Every real frontend → backend call returns 404. **Single-line fix** in `serve.ts:64` (strip prefix) OR update all router patterns. Until fixed, 158 of the other 159 findings are latent.
2. **BE-35 / BE-36 / BE-89 · S0 · Claim signing empty-message** — `ClaimPreparationService.prepare` creates `messageToSign` with a fresh nonce and returns it without persisting. `handleSignClaimOrder` reads `claim_orders.signed_message` which is NULL on first sign. Every claim sign verifies against `''`. **The single most dangerous defect** — either all claims fail or signatures can be forged.
3. **BE-49 / BE-51 / BE-52 · S0 · Settlement has no idempotency / lock / transaction** — `SettlementOrchestrator.run` has no idempotency key, no advisory lock, no per-user transaction. A double-trigger (two cron runners, or operator double-click) creates two complete sets of `team_rewards_daily` snapshots, doubling every user's claimable amount.
4. **BE-56 / BE-58 · S0 · Production claim broadcaster is a SHA-256 stub, finalization cron missing** — `staging-broadcaster.ts` returns `0x${sha256(orderId + wallet + amount)}` as the tx hash. `pickBroadcaster` says "staging + production both use the staging broadcaster until a real adapter lands." Finalization service exists but no cron calls it. **No real on-chain payout exists in the codebase.**
5. **FE-01 · S0 · AdminAccountsPage fakes success on every destructive action** — `updateMutation.mutationFn` does `(api as unknown as Record)['updateAdmin']` runtime introspection. If the method isn't found, falls through to `await setTimeout(120); return {ok: true, local: true}` and fires the green toast. Disable, re-enable, role change, session rotation — all can silently no-op while showing "Disabled successfully".
6. **BE-07 / BE-08 / BE-25 · S0 · Zero rate limiting, zero lockout, zero admin-login audit** — No rate limit code anywhere in `_shared/src/auth/*` or `router.ts`. No failed-login counter, no backoff. `handleAdminLogin` and `handleAdminLogout` never call `writeAuditLog`. Credential stuffing is fully unmitigated and completely silent.
7. **BE-12 / BE-13 / BE-15 · S0 · Admin dashboard + user list ship placeholder data as truth** — `handleAdminDashboard` hardcodes `trend: []` and queries `tier_distribution from (select null::text ... where 1=0)`. `handleGetAdminUserDetail` returns `team_total_performance: '0'`, `reward_qualified: false`, `team_reward_qualified: false`. Operators see placeholder values dressed as real data.
8. **BE-66 / BE-67 · S0 · Report export generated synchronously in memory** — `ReportExportWorkerService.createAndRun` runs `limit 10000` SQL and stringifies CSV inside the request thread. Exports are held in `InMemoryBlobStore` — wiped on any restart, broken on multi-replica.
9. **BE-83 / BE-84 · S0 · Router has no body size limit and no CORS headers** — `serve.ts:42` does `await request.text()` with no size cap. Any POST can buffer 1GB. No `Access-Control-Allow-Origin`, no OPTIONS preflight. Browser cross-origin requests will be rejected at launch time.
10. **FE-04 · S0 · Restricted users have full access on TeamPage and InvitePage** — Neither file imports `RestrictedBanner` or reads `session.userStatus`. A `blacklisted` or `suspended` user can see team data and copy/share invite links. The whole purpose of the Phase-0 `RestrictedBanner` was to close this gap — it's back.

---

## "Fix first" — P0 sequence

These must all land before any real user traffic. Fix in this order because each unblocks the next:

1. **CT-01 — Router path prefix** (1-line fix in `serve.ts:64`). Without this, you cannot verify any other backend fix end-to-end.
2. **BE-35 / BE-36 — Persist `messageToSign` on claim order creation**. Add `signed_message` column write inside `ClaimPreparationService.prepare`, remove the router's re-derivation branch.
3. **BE-49 / BE-51 / BE-52 — Settlement idempotency + transaction + lock**. Wrap `settleOneUser` in a transaction; add `select ... for update` / `pg_try_advisory_lock` on `SettlementOrchestrator.run`; add an idempotency check for existing completed job for `{settlement_date, mode}`.
4. **BE-07 / BE-08 / BE-25 — Rate limit + lockout + admin auth audit**. Add a simple in-memory or Redis-based limiter on `/admin/auth/login` + `/auth/nonce` + `/auth/verify`. Write `writeAuditLog` for admin login success, admin login failure, admin logout.
5. **BE-12 / BE-13 / BE-15 / BE-31 / BE-32 / BE-39 / BE-40 — Replace placeholder handler returns with real data**. Dashboard trend, tier distribution, user tier, reward qualification, team overview fields, team members level filter.
6. **FE-01 — Remove AdminAccountsPage fake-success fallback**. Delete the runtime introspection branch; require the method to exist; surface failure via `InlineError`.
7. **BE-83 / BE-84 / BE-86 — Body size limit + CORS headers + error message scrubbing**. 1MB body cap, `Access-Control-*` headers, strip Postgres error messages.
8. **FE-04 — Add `RestrictedBanner` + session-status gating to TeamPage + InvitePage**. Already-built primitive.
9. **BE-56 / BE-58 — Real broadcaster OR gate the claim flow** behind a feature flag until real adapter exists. Either build `ProductionClaimBroadcaster` against the chain RPC and wire it into `pickBroadcaster`, or refuse to serve the claim endpoints in production.
10. **BE-79 / BE-22 — Audit log write must be transactional with its business action**. Wrap `transitionUserStatus` in a DB transaction; same for `transitionPurchaseOrder`, `transitionClaimOrder`, `transitionSettlementJob`.

---

## Do-not-ship-before-fixing list

Everything in the P0 sequence above is non-negotiable, **plus**:

- Fix `vitest.config.ts` JSDoc that ESBuild misparses (1-line fix — move `**/*.test.ts` out of a `/** */` block or escape). Test suite must run.
- Fix 13 ESLint errors (unused imports, unused vars) so `pnpm lint` passes.
- Fix 56 TypeScript errors so `pnpm build` passes without bypassing `tsc -b`. Most are from the `apiRequest<T, B = undefined>` default that defeats body type inference.
- Remove hardcoded dev credentials from `env.ts` LOCAL_FALLBACK_CREDENTIALS or gate them behind an explicit `NODE_ENV === 'development'` check before letting any non-dev build reach the CI pipeline.
- BE-42 — Change invite link derivation from last-8-hex-char of wallet (birthday-collision past 100k users) to a real `referral_code` column.
- BE-19 — Recompute apply must either refuse empty diffs or actually accept them from the previous preview.
- BE-66 — Report export must run outside the request thread (enqueue to job_runs + serve results from persistent storage).

---

## Out of scope for this pass

- Migrations / SQL schemas — flagged as evidence-missing. Several findings (BE-02, BE-04, BE-74) depend on whether migration files declare indexes / unique constraints / FK behavior that this audit did not read.
- Real e2e testing — blocked by CT-01 plus the inability to stand up a real Supabase stack in this environment.
- Performance profiling — flagged as an "attack-at-scale" concern but not directly measured.
- Accessibility tree walk — audited statically via grep for `aria-*` hits, but no screen-reader testing.
- Security penetration testing — outside the audit scope; findings here are code review only.

---

## Scores rationale in one sentence each

- **UI/UX 6.5/10** — admin panel looks like a real fintech ops console and user-web has charts + QR + trust cues, but six S0-class visible bugs make several pages actively mislead operators and users.
- **Frontend 4.5/10** — builds green on Vite alone, fails hard on `tsc -b`, and both apps have silent contract drift with their mocks that hides S0-class bugs.
- **Backend 2/10** — money path (claim signing, settlement) broken by construction, zero rate limiting, extensive stub responses advertised as truth, no real on-chain payout adapter.
- **API contract 1/10** — fundamental router path mismatch means the contract has never actually been exercised at runtime against a real backend, and 40+ shape mismatches are latent waiting for CT-01 to be fixed.
- **Overall 2/10** — cannot ship. The combination of "backend unreachable from the real frontend" + "claim signing broken" + "settlement non-idempotent" + "no real broadcaster" is a full-stack block.
