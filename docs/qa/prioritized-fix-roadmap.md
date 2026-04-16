# Prioritized Fix Roadmap

Rank order for addressing the 159 findings. Every P0 item is mandatory before any real user traffic. P1 items are mandatory before declaring the product "stable."

Effort buckets:
- **S** — single-session, 1-3 hours
- **M** — ~1 day
- **L** — 2-4 days
- **XL** — > 1 week (design / architecture work)

---

## P0 — must fix before any real traffic

| # | ID | Area | Title | Effort | Unblocks | Notes |
|---|---|---|---|---|---|---|
| 1 | CT-01 | Contract | Strip `/functions/v1/api` prefix in `serve.ts:64` before matching | **S** | everything | One-line fix. Until this lands, nothing else in this roadmap can be verified end-to-end. |
| 2 | BE-35 / BE-36 / BE-89 | Backend money | Persist `signed_message` on `claim_orders` at order creation; remove router's re-derive branch | **M** | claim flow | `ClaimPreparationService.prepare` already builds the message — add a write inside the existing transaction; remove router branch at `router.ts:346-369`. |
| 3 | BE-49 / BE-51 / BE-52 | Backend money | Wrap `settleOneUser` in a transaction; add `pg_try_advisory_lock` on `SettlementOrchestrator.run`; reject duplicate `(settlement_date, mode)` via check in `settlement_jobs` | **M** | settlement safety | Without this, a double-click is a double-payout. |
| 4 | BE-83 / BE-84 / BE-86 | Backend infra | Body size cap in `serve.ts`; CORS headers + OPTIONS handling; strip raw Postgres error messages | **S** | launch safety | 3 separate small fixes — body cap ~10 lines, CORS ~15, error scrubbing ~20. |
| 5 | BE-07 / BE-08 / BE-25 | Backend auth | In-memory IP+user rate limiter on `/admin/auth/login`, `/auth/nonce`, `/auth/verify`; failed-login counter on admin_users; audit login/logout success + failure | **M** | admin auth | Lockout + audit can both use `writeAuditLog` + a new `admin_failed_logins` table. |
| 6 | FE-01 | Frontend | Remove AdminAccountsPage runtime-introspection fallback; require `api.updateAdmin` to exist; surface failures via `InlineError` | **S** | admin UX | Delete lines 135-145 of AdminAccountsPage.tsx; the real method exists. |
| 7 | BE-56 / BE-58 | Backend money | Either (a) wire a real `ProductionClaimBroadcaster` against an RPC endpoint + cron-scheduled `ClaimFinalizationService.finalize`, OR (b) return `503` on claim endpoints in production until the real adapter is ready | **XL** (a) / **S** (b) | money path | Option (b) is a safety gate; option (a) is the real fix. Ship (b) now, plan (a). |
| 8 | BE-22 / BE-79 | Backend audit | Wrap `transitionUserStatus` + `writeAuditLog` in a DB transaction; same pattern for `transitionPurchaseOrder`, `transitionClaimOrder`, `transitionSettlementJob` | **M** | compliance | Helper: `withAuditTx(db, async (tx) => { ... })`. |
| 9 | FE-04 | Frontend UX | Add `<RestrictedBanner scope="team" />` to TeamPage and `<RestrictedBanner scope="invite" />` to InvitePage; thread `session.userStatus` from `LayoutContext` | **S** | permission UX | The primitive exists; just needs imports. |
| 10 | BE-12 / BE-13 / BE-15 / BE-31 / BE-32 / BE-39 / BE-40 / BE-42 | Backend correctness | Replace all "hardcoded `null` / `'0'` / `where 1=0` / empty array" stubs with real SQL. Or at least return a `placeholder: true` flag so the frontend can show "integration required" badges | **L** | dashboard / team / profile | Multiple handlers, all small individually. |
| 11 | BE-66 / BE-67 | Backend infra | Move report export to `job_runs` queue; persist blobs to real storage (S3/GCS/Supabase Storage) or at minimum the `job_runs` table as bytea | **L** | export feature | In-memory store is broken on every deploy. |
| 12 | FE-BUILD-1 / FE-BUILD-8 / FE-BUILD-9 | Build | Change `apiRequest<T, B = undefined>` → `apiRequest<T, B = unknown>` OR `apiRequest<T, B = Record<string, unknown>>`; fix `vitest.config.ts` JSDoc comment; fix 13 lint errors | **S** | CI gate | Two one-line fixes + a bulk lint cleanup. |
| 13 | BE-19 / BE-20 | Backend money | `handleRecomputePreview` must return real diffs; `handleRecomputeApply` must accept diffs from the previous preview (via session-stored preview or explicit body param) | **L** | money recompute | Requires schema + handler + service changes. |
| 14 | BE-70 | Backend audit | Make `reason` required on every `assertCanCreateConfigVersion` / every destructive admin mutation | **S** | compliance | One-line per guard. |
| 15 | FE-03 | Frontend UX | BuyPage add Retry button on `failed` step; wire `api.recoverPurchase` from the UI | **S** | user purchase flow | Component only. |

---

## P1 — must fix before "stable"

### P1 — backend correctness & perf

| ID | Title | Effort |
|---|---|---|
| BE-14 | UsersListPage pagination count ignores filters | S |
| BE-16 | handleGetAdminUserDetail 9 correlated subqueries → LEFT JOIN | M |
| BE-17 | Role enforcement on read handlers (viewer can't see everything) | M |
| BE-18 | Audit log read handlers when they touch PII | S |
| BE-21 | TOCTOU transaction wrap on handleUpdateUserStatus | S |
| BE-23 / BE-47 | Transitions must take a `tx` not `db` | M |
| BE-27 | Self-protect on admin role/status changes (can't demote last super_admin) | M |
| BE-28 | Max depth cap on handleGetAdminUserTree | S |
| BE-29 | Role gate on handleListAdminLogs | S |
| BE-34 / BE-33 / BE-43 | Fetch-all-then-slice anti-pattern on vesting/purchases/profile | M |
| BE-37 | L1 referral deposits should aggregate not leak | M |
| BE-53 / BE-54 / BE-55 | Job runner error handling + retry + backoff | M |
| BE-57 | Claim broadcaster `seen` set persisted | M |
| BE-59 | `lockTeamRewardToClaimOrder` must row-lock or verify lock | M |
| BE-60 | `PurchaseOrderService.attachTx` transaction | S |
| BE-61 | Recovery needs on-chain attribution check | L |
| BE-62 | String-money compare via `isPositive()` | S |
| BE-63 / BE-64 | Chain event processor batch abort + payload validation | M |
| BE-72 / BE-73 | Add hard upper bounds on `list*ByWallet` repos | S |
| BE-74 / BE-75 | Team reward row-lock / `claim_order_id` verification | M |
| BE-80 | Logger PII scrubber | S |
| BE-82 | Correlate `request_id` across logs and audit rows | M |
| BE-88 | Burn-status router branch — move to handler, use cached resolver | M |
| BE-90 | URL param validation at router | S |
| BE-91 | Dedupe `inferErrorStatus` / `AppError.defaultStatus` | S |
| BE-92 | Log unmatched routes | S |
| BE-94 | HandlerContext services should be singletons for caching | M |

### P1 — contract mismatches

| ID | Title | Effort |
|---|---|---|
| CT-02 / CT-03 / CT-04 | Real dashboard SQL for pending_claims / burn_today / trend / tier | M |
| CT-05 | `PATCH /admin/accounts/:id` schema + UI alignment for rotate + reason | M |
| CT-06 | Recompute apply accepts diffs from preview | L |
| CT-07 | Burn-status field name alignment | S |
| CT-08 / CT-09 | Team daily/overview field rename or fallback | S |
| CT-13 / CT-16 | UsersPage tier column + count-with-filter fix | M |
| CT-21 | Claim sign flow (covered by BE-35) | — |
| CT-30 | Export download via blob fetch | M |

### P1 — frontend correctness / UX

| ID | Title | Effort |
|---|---|---|
| FE-06 / FE-07 | JobsPage + LogsPage filters in queryKey | S |
| FE-08 | UsersListPage real server pagination | M |
| FE-09 | `RiskActionModal.loading` prop passed everywhere | S |
| FE-10 | ConfigPage single success toast | S |
| FE-11 | Wire `useClaimAll.reset` on failure | S |
| FE-12 | BuyPage chain config from `/config/public` | M |
| FE-20 | BurnView field name alignment | S |
| FE-22 | RiskActionModal disable Cancel while saving | S |
| FE-23 | `apiBaseUrl` fail-fast in production | S |
| FE-24 | Session expiry redirects to landing | M |

---

## P2 — important but non-blocking

### Code quality / maintainability

- **FE-13** — extract chain-lag + pending-claims thresholds into constants module
- **FE-14** — replace 10 CSS hex colors with CSS vars
- **FE-15** — replace 2 inline style hex / rgb with tokens
- **FE-16** — memoize trendRows → series slices
- **FE-17** — wire dashboard `TimeRangeField` to query
- **FE-18** — real tree virtualisation (react-window / virtuoso) on NetworkTeamPage
- **FE-19** — reduce inline-style surface to < 10 per file
- **FE-21** — remove double cast in LoginPage
- **FE-25** — silent catches add telemetry / console.warn
- **FE-26** — drop JSON.stringify from queryKey

### Backend polish

- **BE-05 / BE-06 / BE-09** — session rotation, peppering, async bcrypt
- **BE-26** — force password change on first login
- **BE-46** — bigint-safe count parsing
- **BE-48** — finalization broadcaster check inside transaction
- **BE-55** — retry / backoff in jobs (duplicated as P1 above for safety)
- **BE-65** — recompute transaction wrap
- **BE-68** — config resolver cache TTL + invalidation
- **BE-69** — batched getHoldingsAtTime
- **BE-71** — user access policy 401 vs 404
- **BE-81** — rejection-sampling request-id generator
- **BE-87** — route table indexed by method

### Documentation / CI

- Fix `vitest.config.ts` + restore 6 unit tests (FE-BUILD-8)
- Add CI gate for `pnpm lint` (FE-BUILD-9)
- Add CI gate for `pnpm build` once FE-BUILD-1 is fixed
- Add contract tests: for each endpoint, `handleApiRequest(new Request(...))` against an in-memory DB fixture
- Document the `/functions/v1/api/v1` prefix handling (CT-01) in `docs/RUNBOOK.md`

---

## Execution order

### Week 1 — emergency triage (P0 items 1-9)

1. **Day 1 AM**: CT-01 one-line fix + redeploy. Verify one end-to-end request works.
2. **Day 1 PM**: FE-BUILD-1 (change `B = undefined` default), FE-BUILD-8 (vitest config comment), FE-BUILD-9 (fix 13 lint errors). Green `pnpm lint` + `pnpm build` + `pnpm test`.
3. **Day 2**: BE-83 + BE-84 + BE-86 (body cap + CORS + error scrubbing). BE-07 + BE-08 + BE-25 (rate limit + lockout + audit).
4. **Day 3**: BE-35 / BE-36 / BE-89 (claim signed_message persistence). Unblock the claim flow.
5. **Day 4**: BE-49 / BE-51 / BE-52 (settlement transaction + lock + idempotency). Unblock settlement.
6. **Day 5**: FE-01 (remove AdminAccountsPage fake success), FE-04 (RestrictedBanner on TeamPage + InvitePage), FE-03 (BuyPage retry).

### Week 2 — backend stub replacement (P0 items 10-14)

1. **Day 6**: BE-12 / BE-13 / BE-15 — real dashboard SQL + user detail fields.
2. **Day 7**: BE-31 / BE-32 / BE-39 — user profile + team overview real computations.
3. **Day 8**: BE-40 — team members level filter. BE-42 — real referral_code table (migration).
4. **Day 9**: BE-22 / BE-79 — transactional audit wrap for all transitions.
5. **Day 10**: BE-19 / BE-20 — real recompute preview/apply flow (may slide into week 3).

### Week 3 — broadcaster + finalization

1. **Day 11-13**: Real on-chain claim broadcaster adapter (BE-56). Feature-flag gate until tests pass.
2. **Day 14**: `ClaimFinalizationService.finalize` cron wired into job runner (BE-58).
3. **Day 15**: BE-66 / BE-67 — report export to job queue + durable blob storage.

### Week 4 — P1 cleanup + contract alignment

Everything from the P1 lists above, parallelizable across 2-3 engineers.

### Beyond week 4 — P2 polish

Code quality, testing, documentation, perf.

---

## Quick wins vs structural fixes

### Quick wins (< 1 hour each)

- CT-01 (single line)
- BE-83 (body size cap — ~10 lines)
- FE-01 (delete 10 lines in AdminAccountsPage)
- FE-04 (add `<RestrictedBanner>` to two files — ~10 lines each)
- FE-17 (wire `range` to queryKey in Dashboard)
- FE-BUILD-1 (one-line default change)
- FE-BUILD-8 (move one comment line out of JSDoc)
- FE-23 (fail-fast in prod on missing env var)
- BE-92 (add `logger.warn` on unmatched route)

**Together**: ~3 hours of work, closes 9 findings.

### Structural fixes (multi-day)

- Transactions around transitions + audit writes
- Settlement orchestrator per-user tx + advisory lock
- Real claim broadcaster
- Report export job queue
- Contract-shape alignment across 15+ endpoints
- Role enforcement on read handlers

---

## Owner suggestions

- **Backend core** (money, auth, jobs): 1 senior backend engineer
- **Backend handlers** (stub replacement, contract shapes): 1 backend engineer
- **Frontend correctness** (FE-01 through FE-12): 1 senior frontend engineer
- **Infra / deploy** (CORS, rate limit, body caps, CI gates): shared between backend + devops
- **Test harness** (vitest config, first contract tests): shared

---

## Risk register

- **Cannot verify fixes without staging**: CT-01 + settlement fixes + claim flow fixes all need a real Supabase + Postgres stack. Local `deno serve` is acceptable for per-handler tests; full e2e requires staging.
- **No test gate**: Until FE-BUILD-8 is fixed, every PR lands without test verification. This is the single highest regression risk during the remediation itself.
- **Single-point-of-failure files**: `router.ts`, `handlers/admin.ts`, `settlement-orchestrator.ts`, `claim-signing-service.ts` all need simultaneous work — plan for serialised commits and a strict merge queue.
