# i18n Remediation Plan

> Last updated: 2026-04-16

## What was fixed in this pass

### 1. Missing admin-web locale keys (93 keys)

Both `en.json` and `zh-CN.json` now contain all keys. Categories covered:
dashboard KPIs, reward sub-pages, config detail/create flow, settlement,
recompute, system health, audit logs, admin accounts, user detail tabs,
status labels, tier labels, time formatting, and severity labels.

### 2. Missing user-web locale keys (16 keys)

Added to both `en.json` and `zh-CN.json`: buy error states, wallet error
messages, claim states, restricted-account banners, and `status.active`.

### 3. Hardcoded English strings in admin-web (6 instances)

| Location | What | Fix |
|---|---|---|
| `relativeSeconds()` helper | "just now", "{n}s ago", etc. | Replaced with `t("time.just_now")`, `t("time.seconds_ago", ...)` |
| `TrendChart` tooltip | "Deposit", "Reward", "Burn" | Replaced with `t("dashboard.series.*")` |
| `DonutChart` center | "24h reward mix" | Replaced with `t("dashboard.reward_mix.center_label")` |
| `TeamStructurePage` | Literal "Peer" badge | Replaced with `t("network.team.peer")` |

### 4. Hardcoded English strings in user-web (11 instances)

| Location | What | Fix |
|---|---|---|
| `BuyPage` | "Token price", "Min purchase", button text | Replaced with `t("buy.*")` keys |
| `useClaimAll` hook | Status strings for each claim step | Replaced with `t("rewards.claim.*")` keys |
| `wallet.ts` | "No wallet detected", "Sign-in failed" | Replaced with `t("wallet.*")` keys |
| `Layout` | Nav labels, footer text | Replaced with `t("nav.*")` keys |

### 5. Language picker

Both apps' language selectors now show human-readable names from locale keys
(`locale.en`, `locale.zh_CN`, etc.) instead of raw codes.

### 6. Cross-app status terminology

Added `status.active` ("Active" / "正常") to user-web to match admin-web.
Burn terminology standardized to 销毁 in both apps.

---

## Remaining follow-up items

### P1 -- zh-TW and ko locales (148 keys each)

`apps/user-web/src/i18n/zh-TW.json` and `ko.json` contain only 58 of 206
keys (28% complete). The missing 148 keys per locale must be translated.

**Suggested approach:**
1. Export the en.json keys not present in zh-TW / ko.
2. Run through a professional translator or LLM-assisted pass.
3. Have a native speaker review before merging.

### P2 -- Raw API error messages (13 locations in admin-web)

Thirteen toast calls pass `error.message` (English backend text) directly to
the user. Each should be wrapped with `t("errors.<domain>.<action>_failed")`
and the raw message logged to console.

Affected areas (approximate):
- User status change
- Config create / update
- Settlement trigger
- Recompute apply
- Admin account CRUD
- Export creation
- Health check refresh

### P3 -- ErrorBoundary raw error display

Both apps render `error.message` from the JS runtime. This is always English.
Low priority because error boundaries are last-resort UI, but could be wrapped
with a generic translated message while logging the original.

### P4 -- aria-label strings

Approximately 5 `aria-label` attributes use English-only strings. These are
useful for screen readers and acceptable, but for a fully localized experience
they should use `t()`.

### P5 -- Locale file tooling

Consider adding:
- A CI lint step that asserts all locale files have identical key sets.
- A script to diff keys between en.json and other locales.
- An automated translation pipeline for new keys added to en.json.
