# Admin UI/UX Remediation Priority

Ranked by severity and user impact. Effort estimates: S (<1h), M (2-4h), L (4-8h).

---

## P0 — data display bugs (fix before any operator uses staging)

| # | ID | Issue | Effort | Fix |
|---|---|---|---|---|
| 1 | UX-01/02/03 | 3 raw ISO date columns in RewardsPage (Team, EqualLevel, Burns) | **S** | Add `render: (v) => <TimeCell value={v} />` to each column def |
| 2 | UX-04 | Full wallet address exposed in UserOverviewTab | **S** | Replace `<code>{identity.walletAddress}</code>` with `<WalletCell value={...} />` |
| 3 | UX-05 | "claimable" status shows as gray neutral in StatusBadge | **S** | Add `claimable: 'ok'` to STATUS_MAP in badges.tsx |
| 4 | COPY-01 | 3 hardcoded English strings in `.tsx` bypassing i18n | **S** | UserQualificationCard, filterFields tier labels, RowActionMenu default |
| 5 | COPY-02 | Duplicate `nav.system` key in both locale files | **S** | Remove duplicate entry |

**Together**: ~2 hours, closes 5 data/copy bugs.

---

## P1 — missing error/empty states (17 pages)

| # | ID | Pages | Effort | Fix |
|---|---|---|---|---|
| 6 | UX-06 to UX-22 | DashboardPage, all 5 RewardsPage sub-pages, SettlementJobsPage, RecomputePage, SystemOverviewPage, ChainSyncPage, HealthPage, JobsPage, LogsPage, ReportsPage, UsersListPage, UserDetailPage, NetworkOverviewPage | **L** | Wrap each query's render in `isLoading ? <Skeleton> : isError ? <InlineError> : data ? <content> : <EmptyHint>` pattern. ~15 min per page × 17 pages. |
| 7 | UX-23 | No role enforcement — viewer sees destructive buttons | **M** | Thread `session.role` from the Shell context; conditionally render action buttons only for `operator` / `super_admin`. |

---

## P2 — display consistency (unified formatting)

| # | ID | Issue | Effort | Fix |
|---|---|---|---|---|
| 8 | UX-25 | `PercentCell` / `formatPercent` never used — all percentages manually computed | **M** | Replace ~7 manual `* 100 + .toFixed()` sites with `formatPercent` or `PercentCell` |
| 9 | UX-24 | Rate precision mismatch (`.toFixed(2)` vs `.toFixed(1)`) | **S** | Standardize to 1 decimal for display, 2 for precision-critical contexts |
| 10 | UX-26/27/28/29 | Raw integer display without `formatInt` / `CountCell` | **M** | Replace raw `String(count)` / `{value}` with `formatInt(value)` across ~8 pages |
| 11 | UX-30 | English-only `formatSecondsAgo` in DashboardPage/SystemPage | **S** | Replace with locale-aware `formatRelativeTime` or `TimeCell mode="relative"` |
| 12 | UX-31/32/33 | Manual `.slice()` for IDs and addresses, missing copy buttons | **M** | Replace with `CopyableHashCell` or `WalletCell` |
| 13 | COPY-03 | ~20 ZH keys with stray English (Claim, Viewer, Leader, tier names) | **M** | Update zh-CN.json values |
| 14 | COPY-04 | ~30 EN keys with inconsistent Title Case vs sentence case | **M** | Standardize to sentence case |

---

## P3 — polish (style, shared primitive adoption)

| # | ID | Issue | Effort | Fix |
|---|---|---|---|---|
| 15 | STYLE-01 | DashboardPage ~25 inline style objects | **M** | Extract to CSS classes using `--px-*` tokens |
| 16 | STYLE-02 | HealthPage + SystemOverviewPage ~35 combined inline styles | **M** | Same |
| 17 | PRIM-01 | `EmptyHint` adoption — 14 pages show antd default "No Data" | **M** | Add `locale={{ emptyText: <EmptyHint ... /> }}` to DataTable where lists can be empty |
| 18 | PRIM-02 | Settlement/Recompute use plain Modal instead of RiskActionModal | **S** | Swap Modal → RiskActionModal with severity="high" |
| 19 | PRIM-03 | Reports create/run have no confirmation gate | **S** | Add RiskActionModal with severity="medium" |
| 20 | COPY-05 | ~5 weak error messages ("Login failed", "Search failed") | **S** | Expand with guidance text |
| 21 | COPY-06 | ~3 noun-based button labels | **S** | Prefix with action verb ("View ...") |

---

## Execution order

### Sprint 1 (1 day) — P0 + P1 error states

1. Fix 5 P0 data/copy bugs (~2h)
2. Add `InlineError` + `EmptyHint` to the 17 pages missing error states (~4h)
3. Add role-based action visibility (~2h)

### Sprint 2 (1 day) — P2 formatting consistency

1. Replace all manual percentage formatting with `PercentCell` / `formatPercent`
2. Replace all raw integer displays with `formatInt` / `CountCell`
3. Fix ZH locale values (~20 keys)
4. Standardize EN casing (~30 keys)

### Sprint 3 (1 day) — P3 polish

1. Inline style extraction (DashboardPage + SystemPages)
2. EmptyHint adoption across all tables
3. RiskActionModal for Settlement/Recompute/Reports
4. Error message expansion + button label fixes

---

## Out of scope for this remediation

- Real-time WebSocket data feeds (feature work, not remediation)
- Dark mode visual polish (theme system exists and works; colors are correctly mapped)
- Dashboard chart visualizations (ECharts integration works; chart-level polish is P3+)
- Mobile responsive layout (admin console is desktop-only by design)
- Accessibility audit (separate workstream)
- Admin account RBAC beyond viewer/operator/super_admin (architecture decision)
