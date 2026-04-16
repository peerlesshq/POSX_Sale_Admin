# Admin UI/UX Audit Rubric

Enterprise admin console quality gate. Every page must satisfy all checkboxes before staging-RC sign-off.

---

## Per-page checklist

### Data states (mandatory — every query-backed section)

- [ ] **Loading**: Skeleton placeholders or SkeletonGroup — never raw "Loading..." text
- [ ] **Error**: InlineError with retry button, shows error.message — never silent swallow
- [ ] **Empty**: EmptyHint with icon + description + CTA — never blank area
- [ ] **Permission-denied**: role check or RestrictedBanner — viewer cannot see destructive controls

### Data display (mandatory — every rendered value)

- [ ] **Amounts**: `AmountCell` or `formatUsdt` — never raw string; right-aligned in tables; 2 decimal places; `$` prefix
- [ ] **Percentages**: `formatPercent` or `PercentCell` — never manual `* 100 + .toFixed()`; consistent decimal places
- [ ] **Dates**: `TimeCell` — never raw ISO string; appropriate mode (datetime vs relative)
- [ ] **Integers**: `CountCell` or `formatInt` — never raw number; thousand separators on counts > 999
- [ ] **Addresses**: `WalletCell` or `CopyableHashCell` — never full address; monospace; copy button; truncated
- [ ] **Statuses**: `StatusBadge` — never raw text; color maps to severity tone
- [ ] **Tx hashes**: `CopyableHashCell` — truncated; copy button; link to explorer where available

### Interaction patterns (mandatory — every mutation)

- [ ] **Destructive actions**: `RiskActionModal` with severity, consequences, typed confirm for critical
- [ ] **Success feedback**: single `message.success` toast — never double toast
- [ ] **Error feedback**: inline `<Alert>` in modal/form — never only a toast for destructive failure
- [ ] **Loading during mutation**: button disabled + spinner — never blank button during submit
- [ ] **Reason field**: every destructive admin mutation requires operator reason

### Layout / composition

- [ ] **Page header**: `PageHeader` with title + subtitle — never raw `<h1>` + `<p>`
- [ ] **Sections**: `SectionCard` with icon, title, hint — never raw `<div>` blocks
- [ ] **Tables**: `DataTable` with typed columns — never raw antd `<Table>`
- [ ] **Filters**: `FilterBar` with `TextField`/`SelectField` — filters reflected in queryKey
- [ ] **KPIs**: `KpiStatCard` or `KpiDeltaCard` — never raw stat divs
- [ ] **Drawers**: consistent width, header with icon + entity label, `KeyValuePanel` for detail

### i18n / bilingual

- [ ] **All visible text** goes through `t()` or `tp()` — never hardcoded English strings in JSX
- [ ] **Consistent casing**: sentence case for all labels (not Title Case)
- [ ] **ZH values**: no stray English words (especially "Claim", "Viewer", "Leader", tier names)
- [ ] **Placeholders**: `{variable}` patterns match between EN and ZH

### Styling

- [ ] **No inline style objects** except layout (flex, grid, gap) — colors via CSS vars
- [ ] **Color palette**: `var(--px-*)` tokens only — never hex literals
- [ ] **Font stacks**: `px-mono` for hashes/amounts, `px-tabular` for numbers — never ad-hoc monospace
- [ ] **Spacing**: consistent gap/padding via the spacing scale — never magic numbers

---

## Severity levels

| Severity | Definition | Example |
|---|---|---|
| **S0** | Data display bug — user sees wrong/confusing data | Raw ISO string in date column, full wallet exposed |
| **S1** | Missing state — silent failure or blank area | No error state on API failure, empty page with no hint |
| **S2** | Inconsistency — same data type rendered differently across pages | `.toFixed(2)` on one page, `.toFixed(1)` on another |
| **S3** | Polish — suboptimal but functional | Inline styles instead of CSS vars, missing copy button |

---

## Page inventory (admin-web)

20 pages total:

| Page | Route | Category |
|---|---|---|
| DashboardPage | `/dashboard` | Overview |
| UsersListPage | `/users` | User management |
| UserDetailPage | `/users/:wallet` | User management |
| UserTreePage | `/users/:wallet/tree` | User management |
| NetworkOverviewPage | `/network` | Network |
| NetworkTeamPage | `/network/team` | Network |
| HierarchyAnalysisPage | `/network/hierarchy` | Network |
| RewardsOverviewPage | `/rewards` | Rewards |
| RewardsDirectPage | `/rewards/direct` | Rewards |
| RewardsTeamPage | `/rewards/team` | Rewards |
| RewardsEqualLevelPage | `/rewards/equal-level` | Rewards |
| RewardsBurnsPage | `/rewards/burns` | Rewards |
| ConfigPage | `/config` | Config |
| ReportsPage | `/reports` | Reports |
| SettlementJobsPage | `/settlement/jobs` | Settlement |
| RecomputePage | `/recompute` | Settlement |
| SystemOverviewPage | `/system` | System |
| ChainSyncPage | `/system/chain-sync` | System |
| HealthPage | `/system/health` | System |
| JobsPage | `/system/jobs` | System |
| LogsPage | `/logs` | System |
| AdminAccountsPage | `/admin-accounts` | Admin |
| LoginPage | `/login` | Auth |
