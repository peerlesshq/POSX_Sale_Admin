# Admin UI/UX Full Audit

Page-by-page findings against the rubric in `admin-uiux-audit-rubric.md`.

---

## Critical findings (S0 — data display bugs)

| # | Page | Issue |
|---|---|---|
| UX-01 | RewardsPage (Team) | Date column (L744) has NO render function — raw ISO string `2024-01-15T08:30:00Z` displayed in table |
| UX-02 | RewardsPage (EqualLevel) | Same: date column (L988) — raw ISO string |
| UX-03 | RewardsPage (Burns) | Same: date column (L1244) — raw ISO string |
| UX-04 | UserOverviewTab | Full wallet address displayed via `<code>{identity.walletAddress}</code>` (L32) — no truncation, no copy button |
| UX-05 | StatusBadge | "claimable" status not in STATUS_MAP — falls through to gray neutral instead of a meaningful color (should be blue/info or green/ok) |

---

## State handling gaps (S1 — missing states)

| # | Page | Missing state | Detail |
|---|---|---|---|
| UX-06 | DashboardPage | Error state | No `InlineError` on any of the 4+ queries; errors silently swallowed |
| UX-07 | RewardsOverviewPage | Error state | Same — no error handling on overview query |
| UX-08 | RewardsDirectPage | Error + Empty | No error handler; empty table shows antd default "No Data" instead of `EmptyHint` |
| UX-09 | RewardsTeamPage | Error + Empty | Same pattern |
| UX-10 | RewardsEqualLevelPage | Error + Empty | Same pattern |
| UX-11 | RewardsBurnsPage | Error + Empty | Same pattern |
| UX-12 | SettlementJobsPage | Error state | No error handler on jobs query |
| UX-13 | RecomputePage | Error state | No error handler on preview/apply results |
| UX-14 | SystemOverviewPage | Error state | No error handler on the 5+ queries |
| UX-15 | ChainSyncPage | Error state | No error handler |
| UX-16 | HealthPage | Error state | No error handler |
| UX-17 | JobsPage | Error state | No error handler |
| UX-18 | LogsPage | Error state | No error handler |
| UX-19 | ReportsPage | Error state | No error handler on list query |
| UX-20 | UsersListPage | Error state | No error handler |
| UX-21 | UserDetailPage | Error state | No error handler on the main detail query |
| UX-22 | NetworkOverviewPage | Error state | No error handler |
| UX-23 | ALL except ConfigPage | Permission-denied | No role check; viewer sees every destructive button |

---

## Display inconsistencies (S2)

| # | Page | Type | Issue |
|---|---|---|---|
| UX-24 | NetworkTeamPage | Rates | `.toFixed(2)` on L519 vs `.toFixed(1)` on L635 — same data type, different precision |
| UX-25 | All pages | Percentages | `formatPercent` / `PercentCell` exists but is NEVER used — all percentages manually computed with `* 100 + .toFixed()` |
| UX-26 | NetworkPage | Amounts | L130: raw `.toFixed(2)` instead of `formatUsdt` — no `$` prefix, no thousand separators |
| UX-27 | AdminAccountsPage | Integers | L258-280: KPI counts via `String(kpis.total)` — no `formatInt`, no thousand separators |
| UX-28 | UserTreePage | Integers | L698-720: KPI values as raw numbers — no `formatInt` |
| UX-29 | UserKpiStrip | Locale | L103: hardcoded `'en-US'` in `toLocaleString` instead of locale-aware `formatInt` |
| UX-30 | DashboardPage | Time | `formatSecondsAgo` inline helper produces English-only strings, ignores i18n locale |
| UX-31 | LogsPage | IDs | admin_user_id and target_id truncated with manual `.slice()` — no `CopyableHashCell`, no copy button |
| UX-32 | UserOverviewTab | Addresses | Referrer address uses inline `truncateHash()` in `<code>` — no copy button |
| UX-33 | UserTeamTab | Addresses | Upline path uses inline `truncateHash()` in `<code>` — no copy button |

---

## Inline style proliferation (S3)

| Page | Approx. inline style objects | Worst offenders |
|---|---|---|
| DashboardPage | ~25 | Grid layouts, hover handlers via `onMouseEnter`/`onMouseLeave` |
| HealthPage | ~20 | Stat cards, gauge visualizations |
| SystemOverviewPage | ~15 | KPI rows, status indicators |
| ChainSyncPage | ~15 | Contract cards, sync status |
| AdminAccountsPage | ~12 | KPI strip, drawer body |
| NetworkTeamPage | ~10 | Tree node rendering |
| All other pages | 3-8 each | — |

---

## Shared primitive adoption

### Well-adopted primitives (used on 10+ pages)

`DataTable`, `SectionCard`, `PageHeader`, `FilterBar`, `StatusBadge`, `KpiStatCard`, `TimeCell`, `AmountCell`, `WalletCell`, `CountCell`

### Under-adopted primitives (exist but rarely used)

| Primitive | Pages using it | Pages that should |
|---|---|---|
| `PercentCell` | 0 | NetworkTeamPage, RewardsPage, UserOverviewTab, UserTeamTab |
| `EmptyHint` | 3 (ConfigPage, AdminAccountsPage, Reports) | Every paginated list (UsersListPage, Rewards sub-pages, SettlementJobs, Jobs, Logs) |
| `InlineError` | 2 (ConfigPage, NetworkTeamPage) | Every page with a query (17 pages currently silently swallow errors) |
| `ErrorState` | 1 (ConfigPage) | — replaced by `InlineError` in practice |

### Pages with legacy/inline reimplementations

| Page | Legacy pattern | Should use |
|---|---|---|
| DashboardPage | Inline KPI grid with `<div style={...}>` | `KpiStatCard` or `KpiDeltaCard` (partially adopted) |
| SystemOverviewPage | Inline `KpiRow` function component | `KpiStatCard` |
| HealthPage | Inline `HealthStatSummary` with raw styled divs | `KpiStatCard` + `StatusBadge` |

---

## Risk action coverage

| Destructive action | Page | Uses RiskActionModal? | Severity set? | Reason required? |
|---|---|---|---|---|
| Update user status | UsersPage (detail) | ✅ | ✅ high | ✅ |
| Create admin | AdminAccountsPage | ✅ | ✅ high | ✅ (Pass 2) |
| Update admin role/status | AdminAccountsPage | ✅ | ✅ high/medium | ✅ (Pass 2) |
| Disable admin | AdminAccountsPage | ✅ | ✅ high | ✅ |
| Rotate admin session | AdminAccountsPage | ✅ | ✅ medium | ✅ (Pass 2) |
| Create config version | ConfigPage | ✅ | ✅ high | ✅ (Pass 2) |
| Trigger settlement | SettlementPage | ⚠️ plain Modal | ❌ | ✅ |
| Recompute apply | RecomputePage | ⚠️ plain Modal | ❌ | ✅ |
| Create report export | ReportsPage | ❌ none | — | — |
| Run report export | ReportsPage | ❌ none | — | — |

---

## Summary: pages by readiness

| Readiness | Pages |
|---|---|
| **Good** (passes most rubric items) | AdminAccountsPage, ConfigPage, LoginPage |
| **Fair** (functional but missing error/empty states) | UsersListPage, UserDetailPage, SettlementJobsPage, NetworkTeamPage |
| **Needs work** (multiple rubric failures) | DashboardPage, RewardsPage (all 5 sub-pages), ReportsPage, RecomputePage, SystemOverviewPage, HealthPage, ChainSyncPage, JobsPage, LogsPage, NetworkOverviewPage, UserTreePage |
