# UI / UX Audit

**Scope**: `apps/admin-web` + `apps/user-web` surfaces. Audit is static (no live click-through of every page) because the backend cannot be reached from the frontend due to **CT-01** — so any "runtime UX audit" against real data is blocked until that is fixed. Everything below is backed by code evidence and prior phase-0 through phase-5 rebuild work.

---

## Executive summary

The admin panel visually looks like a real fintech operations console — dark-first tokens, Inter / JetBrains Mono typography, a coherent shared-primitive library (`SectionCard`, `KpiStatCard`, `KpiDeltaCard`, `DataTable`, `FilterBar` + field primitives, `RowActionMenu`, `ErrorCell`, `ThresholdCell`, `RoleBadge`, `JsonViewer` tree). Prior phases have rebuilt the Dashboard, HealthPage, ChainSyncPage, JobsPage, LogsPage, AdminAccountsPage, SystemOverviewPage on top of shared primitives, and introduced a notification center + sidebar collapse.

The user-web front end is also visibly recovered from its wireframe state — real chart primitives (AreaMini, DonutMini, BarMini), a landing hero, a trust footer, skeleton / inline-error primitives, QR code + social share on invite, a restricted banner primitive.

**But** four classes of UI/UX bug still make the product actively deceive operators and users:

1. **Destructive admin actions silently succeed** (FE-01). AdminAccountsPage's update flow has a runtime-introspection fallback that shows green toasts when the action didn't hit the backend.
2. **Time controls and "live" badges lie** (FE-17, FE-29). Dashboard time-range filter is purely decorative. "Live — auto refresh every 30s" tooltip is false.
3. **Restricted-status gating has regressed** (FE-04). `RestrictedBanner` primitive exists but is not rendered on TeamPage or InvitePage; suspended / blacklisted users get full UI.
4. **Fabricated data is shown as real** (FE-05). Rewards overview Sankey invents claim/burn percentages; user dashboard + BurnView fall through to zeros because mock/real shape mismatches.

And underlying all of this: **CT-01** means the real backend has never actually been reachable from the real frontend. Every runtime UX test has been against mocks. When the router path is fixed, many of the contract mismatches in `api-contract-audit.md` will become visible pages-full of "— / 0 / at risk / tier: null" across user-facing surfaces.

---

## Page-by-page audit

### Admin: LoginPage

**File**: `apps/admin-web/src/pages/LoginPage.tsx`

- **Dev credentials no longer in source** — Phase 5 refactored to read from env (`VITE_ADMIN_DEV_CREDENTIALS` + `VITE_ENABLE_ADMIN_DEV_LOGIN_LOCAL_FALLBACK`). OK.
- **Missing creds hint state** — present, localized. OK.
- **Two casts via `as unknown as` on the login result** (FE-21) — bypasses the type system.
- **Sign-in button**: does not disable mid-submit beyond AntD's default `loading={loading}`. AntD's default is adequate.
- **No password visibility toggle** (AntD `Input.Password` provides this). OK.
- **No "forgot password" link**. Not a defect today, worth noting for future.

**Verdict**: 7/10. Visually clean, functionally OK, two code smells.

### Admin: DashboardPage

**File**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx`

- **Time-range filter is decorative** (FE-17). `range` state set but never consumed. Operator believes they can slice the view; nothing happens.
- **"Live — auto refresh every 30s" tooltip is a lie** (FE-29). No `refetchInterval` anywhere on `useQueries`.
- **4 unused variables** `rewardCurrent`, `rewardPrevious`, `burnCurrent`, `burnPrevious` (FE-BUILD-4) — dead code.
- **Hardcoded `box-shadow: '0 0 0 3px rgba(16,185,129,0.2)'`** (FE-15) — bypasses token system.
- **KPI deltas** rely on `splitPeriods(trendRows)` — but backend returns `trend: []` always (BE-12 / CT-03). Until that's fixed, every delta is 0%. Visible: four KPI cards show "— / 0%" deltas.
- **Tier distribution chart** (`buildHBarOption`) — empty because backend queries `where 1=0` (BE-12 / CT-04). The chart renders its `empty` state perpetually.
- **Reward mix donut** — uses real 24h fields (`reward_24h.direct`, `.team`, `.equal_level`) which *are* in the backend response. Will render once CT-01 is fixed.
- **44 inline `style={{` occurrences** (FE-19). Token consistency depends on every inline style remembering the CSS vars.
- **`useMemo` dep arrays include `depositSeries`/`rewardSeries`/`burnSeries`** which are re-created on every render (FE-16). Memo never hits.

**Verdict**: 5/10. Looks great but three KPIs and the trend chart are functionally dead until backend stubs are filled.

### Admin: SystemOverviewPage

**File**: `apps/admin-web/src/pages/SystemOverviewPage.tsx`

- **TypeScript build error** — imports `SectionTone` which isn't exported from `components/shared` barrel (FE-BUILD-5).
- **27 inline styles** (FE-19).
- **Tone calculation duplicated with `SystemPage.tsx:94-95`** (FE-13) — chain lag 5/20 thresholds in two places.

**Verdict**: 6/10. Good composition, will compile-fail once `SectionTone` is properly exported.

### Admin: SystemPage (ChainSync / Jobs / Health / Logs)

**File**: `apps/admin-web/src/pages/SystemPage.tsx`

- **48 inline styles** — highest in the codebase (FE-19).
- **Chain sync thresholds hardcoded** `lag > 20` / `lag > 5` (FE-13).
- **JobsPage filters not in queryKey** (FE-07) — client-side filter over current page only → spurious "no results" on off-page matches.
- **LogsPage filters not in queryKey** (FE-06) — same anti-pattern. Audit-log search is broken as a compliance feature.
- **HealthPage** — uses per-service cards with icons + KV panel. Good since Phase 3 rebuild.
- **ChainSyncPage** — per-chain cards + `ThresholdCell`. Good.
- **JobsPage row click** opens drawer with `JsonViewer`. `ErrorCell` used. Good.
- **LogsPage action column** renders action as a brand-soft pill with `<Hash>` icon. Good.

**Verdict**: 6.5/10. Good primitives, anti-pattern on filter state in two sub-pages.

### Admin: AdminAccountsPage

**File**: `apps/admin-web/src/pages/AdminAccountsPage.tsx`

- **FE-01 — fake success on destructive actions**. The single most dangerous admin-UX bug. See frontend-code-audit.md for details.
- **`RiskActionModal.loading` not passed** (FE-09) → operator can double-click confirm during await.
- **Rotate-session patch rejected by backend schema** (CT-05). UI claims "rotated", backend rejects with `INVALID_REQUEST`.
- **5 KPI cards** (`Total admins / Super admins / Operators / Disabled / Active in 24h`) — good KPI framing.
- **Row action menu** uses shared `RowActionMenu` primitive. Good.
- **Risk modal escalation**: `confirmPhrase = email` for suspending a super_admin — good defensive pattern.
- **Graceful degradation** — the problem: the runtime fallback (FE-01) IS the degradation, and it's dangerous.
- **Type error on `handleCreate`**: `Record<string, unknown>` not assignable to concrete body type.

**Verdict**: 4/10 because of FE-01. Visually strong; the runtime behavior is unsafe.

### Admin: UsersPage

**File**: `apps/admin-web/src/pages/UsersPage.tsx`

- **Hardcoded `page_size: 500`** (FE-08). Filters operate on the client against the first 500 rows. At real scale, silently truncates.
- **Filter reset** — works, but since filters aren't in the queryKey, resetting the filter doesn't re-fetch, just re-renders.
- **Row click vs row-action dropdown** — handled via `closest('.up-list__actions')` check. Good.
- **Preview drawer** — wired. Good.
- **Two tabs for Detail page (5 tabs: overview / rewards / team / vesting / audit)** — designed in prior phase. Will surface `current_tier: null`, `reward_qualified: false`, `team_total_performance: '0'` when the backend is reachable (BE-13 / BE-15).

**Verdict**: 6/10. Well-structured, but the 500 ceiling and the pending backend stubs will show as visible problems once CT-01 is fixed.

### Admin: RewardsPage + RewardsOverview

**File**: `apps/admin-web/src/pages/RewardsPage.tsx`

- **FE-05 — Sankey fabricates claim/burn ratios**. Hardcoded `0.82 / 0.18`, `0.78 / 0.22`, `0.80 / 0.20`. Operators will trust this.
- **`computeDelta` imported but never used** (FE-BUILD).
- Four sub-pages (direct / team / equal-level / burns) use `GlobalFilterBar` + drill drawer. Good.

**Verdict**: 5.5/10. Sankey is a credibility hit.

### Admin: ConfigPage

**File**: `apps/admin-web/src/pages/ConfigPage.tsx`

- **Two success toasts on create** (FE-10). Ownership confusion between page and modal.
- **Hardcoded hex tier colors** in `ConfigPage.css:680-693` (FE-14).
- **`handleCreate` has no try/catch** (FE-31) — implicit error ordering fragility.

**Verdict**: 6.5/10.

### Admin: SettlementPage + RecomputePage

**File**: `apps/admin-web/src/pages/SettlementPage.tsx`

- **DatePicker fix from Phase 0** — applied, date typos eliminated. OK.
- **`RiskActionModal.loading` not passed** (FE-09) — double-fire risk on settlement triggers.
- **Recompute preview / apply calls** send `{settlement_date, reason}` to backend — shapes match schema but backend **BE-19** hardcodes `diffs: []` so apply is a no-op. UI will show "applied" for a no-op mutation.

**Verdict**: 5/10.

### Admin: NetworkTeamPage

**File**: `apps/admin-web/src/pages/NetworkTeamPage.tsx`

- **Doc claims "virtualised" but isn't** (FE-18). Recursive React component.
- **10 inline styles**.
- **Hex `#fff` in inline style** (FE-15).
- Still the best-composed page in the codebase per prior audits.

**Verdict**: 7/10.

### Admin: NotificationCenter (Topbar bell)

**File**: `apps/admin-web/src/components/shell/NotificationCenter.tsx`

- 3-tab drawer wired to existing queries. Good.
- Unread dot + live refresh 45s. Good.
- No test file.

**Verdict**: 7.5/10.

---

### User: LandingHero + Layout

**Files**: `apps/user-web/src/components/brand/LandingHero.tsx` + `components/Layout.tsx`

- Unauthenticated users see hero + trust cues + "How it works" + "Why POSX". Good.
- `BrandLogo` SVG glyph. Good.
- `TrustFooter` with chain badge / contract address placeholder / T&C / Privacy / audit-integration hint. Good.
- **Chain config hardcoded as TypeScript constants** (FE-12). `CONTRACT_ADDRESS = ''` permanently shows "integration required" branch.
- **Bottom mobile nav uses `env(safe-area-inset-bottom)` padding** — iOS safe-area handled.
- **`NAV[].icon` type incompatible with lucide ForwardRef** (FE-BUILD-6) — 5 errors.

**Verdict**: 7/10. Visible trust layer exists; chain config needs to come from `/config/public`.

### User: DashboardPage

**File**: `apps/user-web/src/pages/DashboardPage.tsx`

- **Overview + vesting_summary mock drift** (FE-02). User sees blank dashboard in mock mode; real backend will return different shapes.
- **First-time onboarding card** (IA-05) — present. Good.
- **7-day deposit trend AreaMini** — present. Good.
- **Wired Claim button** via `useClaimAll` hook — good.
- **Skeleton primitive for loading state** — good.
- Non-null assertion warning (`src/pages/DashboardPage.tsx:81`).

**Verdict**: 6.5/10. Would be 8 if FE-02 were fixed.

### User: RewardsPage

**File**: `apps/user-web/src/pages/RewardsPage.tsx`

- Tab labels translated (Phase 0 fix). Good.
- **BurnView field mismatch** (FE-20 / CT-07) — permanent "at risk" pill with 0% progress on every persona.
- **DonutMini segment filter** excludes `total_claimable` etc. Good.
- **Reward list skeletons + inline error retry** — good.
- **`useClaimAll.reset` unused** (FE-11) — failed claim button stuck on "Failed" label until reload.

**Verdict**: 6/10.

### User: TeamPage

**File**: `apps/user-web/src/pages/TeamPage.tsx`

- **Missing RestrictedBanner** (FE-04).
- **Daily rewards always show 0** (CT-08) — field name mismatch.
- **Hero KPIs `today_effective_performance` + `current_team_rate` always 0** (CT-09 / BE-39) — backend hardcodes `'0'`.
- `BarMini` performance chart — good.
- Skeleton + inline error on all three queries — good.
- `Card` imported but never used after last refactor (FE-BUILD unused import).

**Verdict**: 5.5/10. Visible KPIs are fabricated zeros.

### User: BuyPage

**File**: `apps/user-web/src/pages/BuyPage.tsx`

- **No recovery from `failed` step** (FE-03). Dead-end on transient network errors. `api.recoverPurchase` exists and is never called.
- **Hardcoded chain constants** (FE-12). `CONTRACT_ADDRESS = ''` leaves "integration required" perpetual.
- **Purchase stepper visualisation** — good.
- **TrustStrip + restricted banner** — good.
- **Vesting progress bar** — good.

**Verdict**: 5/10 because of FE-03 dead-end.

### User: InvitePage

**File**: `apps/user-web/src/pages/InvitePage.tsx`

- **QR code + social share** — present. Good.
- **Missing RestrictedBanner** (FE-04) — blacklisted user can copy + share the link.
- **Dead fallback on `data.locked`** (CT-20) — cosmetic.
- **Lint error** `no-extra-boolean-cast` at line 99.
- **Referral code from last 8 hex chars of wallet** (backend-side BE-42). Collision + guessable URL.

**Verdict**: 6/10.

---

## Cross-cutting UI observations

### Inline-style heavy pages (>10 `style={{`)

- SystemPage.tsx — 48
- dashboard/DashboardPage.tsx — 44
- SystemOverviewPage.tsx — 27
- AdminAccountsPage.tsx — 11
- NetworkTeamPage.tsx — 10

Four admin files carry >25% of the visual weight as inline styles instead of component props / CSS modules. This is where light-mode regressions will keep appearing.

### Hardcoded hex colors in CSS

Every hit in `apps/admin-web/src/**/*.css`:
- `ConfigPage.css:387, 680-693` — tier dots
- `NetworkTeamPage.css:192, 196` — tree tier chips
- `LoginPage.css:22, 52, 141` — env tags
- `shell/Sidebar.css:31` — gradient
- `shell/Topbar.css:173` — gradient

None in `.tsx` files. But every `.css` hit breaks the light-mode theme contract (CSS vars instead of literal hex).

### Risky actions without full confirmation gates

- **AdminAccountsPage** — `RiskActionModal` is wired but `loading` prop not passed (FE-09). Cancel is not disabled while saving (FE-22).
- **SettlementPage** — same `RiskActionModal.loading` gap on trigger + recompute apply.
- **ConfigPage** — config version create has a modal but two success toasts + implicit error ordering (FE-10 / FE-31).

### Permission-denied UX gaps

- **TeamPage** — missing RestrictedBanner (FE-04).
- **InvitePage** — missing RestrictedBanner (FE-04).
- **Admin pages** — viewer role sees every admin's IP / every user's wallet / every job error message (BE-17 / BE-18 / BE-29) because read handlers don't gate by role.

### Stale timestamps

- **DashboardPage "Live — 30s" tooltip** is false (FE-29). No actual refetchInterval.
- **ChainSyncPage `dataUpdatedAt`** — uses `relativeSeconds(dataUpdatedAt)`. Correct for React Query's `dataUpdatedAt` but will not tick without a re-render trigger.

### Modal / drawer recovery

- **AdminAccountsPage RiskActionModal** — on mutation error, the message.error toast fires and the modal stays open (good). But FE-01 means "error" is hardly ever reached — the fallback returns success.
- **SettlementPage RiskActionModal** — same.
- **ConfigPage CreateConfigVersionModal** — try/catch at the modal level exists; page-level doesn't catch (FE-31).

---

## Dashboard KPI structure

Once CT-01 + BE-12 are fixed, the Dashboard should show:
- **Platform total deposit** ✓ (backend returns)
- **Today deposit** ✓
- **Total users / today new users** ✓
- **Total locked POSX / released POSX** ✓
- **24h reward mix (direct/team/equal)** ✓
- **Burn total** ✓

And should (but doesn't):
- `pending_claims_count` — never returned (CT-02)
- `burn_today` — never returned (CT-02), falls back to lifetime total
- `trend[]` — hardcoded empty (CT-03)
- `tier_distribution[]` — empty `where 1=0` (CT-04)

Four of ten data points are fabricated placeholders.

---

## Chart empty-state coverage

- `BaseChart` passes `loading` / `empty` props. Good.
- `AreaMini` / `DonutMini` / `BarMini` each have an empty branch. Good.
- Rewards Sankey does NOT have a fallback when data is zero — it renders the fabricated decoration regardless (FE-05).

---

## Localization consistency

Phase 0 fix added ~100 keys to both `zh-CN.json` and `en.json`; Phase 5 added notification / sidebar / system overview keys. Coverage is reasonable but:

- 2 remaining hardcoded English strings in admin-web (audit report did not catalogue specific hits).
- User-web is clean.

---

## UI/UX score

**6.5 / 10** — the admin panel looks like a real product, but four S0-class runtime bugs (FE-01, FE-04, FE-17, FE-05) make visible pages actively mislead operators. Fixing CT-01 will cascade several more visible failures. Real UX recovery requires backend stubs to be replaced with real data, not just visual polish.
