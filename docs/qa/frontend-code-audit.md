# Frontend Code Audit

**Scope**: `apps/admin-web/src/` + `apps/user-web/src/`

**Commands run**:
- `corepack pnpm exec tsc -b --noEmit` (admin-web): **38 errors**
- `corepack pnpm exec tsc -b --noEmit` (user-web): **18 errors**
- `corepack pnpm exec eslint "apps/**/*.{ts,tsx}" --max-warnings=0`: **13 errors, 46 warnings** → would fail `pnpm lint`
- `corepack pnpm run build` (admin-web): **FAIL** on `tsc -b`
- `corepack pnpm run build` (user-web): **FAIL** on `tsc -b`
- `corepack pnpm exec vitest run`: **FAIL** — `vitest.config.ts:7:29 Unexpected "."` — ESBuild misparses `/**/*.test.ts` inside a `/** */` JSDoc block. Zero tests can run.

**Total findings**: 35 (S0: 5, S1: 7, S2: 16, S3: 7)

---

## Section 1 — Build / type / lint status

### FE-BUILD-1 · S1 · Build · `apiRequest<T, B = undefined>` default defeats body type inference

**File**: `apps/admin-web/src/api/client.ts:38` + `apps/user-web/src/api/client.ts` (mirror)

```ts
export async function apiRequest<T, B = undefined>(options: Options<B>): Promise<T> {
```

**Symptom**: Callers like `apiRequest<Data>({ method: 'POST', body: { email, password } })` only specify `T`; TypeScript infers `B = undefined` (the default). Then `body: { email, password }` is a "`Type {...} is not assignable to type 'undefined'`" error. **Every endpoint that sends a body fails typecheck** — 9 errors in admin-web, 7 in user-web. Runtime is fine because JS doesn't type-erase values, but the type contract is a lie and `pnpm build` fails.

**Confidence**: high

### FE-BUILD-2 · S1 · Build · `charts/options.ts` fails typecheck because ECharts `color` type is mutable + no-undefined

**File**: `apps/admin-web/src/components/charts/options.ts:29, 150, 204`

**Symptom**: 3 errors — `(string | undefined)[]` not assignable to `ZRColor[]`; `readonly string[]` not assignable to mutable `ZRColor[]`.

**Confidence**: high

### FE-BUILD-3 · S1 · Build · ErrorBoundary missing `override` modifier

**Files**: `apps/admin-web/src/components/ErrorBoundary.tsx:23, 29, 38`; `apps/user-web/src/components/ErrorBoundary.tsx:23, 29, 40`

**Symptom**: 6 errors total.

**Confidence**: high

### FE-BUILD-4 · S1 · Build · `DashboardPage.tsx` declares 4 unused variables

**File**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx:218-221`

```ts
const rewardCurrent = ...;
const rewardPrevious = ...;
const burnCurrent = ...;
const burnPrevious = ...;
```

**Symptom**: Declared for the dashboard rebuild but never used. Lint `no-unused-vars` + tsc `TS6133`.

**Confidence**: high

### FE-BUILD-5 · S1 · Build · `SystemOverviewPage.tsx` imports `SectionTone` which isn't exported from the barrel

**File**: `apps/admin-web/src/pages/SystemOverviewPage.tsx:38`

**Symptom**: `TS2305: Module '"../components/shared"' has no exported member 'SectionTone'.` SystemOverviewPage won't compile until the barrel re-exports the type.

**Confidence**: high

### FE-BUILD-6 · S1 · Build · user-web Layout `NAV[].icon` typed as `ComponentType<{size?, className?}>` incompatible with lucide-react `ForwardRefExoticComponent`

**File**: `apps/user-web/src/components/Layout.tsx:51-55`

**Symptom**: 5 errors. lucide icons are forward-refs with a wider prop type; user-defined `NAV` entry expects a narrower component signature.

**Confidence**: high

### FE-BUILD-7 · S1 · Build · `DonutMini.tsx` uses `undefined` as index

**File**: `apps/user-web/src/components/charts/DonutMini.tsx:146, 174`

**Symptom**: `TS2538: Type 'undefined' cannot be used as an index type.`

**Confidence**: high

### FE-BUILD-8 · S0 · Test · vitest.config.ts unparseable by ESBuild

**File**: `vitest.config.ts:7`

```ts
/**
 * Root vitest config.
 *
 * Picks up tests from:
 *   - `packages/**/test/**/*.test.ts` (domain-rules, shared-utils, etc.)
```

**Symptom**: ESBuild's comment lexer sees `/**/` as close-comment inside `/** */`. Running `corepack pnpm exec vitest run` fails with `vitest.config.ts:7:29: ERROR: Unexpected "."`. **Zero tests can run anywhere in the project.** The 6 unit tests under `packages/domain-rules/test/`, `packages/shared-utils/test/`, `supabase/functions/_shared/test/` are all dead.

**Why it matters**: No test gate in CI. No regression protection for any existing code.

**Confidence**: high

### FE-BUILD-9 · S1 · Lint · 46 non-null assertions + 13 unused-var errors

**Evidence**: Full lint output:
- `admin-web/src/lib/analytics.ts:233` non-null assertion
- `admin-web/src/pages/ConfigPage.tsx:67, 255` non-null assertions
- `admin-web/src/pages/NetworkTeamPage.tsx:511` non-null
- `admin-web/src/pages/ReportsPage.tsx:436` (×2) non-null
- `admin-web/src/pages/dashboard/DashboardPage.tsx:249` non-null
- `admin-web/src/services/network/mappers.ts:116` non-null
- `admin-web/src/services/teamGraph/graphBuilder.ts:155` non-null
- `user-web/src/api/mock.ts:36` non-null
- `user-web/src/components/charts/AreaMini.tsx:77` (×2) non-null
- `user-web/src/lib/wallet.ts:45` non-null
- `user-web/src/pages/DashboardPage.tsx:81` non-null
- `user-web/src/pages/InvitePage.tsx:99` `no-extra-boolean-cast` ERROR
- `user-web/src/pages/TeamPage.tsx:23` unused import ERROR

**Confidence**: high

---

## Section 2 — S0 runtime defects

### FE-01 · S0 · Frontend · AdminAccountsPage fakes success on every destructive admin mutation

**File**: `apps/admin-web/src/pages/AdminAccountsPage.tsx:135-145`

```tsx
const fn = (api as unknown as Record<string, unknown>)['updateAdmin'];
if (typeof fn === 'function') {
  return (fn as (a: string, b: Record<string, unknown>) => Promise<unknown>)(
    payload.id,
    payload.patch,
  );
}
// No backend — simulate a local success so UX doesn't stall.
await new Promise((r) => setTimeout(r, 120));
return { ok: true, local: true };
```

**Symptom**: All four destructive admin actions (edit role / disable / re-enable / rotate session) silently no-op and show a green success toast if the runtime introspection check fails. `realApi.updateAdmin` exists (`endpoints.ts:159`), so in practice `fn` is found — but even then the `rotate_session: true` patch is silently dropped because the real API only accepts `{ role?, status?, name? }` (see CT-05).

**Why it matters**: Operator clicks "Disable", sees "Account disabled" toast, account stays active. UX deception on a high-risk security action.

**Confidence**: high

### FE-02 · S0 · Frontend · User dashboard reads fields the mock doesn't provide

**File**: `apps/user-web/src/pages/DashboardPage.tsx:130-132`

```tsx
const overview = (data['overview'] as AnyRow) ?? {};
const claimable = (data['claimable'] as AnyRow) ?? {};
const vesting = (data['vesting_summary'] as AnyRow) ?? {};
```

**Evidence**: `apps/user-web/src/api/mock.ts:91-117` — `buildDashboard` returns `{ profile, claimable, vesting, recent_purchases }`. No `overview`, no `vesting_summary`.

**Symptom**: `overview` and `vesting` always resolve to `{}`. Every KPI falls back to `'0'` / `'—'`. User sees a blank dashboard in mock mode (and probably real mode too — see CT-32).

**Why it matters**: The mock's whole purpose is to exercise the pages against a contract. This silent schema drift hides the bug instead of surfacing it.

**Confidence**: high

### FE-03 · S0 · Frontend/UX · BuyPage purchase flow has no recovery from `failed`

**File**: `apps/user-web/src/pages/BuyPage.tsx:49, 116-119, 245-305`

```tsx
type Step = 'idle' | 'creating' | 'awaiting_tx' | 'confirmed' | 'failed';
...
onError: (err) => {
  setError(err instanceof Error ? err.message : 'Failed to attach tx');
  setStep('failed');
},
```

**Symptom**: Stepper renders a red error indicator at the failed step, but the page never offers a Retry button, never resets `step`, never offers a "Recover purchase" affordance. `api.recoverPurchase` exists (`endpoints.ts:109`) and is never called anywhere in the codebase. The tx-hash input only renders in `awaiting_tx`, so `failed` has no escape path.

**Why it matters**: The single most important state machine in the app (buying tokens with real money) dead-ends on a transient network error.

**Confidence**: high

### FE-04 · S0 · UX/Security · TeamPage and InvitePage missing `RestrictedBanner`

**Files**: `apps/user-web/src/pages/TeamPage.tsx` (entire file), `apps/user-web/src/pages/InvitePage.tsx` (entire file)

**Evidence**: Neither file imports `RestrictedBanner`, neither destructures `session` from the layout context. Confirmed via grep — only BuyPage / DashboardPage / RewardsPage render the banner.

**Symptom**: A `blacklisted` or `suspended` user can navigate to `/my-team` and `/invite`, see all the data, copy invite links, and share them on Telegram/X/WhatsApp with no warning.

**Why it matters**: The whole point of Phase-0's `RestrictedBanner` was that "Previously the app never read `session.userStatus`" — that gap is back on two pages.

**Confidence**: high

### FE-05 · S0 · Frontend · Rewards overview Sankey chart fabricates claim/burn ratios

**File**: `apps/admin-web/src/pages/RewardsPage.tsx:125-153`

```tsx
const sankeyOption = useMemo(() => {
  const directClaim = directTotal * 0.82;
  const directBurn = directTotal * 0.18;
  const teamClaim = teamTotal * 0.78;
  const teamBurn = teamTotal * 0.22;
  const equalClaim = equalTotal * 0.8;
  const equalBurn = equalTotal * 0.2;
```

**Symptom**: The "today's deposit → reward channel → claim/burn" Sankey invents the claim-vs-burn ratio with hardcoded `0.82/0.18`, `0.78/0.22`, `0.80/0.20`. No API field provides this split.

**Why it matters**: Operators making policy decisions will read the Sankey as truth. This is the "fake data hiding missing real signal" pattern.

**Confidence**: high

---

## Section 3 — S1 list / filter / mutation bugs

### FE-06 · S1 · Frontend · LogsPage filters not in queryKey, page not reset on filter change

**File**: `apps/admin-web/src/pages/SystemPage.tsx:983-1023`

```tsx
const [page, setPage] = useState(1);
const [actionFilter, setActionFilter] = useState('');
...
const { data } = useQuery({
  queryKey: ['admin', 'logs', page, pageSize],
  queryFn: () => api.logs({ page, page_size: pageSize }),
  ...
const filtered = useMemo(() => {
  return filterByRange(rawItems, (row) => row['created_at'], range).filter(...
```

**Symptom**: Filter state is not in the queryKey, not passed to `api.logs`, not reset on page change. Filter operates only on the current page of 20 rows. Operator on page 5 applies filter, sees empty, thinks nothing matches. Pagination shows server `total` not `filtered.length` → wrong count.

**Confidence**: high

### FE-07 · S1 · Frontend · JobsPage filters not in queryKey

**File**: `apps/admin-web/src/pages/SystemPage.tsx:377-399`

Same anti-pattern as FE-06.

**Confidence**: high

### FE-08 · S1 · Frontend · UsersListPage hardcodes `page_size: 500`, ignores server-side filter contract

**File**: `apps/admin-web/src/pages/UsersPage.tsx:113-145`

```tsx
const { data } = useQuery<Row>({
  queryKey: ['admin', 'users', 'v2'],
  queryFn: () => api.listUsers({ page: 1, page_size: 500 }),
  staleTime: 20_000,
});
```

**Symptom**: Hardcoded 500, never re-queries on filter change, never updates cache key. Mock's `listUsers` does support server-side filters but they're bypassed. Works only if the real user count stays < 500. Past that, results silently truncate.

**Confidence**: high

### FE-09 · S1 · Frontend · `RiskActionModal.loading` not passed in AdminAccountsPage / SettlementPage

**Files**: `apps/admin-web/src/pages/AdminAccountsPage.tsx:438-483, 388-436`; `apps/admin-web/src/pages/SettlementPage.tsx:144-179, 274-283`

**Symptom**: No `loading={updateMutation.isPending}` passed. Modal's `disabled` calc gates on `loading` (RiskActionModal.tsx:79-84), so operator can double-click confirm during await → fires mutation twice. `okButtonProps.loading` spinner never shows.

**Confidence**: high

### FE-10 · S1 · Frontend · ConfigPage fires two success toasts on create

**Files**: `apps/admin-web/src/pages/ConfigPage.tsx:139-154` + `apps/admin-web/src/pages/config/CreateConfigVersionModal.tsx:162-182`

**Confidence**: high

### FE-11 · S1 · UX · `useClaimAll.reset` exposed but never called

**File**: `apps/user-web/src/hooks/useClaimAll.ts:82-86` + consumers

**Symptom**: `reset()` is part of the hook API; zero callers invoke it. After a failed claim, the button label keeps reading `'rewards.claim.failed'` until page reload. Button is still clickable (since `isBusy` doesn't include `'failed'`), but label lies.

**Confidence**: high

### FE-12 · S1 · UX · BuyPage hardcodes chain config as inline constants

**File**: `apps/user-web/src/pages/BuyPage.tsx:43-47`

```tsx
const CHAIN_LABEL = 'BSC Mainnet';
const CHAIN_ID = 56;
const CONTRACT_ADDRESS = ''; // empty → integration-required UI
const EXPLORER_BASE = 'https://bscscan.com';
```

**Symptom**: `CONTRACT_ADDRESS = ''` ships the "integration required" branch. Production build will silently render this branch until the constant is edited. Should come from `/config/public` response.

**Confidence**: high

---

## Section 4 — S2 code quality

### FE-13 · S2 · UI · Hardcoded magic thresholds across system pages

**Files**: `SystemPage.tsx:94-95, 280`; `SystemOverviewPage.tsx:104-105`; `DashboardPage.tsx:467`; `NetworkTeamPage.tsx:667`

**Evidence**:
```tsx
if (lag > 20) err += 1;
else if (lag > 5) warn += 1;
```
```tsx
tone={pendingClaims > 10 ? 'warn' : 'neutral'}
```
```tsx
if (mode === 'top' && node.teamSize >= 5) keep.add(wallet);
```

**Symptom**: Chain lag 5/20 blocks, pending claims 10, team-size top filter 5 — all inlined literals in two different pages. Independent drift possible.

**Confidence**: high

### FE-14 · S2 · A11y/Light mode · Hardcoded hex colors in CSS files

**Files**: `ConfigPage.css:387, 680-693`; `NetworkTeamPage.css:192, 196`; `LoginPage.css:22, 52, 141`; `shell/Sidebar.css:31`; `shell/Topbar.css:173`

**Evidence**:
```css
/* ConfigPage.css:680-693 */
.cfg-tier-dot--basic { background: #94a3b8; }
.cfg-tier-dot--elite { background: #f59e0b; }
.cfg-tier-dot--sovereign { background: #ec4899; }
```

**Symptom**: Tier dots and sidebar gradients keep their dark-mode color in light mode; possible contrast failures.

**Confidence**: high

### FE-15 · S2 · UI · `boxShadow` and `#fff` hardcoded in inline styles

**Files**: `dashboard/DashboardPage.tsx:394`, `NetworkTeamPage.tsx:477`

**Confidence**: high

### FE-16 · S2 · Frontend/Perf · `useMemo` deps re-allocate every render

**File**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx:208-210, 292-316`

```tsx
const depositSeries = trendRows.map((r) => r.deposit);
const rewardSeries = trendRows.map((r) => r.reward_total);
const burnSeries = trendRows.map((r) => r.burn_total);
...
const trendOption: EChartsOption = useMemo(
  () => buildAreaChartOption({ ... }),
  [trendRows, depositSeries, rewardSeries, burnSeries],
);
```

**Symptom**: Three arrays recreated every render; memo cache key changes every render; memo never hits.

**Confidence**: high

### FE-17 · S2 · Frontend · DashboardPage `range` state set but never consumed

**File**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx:146, 148-166, 400`

```tsx
const [range, setRange] = useState<TimeRange>(() => resolveRange('7d'));
...
const results = useQueries({
  queries: [
    { queryKey: ['admin', 'dashboard'], queryFn: () => api.dashboard() },
    ...
  ],
});
...
<TimeRangeField value={range} onChange={setRange} noFrame />
```

**Symptom**: `range` is never passed to any query, never in any queryKey. User picks a time range → nothing happens. The "Live — auto refresh every 30s" tooltip is a separate lie (no `refetchInterval` anywhere).

**Confidence**: high

### FE-18 · S2 · Frontend · NetworkTeamPage doc claims "virtualised" but isn't

**File**: `apps/admin-web/src/pages/NetworkTeamPage.tsx:8-10, 388-444`

**Symptom**: Recursive React component, no `react-window` / windowing. At 10k+ wallets expanding a heavy node synchronously renders thousands of DOM nodes.

**Confidence**: high

### FE-19 · S2 · Frontend · Inline-heavy pages

- `SystemPage.tsx` — **48** `style={{` occurrences
- `dashboard/DashboardPage.tsx` — **44**
- `SystemOverviewPage.tsx` — **27**
- `AdminAccountsPage.tsx` — **11**
- `NetworkTeamPage.tsx` — **10**

**Symptom**: Token correctness depends on every inline style remembering to use `var(--px-*)`. Two of these forget (FE-15). Inline styles recompute style objects on every render.

**Confidence**: high

### FE-20 · S2 · Frontend · BurnView reads mock fields that don't exist

**File**: `apps/user-web/src/pages/RewardsPage.tsx:293-295` + `apps/user-web/src/api/mock.ts:298-310`

**Symptom**: Mock returns `burn_cap, used_burn_capacity, remaining_capacity, burn_active`. Page reads `required_holding, total_burned, burn_total`. Result: `required = 0`, `safe = false`, "at risk" pill renders permanently for every mock persona.

**Confidence**: high

### FE-21 · S2 · Frontend · LoginPage double-casts login response via `unknown`

**File**: `apps/admin-web/src/pages/LoginPage.tsx:55, 67`

```tsx
applyLoginResult(res as unknown as Parameters<typeof applyLoginResult>[0]);
```

**Confidence**: medium

### FE-22 · S2 · UX · `RiskActionModal` Cancel button does not disable while saving

**File**: `apps/admin-web/src/components/shared/RiskActionModal.tsx:101-103`

**Symptom**: `okButtonProps.loading` disables OK, mask is non-closable — but the explicit Cancel button still works. Operator clicks Cancel mid-mutation, modal closes, mutation lands afterwards.

**Confidence**: medium

### FE-23 · S2 · Security · `apiBaseUrl` defaults to `http://localhost:54321/...` in production

**Files**: `apps/admin-web/src/env.ts:136`; `apps/user-web/src/env.ts:37`

```tsx
return {
  apiBaseUrl: env.VITE_ADMIN_API_BASE_URL ?? 'http://localhost:54321/functions/v1/api/v1',
  ...
```

**Symptom**: Missing env var in production build → bundled JS hits hardcoded localhost URL. Mixed-content warning is the only feedback. Should fail fast OR default to relative path.

**Confidence**: high

### FE-24 · S2 · UX · Session expiry never triggers redirect

**Files**: `apps/user-web/src/api/client.ts:94-104` + `apps/user-web/src/components/Layout.tsx:66`

**Symptom**: API client calls `clearSession()` on UNAUTHORIZED. Layout's `session` state is initialised once from `loadSession()` on mount, never re-reads. User keeps seeing authed shell, every request fails, no redirect. Only escape is manual reload.

**Confidence**: high

### FE-25 · S2 · Frontend · Multiple silent catches

**Evidence**: 22 silent catches in admin-web/src, 22 in user-web/src. Most defensive, but `apps/user-web/src/components/Layout.tsx:107-111`:
```tsx
try {
  await api.authLogout();
} catch {
  /* ignore — session may already be expired server-side */
}
```
— eats network errors unconditionally.

`apps/admin-web/src/components/global-search/useGlobalSearch.ts:56, 79, 101, 125` — four silent catches that drop all telemetry if global search data fails.

**Confidence**: high

### FE-26 · S2 · Frontend · `JSON.stringify(extra)` used as queryKey content

**File**: `apps/admin-web/src/pages/RewardsPage.tsx:89`

```tsx
queryKey: ['admin', 'rewards', endpoint.name, page, pageSize, JSON.stringify(extra)],
```

**Symptom**: React Query supports object members directly. Stringifying defeats deep-equal semantics for edge cases (Dates, Maps).

**Confidence**: medium

---

## Section 5 — S3 nits

### FE-27 · S3 · Perf · `loadEnv()` called on every render + every request

**Files**: `apps/user-web/src/components/Layout.tsx:59`, `apps/user-web/src/api/client.ts:51`, `apps/admin-web/src/api/client.ts:31`

**Confidence**: high

### FE-28 · S3 · A11y · RiskActionModal Cancel button lacks explicit aria-label (see FE-22)

**Confidence**: medium

### FE-29 · S3 · Frontend · Dashboard "Live — auto refresh" tooltip is false

**File**: Same file as FE-17. No `refetchInterval` anywhere. Only the UTC clock ticks; no data refetches.

**Confidence**: high

### FE-30 · S3 · Frontend · `console.log/error` limited to two ErrorBoundary catches

**Files**: `ErrorBoundary.tsx:31` (admin), `ErrorBoundary.tsx:33` (user-web)

**Confidence**: high (no defect; reasonable use)

### FE-31 · S3 · UX · ConfigPage `handleCreate` relies on implicit error ordering

**File**: `apps/admin-web/src/pages/ConfigPage.tsx:139-154`

**Confidence**: medium

### FE-32 · S3 · Frontend · `mockApi.exportDownloadUrl` returns `data:` URL

**File**: `apps/admin-web/src/api/mock.ts:356-358`

**Confidence**: medium

### FE-33 · S3 · Frontend · Hardcoded social share URLs

**File**: `apps/user-web/src/pages/InvitePage.tsx:291-293`

**Confidence**: low

### FE-34 · S3 · Frontend · `mock.recoverPurchase` is dead code

**Confidence**: high

### FE-35 · S3 · Frontend · user-web mock uses `as unknown as Record<string, unknown>` in every function

**File**: `apps/user-web/src/api/mock.ts` (21 occurrences)

**Symptom**: Type erasure on every call site. Root cause of FE-02 / FE-20 schema drift — the real API return types are loose `Record<string, unknown>`, so the mock can drift without TS error.

**Confidence**: high

---

## Fake "passed" items that still hide risk

These technically work but deceive the operator/user:

1. **FE-01** — AdminAccountsPage silent-success fallback for destructive admin actions.
2. **FE-17 + FE-29** — Dashboard time-range field and "Live — 30s" tooltip both non-functional.
3. **FE-02 + FE-20** — User dashboard/BurnView read fields the mock doesn't provide → silent zeros.
4. **FE-05** — Rewards Sankey invents 82/18, 78/22, 80/20 claim/burn ratios.
5. **FE-34** — `mock.recoverPurchase` exists; no UI button ever calls it (FE-03 dead end).
6. **FE-08** — UsersListPage `page_size: 500` — silent truncation past 500 users.
7. **FE-18** — NetworkTeamPage "virtualised" comment is a lie.
8. **FE-11** — `useClaimAll.reset` exists; no caller ever invokes it.
9. **FE-12** — `CONTRACT_ADDRESS = ''` → "integration required" permanent if someone forgets to edit the constant.
10. **FE-25** — Logout silent catch + four useGlobalSearch silent catches drop all telemetry.
11. **AdminAccountsPage rotate_session** — UI sends `{rotate_session: true, reason}`; backend schema strips both and rejects with 400 `INVALID_REQUEST` (see CT-05).
12. **FE-23** — `apiBaseUrl` default `http://localhost` ships broken URLs in production on any missing env var.

---

## Top 10 worst frontend items

1. **FE-01** — AdminAccountsPage fake success on destructive admin mutations.
2. **FE-02** — User dashboard reads `overview`/`vesting_summary` keys the mock doesn't provide.
3. **FE-03** — BuyPage purchase flow dead-ends on `failed`.
4. **FE-04** — TeamPage + InvitePage missing RestrictedBanner and session-status gating.
5. **FE-05** — Rewards Sankey fabricates claim/burn percentages.
6. **FE-BUILD-1** — `apiRequest<T, B=undefined>` defeats body typing — entire build fails.
7. **FE-BUILD-8** — vitest.config.ts unparseable — zero tests run.
8. **FE-BUILD-9** — 13 lint errors + 46 warnings — `pnpm lint` fails.
9. **FE-23** — `apiBaseUrl` defaults to `localhost` — production bundle hits dead URL.
10. **FE-09** — `RiskActionModal.loading` not passed → operator can double-fire destructive actions.
