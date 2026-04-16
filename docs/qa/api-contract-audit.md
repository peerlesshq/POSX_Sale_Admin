# API Contract Audit

**Scope**: frontend admin-web + user-web HTTP clients vs backend router + handlers + Zod schemas.

Every finding includes file paths and direct quotes.

---

## CT-01 · S0 · Path · Router patterns don't match Supabase edge-function pathnames

**Frontend**: `apps/admin-web/src/env.ts:36` and `apps/user-web/src/env.ts:37` — `apiBaseUrl: env.VITE_API_BASE_URL ?? 'http://localhost:54321/functions/v1/api/v1'`.

**Frontend**: `apps/admin-web/src/api/client.ts:27-36`:
```ts
function buildUrl(path: string, ...): string {
  const base = loadEnv().apiBaseUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
```
A call to `path: '/admin/users'` produces `http://localhost:54321/functions/v1/api/v1/admin/users`.

**Backend**: `supabase/functions/api/serve.ts:62-68`:
```ts
const routeReq: RouteRequest = {
  method: request.method,
  pathname: url.pathname,
  ...
};
```
`url.pathname` is `/functions/v1/api/v1/admin/users` — **no prefix stripping**.

**Backend**: `supabase/functions/api/router.ts:170-695` — every `pattern` literally starts with `/api/v1/...`, e.g. `pattern: '/api/v1/admin/users'`, `pattern: '/api/v1/admin/dashboard'`. `matchPattern` (router.ts:699) splits by `/`; `/functions/v1/api/v1/admin/users` has 6 segments, `/api/v1/admin/users` has 4. Length check fails immediately, every dispatch falls through to `throw new AppError('NOT_FOUND', \`route not found: ${req.method} ${req.pathname}\`)`.

**Symptom**: Every single endpoint returns `NOT_FOUND` with `route not found: GET /functions/v1/api/v1/admin/dashboard`. Frontend `apiRequest` throws `PosxApiError('NOT_FOUND')` and React Query renders error states everywhere. Login, dashboard, users, configs, settlement, claims, invites, rewards — nothing reaches a handler.

**Why it matters**: The single most impactful contract issue in the codebase. Until either (a) `serve.ts` strips `/functions/v1/api` from the pathname, or (b) every router pattern is extended with that prefix, neither admin nor user web ever talks to the real backend. Unit tests that craft `new Request('http://x/api/v1/...')` still pass because they bypass the Supabase URL prefix, masking the bug.

**Confidence**: high

---

## CT-02 · S1 · Response · Dashboard `pending_claims_count` and `burn_today` read by frontend but never returned

**Frontend**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx:225`:
```tsx
const pendingClaims = toNumber(summary['pending_claims_count']);
```

**Frontend**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx:511`:
```tsx
value={formatUsdt(summary['burn_today'] ?? summary['burn_total'] ?? '0')}
```

**Backend**: `supabase/functions/_shared/src/handlers/admin.ts:120-137` returns `summary: { platform_total_deposit, today_deposit, total_users, today_new_users, total_locked_posx, total_released_posx, reward_24h, burn_total }`. Neither `pending_claims_count` nor `burn_today` exists.

**Symptom**: "Pending claims" KPI permanently shows 0; burn-today tile silently falls back to lifetime `burn_total`, misleading operators about 24h activity.

**Why it matters**: Two of four dashboard KPIs are wrong.

**Confidence**: high

---

## CT-03 · S1 · Response · Dashboard `trend` is hardcoded empty array

**Frontend**: `apps/admin-web/src/pages/dashboard/DashboardPage.tsx:193-196` — `extractTrend(dashboardQuery.data?.['trend'])` walks `raw[].date / .deposit / .reward_total / .burn_total`.

**Backend**: `supabase/functions/_shared/src/handlers/admin.ts:135` — `trend: [],`.

**Symptom**: The 14-day area chart always shows the empty state. `splitPeriods([])` returns `{current: [], previous: []}`, so every KPI delta on the four hero KPI cards is forever 0%.

**Why it matters**: All delta chips and the main time-series chart are dead.

**Confidence**: high

---

## CT-04 · S1 · Response · Dashboard `tier_distribution` query is always empty

**Frontend**: `DashboardPage.tsx:197-204` reads `tier_distribution` array.

**Backend**: `supabase/functions/_shared/src/handlers/admin.ts:113-117`:
```sql
select coalesce(current_tier::text,'none') as tier, count(*)::int as count
  from (
    select null::text as current_tier from users where 1=0
  ) t group by tier
```
`where 1=0` — inner query returns zero rows.

**Symptom**: Tier-distribution horizontal bar chart always empty.

**Confidence**: high

---

## CT-05 · S1 · Request · `PATCH /admin/accounts/:id` strips `rotate_session` and `reason` then `.refine()` rejects empty patch

**Frontend**: `apps/admin-web/src/pages/AdminAccountsPage.tsx:191-196`:
```tsx
case 'rotate': {
  await updateMutation.mutateAsync({
    id: String(riskTarget.row['admin_user_id']),
    patch: { rotate_session: true, reason },
  });
```
Every other mutation (`edit_role`, `disable`, `reenable`) also attaches `reason`:
```tsx
patch: { role: riskTarget.newRole, reason },
```

**Backend schema**: `packages/api-contracts/src/endpoints/admin-accounts.ts:51-60`:
```ts
export const UpdateAdminAccountRequestSchema = z
  .object({ role: AdminRoleSchema.optional(), status: AdminStatusSchema.optional(), name: z.string().min(1).optional() })
  .refine((v) => v.role !== undefined || v.status !== undefined || v.name !== undefined,
    { message: 'at least one field must be provided' });
```

**Backend handler**: `_shared/src/handlers/admin.ts:921-944` — UPDATE only references `role`, `status`, `name`. No session rotation.

**Symptom**: For `rotate`, the schema `.parse()` strips `rotate_session` and `reason` (Zod default), so the object becomes `{}`. `.refine()` fails → `INVALID_REQUEST` → frontend toasts "request failed". For role/disable/reenable, `reason` is silently dropped and never written to the audit log.

**Why it matters**: Rotate-session UX is non-functional. Reason is part of every risk-action audit story but the backend never persists it.

**Confidence**: high

---

## CT-06 · S1 · Request · `recomputeApply` accepts zero diffs and writes nothing

**Frontend**: `apps/admin-web/src/api/endpoints.ts:110-112`:
```ts
recomputeApply(body: { settlement_date: string; reason: string }) {
  return apiRequest<Data>({ method: 'POST', path: '/admin/recompute/apply', body });
},
```

**Backend**: `_shared/src/handlers/admin.ts:700-726` — `handleRecomputeApply` calls `ctx.services.recompute.applyAdjustment({ settlementDate, reason, triggeredByAdminId, diffs: [] })`. **`diffs: []` is hardcoded.**

**Symptom**: `recompute_apply` always runs against zero diffs; whatever the preview computed is silently discarded. UX shows "applied" but nothing changed.

**Why it matters**: The recompute apply path is a no-op. The schema-handler contract is self-inconsistent in a way the frontend cannot detect.

**Confidence**: high

---

## CT-07 · S1 · Response · BurnView field names mismatch — `required_holding` vs `burn_disable_threshold`, `total_burned` vs `burned_total`

**Frontend**: `apps/user-web/src/pages/RewardsPage.tsx:293-295`:
```tsx
const holding = readDecimal(data['holding_value_usdt']);
const required = readDecimal(data['required_holding']);
const burned = readDecimal(data['total_burned'] ?? data['burn_total']);
```

**Backend**: `_shared/src/handlers/reward.ts:342-350`:
```ts
return success(ctx, {
  burn_enabled: enabled,
  holding_value_usdt: holdingValueUsdt,
  burn_disable_threshold: policy.burn_disable_threshold,
  burn_cap: ...,
  used_burn_capacity: ...,
  remaining_burn_capacity: remaining,
  burned_total: burnedTotalRow?.total ?? '0',
});
```

**Symptom**: `required` always 0 (no `required_holding` field). `burned` falls back to `burn_total` which also doesn't exist → 0. Then `safe = holding.gte(required) && required.gt(0)` evaluates false → page renders "at risk" copy permanently with 0% progress.

**Why it matters**: Every BurnView visitor sees an alarming "at risk" badge and bogus zero burn total.

**Confidence**: high

---

## CT-08 · S1 · Response · TeamPage `reward_amount` never set — field is `actual_amount`

**Frontend**: `apps/user-web/src/pages/TeamPage.tsx:64-70`:
```tsx
const date = asString(row['settlement_date'] ?? row['date']).slice(0, 10);
const reward = asString(row['reward_amount'] ?? row['amount'], '0');
```

**Backend**: `_shared/src/handlers/team.ts:135-157` — SQL aliases produce columns `date, effective_performance, team_rate, team_raw_amount, equal_level_raw_amount, burned_amount, actual_amount, status`. Never renames to `reward_amount` or `amount`.

**Symptom**: Daily reward amount in the table + chart is always 0, regardless of actual settlement results.

**Confidence**: high

---

## CT-09 · S1 · Response · `handleGetTeamOverview` returns hardcoded `'0'` for hero KPIs

**Frontend**: `apps/user-web/src/pages/TeamPage.tsx:130-139` reads `today_effective_performance` and `current_team_rate`.

**Backend**: `_shared/src/handlers/team.ts:33-43`:
```ts
return success(ctx, {
  team_total_performance: row?.team_total ?? '0',
  today_effective_performance: '0',
  ...
  current_team_rate: '0',
  ...
});
```
Literal string `'0'`.

**Symptom**: Two hero KPIs on user TeamPage are forever zero by design.

**Confidence**: high

---

## CT-10 · S2 · Response · `handleGetUserDashboard.burn_status` hardcoded to `burn_enabled: false`

**Backend**: `_shared/src/handlers/user.ts:114-120` hardcodes `{ burn_enabled: false, burn_cap: null, used_burn_capacity: null, remaining_burn_capacity: null }`.

**Frontend**: user-web DashboardPage has no direct consumer (BurnView uses the separate `/rewards/burn-status` endpoint).

**Symptom**: Wasted bytes; not a runtime bug today, but misleading for any future page.

**Confidence**: medium

---

## CT-11 · S2 · Path · URI decoding defaults, wallet encoding unverified

**Frontend**: `apps/admin-web/src/api/endpoints.ts:42-46` interpolates raw wallet strings.

**Backend**: `router.ts:711` calls `decodeURIComponent(r)` on each segment; frontend doesn't URI-encode.

**Symptom**: Works today because wallets contain no reserved characters. Hardening concern only.

**Confidence**: low

---

## CT-13 · S1 · Response · UsersPage `current_tier: null` hardcoded, `holding_value_usdt` reuses deposit

**Backend**: `_shared/src/handlers/admin.ts:191-197` and `246-265`:
```ts
items: rows.map((r) => ({
  ...
  holding_value_usdt: r.cumulative_deposit,
  current_tier: null,
  ...
```

**Symptom**: Tier filter on UsersPage filters out everyone. Holding value column equals deposit, wrong once users claim POSX.

**Confidence**: high

---

## CT-16 · S1 · Pagination · `count(*)` queries ignore WHERE filters

**Backend**: Multiple `_shared/src/handlers/admin.ts` handlers do this anti-pattern:

- `handleListAdminUsers` (line 183-185): `count(*) from users` — ignores `search`, `status`, `tier`, `from_date`, `to_date`.
- `handleListSettlementJobs` (line 646-648): same.
- `handleListJobRuns` (line 765-767): same.
- `handleListAdminLogs` (line 844-846): same.
- `handleAdminListBurnRecords` (line 459-461): same.
- `handleAdminListDirectRewards` (line 401-403): same.

**Symptom**: When filtering, `total` is always the unfiltered count → wrong page count, pagination controls overflow, operator clicks page 5 and sees empty table.

**Why it matters**: Every filtered listing UI has broken pagination metadata.

**Confidence**: high

---

## CT-17 · S2 · Enum · `SettlementJobMode` enum has 4 values; API accepts only 2

**Frontend**: `triggerSettlement` body `mode: 'official' | 'backfill'`.
**Schema**: `admin-settlement.ts:24` — `mode: z.enum(['official', 'backfill'])`.
**Enum**: `packages/shared-types/src/enums/settlement-job-mode.ts:20-25` — 4 values: `Official`, `Backfill`, `RecomputePreview`, `RecomputeApplyAdjustment`.

**Symptom**: Trigger endpoint legitimately only accepts two modes. But the listing handler at admin.ts:649-664 returns the raw `mode` column, which can be any of 4. Frontend type narrows off-contract.

**Confidence**: medium

---

## CT-20 · S3 · Response · Invite endpoint dead fallback

**Frontend**: `apps/user-web/src/pages/InvitePage.tsx:96-99`:
```tsx
const unlocked =
  'invite_unlocked' in data
    ? Boolean(data['invite_unlocked'])
    : !Boolean(data['locked']);
```

**Backend**: `_shared/src/handlers/invite.ts:40-51` returns `invite_unlocked`. Never `locked`.

**Symptom**: Fallback branch is dead code (was put in to handle mock/real mismatch).

**Confidence**: high (no runtime defect)

---

## CT-21 · S0 · Path/Handler · Claim sign re-derives `signed_message` from NULL DB column

**Frontend**: `apps/user-web/src/api/endpoints.ts:162-168`:
```ts
signClaim(claimOrderId: string, signature: string) {
  return apiRequest<Record<string, unknown>>({
    method: 'POST',
    path: `/claims/${claimOrderId}/sign`,
    body: { signature },
  });
},
```

**Backend**: `supabase/functions/api/router.ts:347-369`:
```ts
const row = await ctx.db.queryOne<{ ... signed_message: string | null; ... }>(
  `select * from claim_orders where id = $1`, [params['id']!],
);
const derivedMessage = row?.signed_message ?? '';
return handleSignClaimOrder(..., derivedMessage);
```

**Symptom**: For a freshly-created claim order, `signed_message` is NULL in the DB (router comment admits this: "Phase 5 will store it per claim order"). The dispatcher passes `''` to the verifier. Either every sign call fails (bad UX) or `verifyWalletSignature` accepts empty string and signatures can be forged.

**Why it matters**: The most dangerous single defect — the claim-signing money path is broken by construction.

**Confidence**: high

---

## CT-28 · S2 · Request · `recoverPurchase` field name unverified

**Frontend**: `apps/user-web/src/api/endpoints.ts:109-115` — `body: { tx_hash: txHash }`.
**Backend**: `router.ts:254` calls `RecoverPurchaseRequestSchema.parse(req.body ?? {})`.

**Symptom**: Needs verification — if the schema expects `purchase_tx_hash` (matching the neighboring `attachTx` convention), the request fails Zod validation.

**Confidence**: medium (unverified)

---

## CT-30 · S0 · Path · Export download URL has no way to attach Authorization header

**Frontend**: `apps/admin-web/src/api/endpoints.ts:132-136`:
```ts
exportDownloadUrl(id: string): string {
  const env = loadEnv();
  const base = env.apiBaseUrl.replace(/\/$/, '');
  return `${base}/admin/reports/export/${id}/download`;
},
```
Used for `<a href>` clicks.

**Backend**: `router.ts:577-590` — mode `admin`, requires `Authorization: Bearer ...`. Browsers cannot attach custom headers to anchor clicks.

**Symptom**: Clicking the download link navigates to a URL that immediately returns `UNAUTHORIZED`.

**Why it matters**: Export download is broken end-to-end.

**Confidence**: high

---

## Summary — fields the frontend reads but the backend doesn't return

| Page | Field read | Read at | Backend status |
|---|---|---|---|
| Admin Dashboard | `summary.pending_claims_count` | `DashboardPage.tsx:225` | never returned (CT-02) |
| Admin Dashboard | `summary.burn_today` | `DashboardPage.tsx:511` | never returned (CT-02) |
| Admin Dashboard | `trend[]` | `DashboardPage.tsx:194` | hardcoded `[]` (CT-03) |
| Admin Dashboard | `tier_distribution[]` | `DashboardPage.tsx:199` | always empty CTE (CT-04) |
| User BurnView | `data.required_holding` | `RewardsPage.tsx:294` | returns `burn_disable_threshold` (CT-07) |
| User BurnView | `data.total_burned` | `RewardsPage.tsx:295` | returns `burned_total` (CT-07) |
| User TeamPage | `row.reward_amount` | `TeamPage.tsx:69, 213` | returns `actual_amount` (CT-08) |
| User TeamPage | `today_effective_performance` | `TeamPage.tsx:130` | hardcoded `'0'` (CT-09) |
| User TeamPage | `current_team_rate` | `TeamPage.tsx:139` | hardcoded `'0'` (CT-09) |
| User InvitePage | fallback `data.locked` | `InvitePage.tsx:99` | dead code — returns `invite_unlocked` (CT-20) |
| Admin UsersPage | `current_tier` | row map | hardcoded `null` (CT-13) |
| Admin UsersPage | `holding_value_usdt` distinct from deposit | row map | reuses `cumulative_deposit` (CT-13) |

## Summary — fields the backend returns but the frontend ignores

| Endpoint | Leaked field | Returned at |
|---|---|---|
| `/admin/system/jobs` | `rows_scanned` | `admin.ts:775` |
| `/admin/logs` | `detail`, `ip_address` | `admin.ts:854-855` |
| `/admin/system/chain-sync` | `id`, `last_scanned_at` | `chain-events.ts:181, 187` |
| `/user/dashboard` | entire `burn_status` object | `user.ts:114-120` |

## Summary — request shape mismatches

| Endpoint | Frontend body | Schema | Defect |
|---|---|---|---|
| `PATCH /admin/accounts/:id` (rotate) | `{ rotate_session: true, reason }` | `{ role?, status?, name? }` + `.refine(at-least-one)` | strips → empty → 400 (CT-05) |
| `PATCH /admin/accounts/:id` (role/disable/reenable) | adds `reason` | strips silently | `reason` never audited (CT-05) |
| `POST /admin/recompute/apply` | `{ settlement_date, reason }` | matches schema | handler hardcodes `diffs: []` (CT-06) |
| `POST /claims/:id/sign` | `{ signature }` | matches | dispatcher reads NULL `signed_message` → `''` (CT-21) |
| `POST /purchases/recover` | `{ tx_hash }` | unverified | possibly expects `purchase_tx_hash` (CT-28) |

## Fix order

1. **CT-01** — single-line `serve.ts:64` patch (strip `/functions/v1/api` prefix before matching). Until this lands, nothing else is observable at runtime.
2. **CT-21 / BE-35 / BE-36** — persist `signed_message` on order creation, remove re-derive branch.
3. **CT-02 / CT-03 / CT-04** — real dashboard SQL for `pending_claims_count`, `burn_today`, `trend`, `tier_distribution`.
4. **CT-05** — extend update-admin schema with `rotate_session` or remove the UI branch.
5. **CT-07** — pick one set of burn-status field names; fix both sides.
6. **CT-08 / CT-09** — team daily/overview: either alias columns in SQL or update frontend fallbacks.
7. **CT-13 / CT-16** — UsersPage: compute real tier; apply filters in count queries.
8. **CT-30** — token-in-URL for exports OR fetch-blob pattern.
