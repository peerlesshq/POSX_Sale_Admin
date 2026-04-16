# Admin Display Standards

Rules for rendering every data type in the admin console. Non-negotiable for staging-RC.

---

## Amounts / Money

| Rule | Implementation |
|---|---|
| Formatter | `AmountCell` component or `formatUsdt()` |
| Decimals | 2 (full) or 1 (compact mode via `formatCompactUsdt`) |
| Prefix | `$` |
| Alignment | Right in tables (`align: 'right'`) |
| Negative | `accent="down"` (red) on `AmountCell` |
| Positive delta | `accent="up"` (green) on `AmountCell` |
| Prohibited | Raw `.toString()`, `.toFixed()`, string interpolation without formatter |

**Current violations**: NetworkPage L130 (raw `.toFixed(2)`), UserOverviewTab L100-103 (raw number display).

---

## Percentages / Rates

| Rule | Implementation |
|---|---|
| Formatter | `PercentCell` component or `formatPercent()` |
| Input | 0-1 scale (NOT 0-100) |
| Decimals | 1 for display, 2 for precision-critical (settlement rates) |
| Suffix | `%` (handled by formatter) |
| Prohibited | Manual `* 100 + .toFixed()` |

**Current violations**: every page renders percentages manually. 0 uses of `formatPercent` or `PercentCell`.

---

## Dates / Times

| Rule | Implementation |
|---|---|
| Component | `TimeCell` with `mode="datetime"` or `mode="relative"` |
| Format | UTC datetime: `MM/DD/YYYY, HH:mm` via `formatDateTimeUtc` |
| Relative | `formatRelativeTime` for "5 min ago" style (with full UTC tooltip) |
| Timezone | All times display in UTC with `(UTC)` indicator |
| Prohibited | Raw ISO string, inline `new Date().toLocaleString()`, English-only relative |

**Current violations**: RewardsPage 3 date columns with no render function (L744, L988, L1244), DashboardPage/SystemPage English-only `formatSecondsAgo`.

---

## Wallet Addresses

| Rule | Implementation |
|---|---|
| Component | `WalletCell` or `CopyableHashCell` |
| Truncation | `0x1234...abcd` (6 head, 4 tail default; 14/10 for detail views) |
| Font | `px-mono` class |
| Copy | Always include copy-to-clipboard button |
| Full display | Never — always truncated with full address in tooltip |
| Prohibited | Raw `<code>{address}</code>`, manual `.slice()`, missing copy button |

**Current violations**: UserOverviewTab L32 (full address), UserOverviewTab L55 / UserTeamTab L79,93 (truncated but no copy button), LogsPage (manual `.slice()`).

---

## Transaction Hashes

| Rule | Implementation |
|---|---|
| Component | `CopyableHashCell` |
| Truncation | `0x1234...abcd` (8 head, 6 tail) |
| Explorer link | `<a href="{EXPLORER_BASE}/tx/{hash}" target="_blank">` when chain config available |
| Font | `px-mono` class |

---

## Status Values

| Rule | Implementation |
|---|---|
| Component | `StatusBadge` with i18n label |
| Color mapping | Defined in `STATUS_MAP` — `ok`=green, `warn`=yellow, `info`=blue, `err`=red, `neutral`=gray |
| Prohibited | Raw text, inline colored `<span>`, CSS class-based status coloring (except tree dot indicators) |

**Missing from STATUS_MAP**: `claimable` (should map to `ok` or `info` tone).

---

## Integers / Counts

| Rule | Implementation |
|---|---|
| Formatter | `CountCell` component or `formatInt()` |
| Thousand separator | Yes (via `Intl.NumberFormat`) |
| Decimals | 0 |
| Prohibited | Raw `{count}`, `String(count)`, `value.toLocaleString('en-US')` |

**Current violations**: AdminAccountsPage KPI counts, UserTreePage KPI values, HealthStatSummary values, SystemPage error counts — all use raw number display.

---

## Color palette

All colors via CSS custom properties:

| Token | Usage |
|---|---|
| `--px-brand` | Primary brand accent |
| `--px-status-ok` | Green — active, completed, success |
| `--px-status-warn` | Yellow — restricted, pending |
| `--px-status-info` | Blue — running, queued, info |
| `--px-status-err` | Red — failed, suspended, blacklisted |
| `--px-text-primary` | Main body text |
| `--px-text-secondary` | Labels, hints |
| `--px-text-tertiary` | Disabled, placeholder |
| `--px-accent-violet` | Secondary accent |
| `--px-surface-*` | Background surfaces |
| `--px-border-*` | Borders |

**Prohibited**: hardcoded hex values (`#3b82f6`), RGB values, `hsl()` in inline styles.
