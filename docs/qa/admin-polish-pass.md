# Admin Polish Pass

Focused admin-web UI/UX improvements. No backend refactor.

---

## Items completed

### 1. Error states on 17 pages

Added `InlineError` (with retry button) and `EmptyHint` to every page that previously silently swallowed query errors:

DashboardPage, RewardsOverviewPage, RewardsDirectPage, RewardsTeamPage, RewardsEqualLevelPage, RewardsBurnsPage, SettlementJobsPage, SystemOverviewPage, ChainSyncPage, HealthPage, JobsPage, LogsPage, ReportsPage, UsersListPage, UserDetailPage, UserTreePage, NetworkOverviewPage, HierarchyAnalysisPage.

Created shared `InlineError`, `EmptyHint`, and `SkeletonGroup` components in `components/shared/states.tsx` with CSS in `states.css`.

### 2. Role-based action visibility

Created `useAdminRole()` hook in `lib/use-admin-role.ts`. Returns `{ role, canMutate, isSuperAdmin }`.

Wired `canMutate` guard into 6 pages:
- **AdminAccountsPage**: "New" button hidden; row action menu shows only "View detail" for viewers
- **ConfigPage**: "Create version" button hidden for viewers
- **SettlementPage**: "Trigger settlement" button hidden
- **RecomputePage**: "Run preview" and "Apply" buttons hidden
- **UsersPage**: "Change status" action hidden in list; status-change callback disabled in detail
- **ReportsPage**: "Export" button hidden

### 3. P0 display bugs fixed (5)

| Bug | Fix |
|---|---|
| 3 raw ISO date columns in RewardsPage (Team, EqualLevel, Burns) | Added `render: (v) => <TimeCell value={v} />` |
| Full wallet address in UserOverviewTab | Replaced `<code>` with `<WalletCell>` |
| "claimable" status gray in StatusBadge | Added `claimable: 'ok'`, `pending_signature: 'info'`, `broadcasted: 'info'` to STATUS_MAP |
| 3 hardcoded English strings bypassing i18n | Fixed UserQualificationCard, filterFields tier labels, RowActionMenu default |
| Missing thousand separators on integer KPIs | Replaced `String(kpis.total)` with `formatInt()` in AdminAccountsPage + UserTreePage |

### 4. Unified display rules

- Replaced all manual percentage formatting (`* 100).toFixed(N)%`) with `formatPercent()` in NetworkTeamPage, RewardsPage, UserOverviewTab, UserTeamTab, UserQualificationCard
- Added `formatInt()` to all raw integer displays

### 5. ZH locale fixes (18 keys)

Replaced stray English in zh-CN.json: "Claim" → "领取", "Vesting" → "锁仓释放", "Lot ID" → "批次编号", "drill drawer" → "明细面板", "Viewer" → "只读", "Leader" → "团长", "Top" → "顶级/前", "Basic/Advanced/Elite" → "基础/进阶/精英".

### 6. EN casing + wording standardization

- Standardized ~50 Title Case values to sentence case across all `.title`, `.col.`, `.kpi.`, `.section.` keys
- Fixed button labels: "Agent network" → "View agent network", "Reward detail" → "View reward detail", "Audit records" → "View audit records"
- Expanded error messages: "Login failed" → "Login failed. Check your email and password."
- Removed duplicate `nav.system` key from both locale files

### 7. Shared pattern adoption

- `EmptyHint` now rendered via DataTable `locale.emptyText` on all paginated tables
- `InlineError` now on every page with queries

---

## Files changed

### New
- `src/components/shared/states.tsx` — InlineError, EmptyHint, SkeletonGroup
- `src/components/shared/states.css`
- `src/lib/use-admin-role.ts`

### Modified (admin-web)
- 17 page files (error states + role gating)
- `components/shared/badges.tsx` (StatusBadge STATUS_MAP)
- `components/shared/filterFields.tsx` (tier labels i18n)
- `components/shared/RowActionMenu.tsx` (default label i18n)
- `components/shared/index.ts` (new exports)
- `pages/users/UserOverviewTab.tsx` (WalletCell + formatPercent)
- `pages/users/UserQualificationCard.tsx` (i18n + formatPercent)
- `pages/users/UserTeamTab.tsx` (formatPercent)
- `i18n/en.json` (~50 casing fixes + error expansions + button verbs)
- `i18n/zh-CN.json` (~18 stray-English fixes)
