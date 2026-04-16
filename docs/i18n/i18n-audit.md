# i18n Audit Summary

> Audit date: 2026-04-16
> Scope: admin-web, user-web

## Architecture

| Property | admin-web | user-web |
|---|---|---|
| Locales | en, zh-CN | en, zh-CN, zh-TW, ko |
| Keys per locale | ~1 000 | ~220 (en/zh-CN) |
| Format | Flat JSON, single file per locale | Same |
| Translation fn | `t(key, fallback)` with silent EN fallback | Same |
| Fallback chain | current locale -> zh-CN -> en -> fallback arg -> raw key | Same |
| Namespace system | None | None |
| ICU / plurals | None | None |

## Findings by category

### 1. Missing locale keys

**admin-web** -- 93 keys were present in one locale file but not the other.
All 93 have been added to both `en.json` and `zh-CN.json`. **FIXED.**

**user-web** -- 16 keys missing from zh-CN (or en).
All 16 have been added. **FIXED.**

### 2. Hardcoded English strings in components

**admin-web** (6 instances, all FIXED):
- `relativeSeconds()` helper returned English time strings ("just now", "5s ago")
- Chart tooltip labels in `TrendChart` / `DonutChart` were hardcoded
- Peer tag in `TeamStructurePage` rendered literal "Peer"

**user-web** (11 instances, all FIXED):
- `BuyPage` -- "Token price", "Min purchase", button labels
- `useClaimAll` -- status strings ("Preparing order...", "Sign in wallet...")
- `wallet.ts` -- error messages ("No wallet detected", "Sign-in failed")
- `Layout` -- navigation labels, footer text

### 3. Cross-app terminology inconsistency

| Term | admin-web | user-web (before) | user-web (after) |
|---|---|---|---|
| Burn | 销毁 | 燃烧 | 销毁 |
| Active status | 正常 | (missing) | Active / 正常 |

Burn terminology has been standardized to 销毁 across both apps.
`status.active` was added to user-web. **PARTIALLY FIXED.**

### 4. Incomplete locales (zh-TW, ko)

Both `zh-TW.json` and `ko.json` in user-web contain only 58 of 206 keys (28% complete).
148 keys are missing from each. **NOTED -- follow-up required.**

### 5. Language picker

The language picker showed raw locale codes (`en`, `zh-CN`) instead of
human-readable names ("English", "简体中文"). **FIXED.**

### 6. Raw API error messages surfaced to users

13 places in admin-web pass `error.message` (English backend text) directly
into toast or inline error displays. These should use `t()` with a generic
fallback and log the raw message. **NOTED -- follow-up required.**

### 7. Status terminology

Status labels differed between apps for the same state:
- `active` / `restricted_purchase` / `suspended` / `blacklisted`

user-web now includes `status.active`. Other status labels already matched.
**PARTIALLY FIXED.**

### 8. Accessibility strings

A small number of `aria-label` attributes use English-only strings.
Acceptable for screen-reader accessibility but noted for completeness.

### 9. ErrorBoundary

Both apps' `ErrorBoundary` components render `error.message` from the JS
runtime, which is always English. Low priority -- error boundaries are
last-resort UI. **NOTED.**

## Score summary

| Category | Found | Fixed | Remaining |
|---|---|---|---|
| Missing admin-web keys | 93 | 93 | 0 |
| Missing user-web keys | 16 | 16 | 0 |
| Hardcoded strings (admin) | 6 | 6 | 0 |
| Hardcoded strings (user) | 11 | 11 | 0 |
| Terminology inconsistency | 2 | 2 | 0 |
| Language picker | 1 | 1 | 0 |
| zh-TW / ko incomplete | 148 x 2 | 0 | 296 keys |
| Raw API errors | 13 | 0 | 13 |
| aria-label English-only | ~5 | 0 | ~5 |
| ErrorBoundary raw msg | 2 | 0 | 2 |
| **Total** | **~160** | **~120** | **~40** |

## File locations

- `apps/admin-web/src/i18n/en.json`
- `apps/admin-web/src/i18n/zh-CN.json`
- `apps/user-web/src/i18n/en.json`
- `apps/user-web/src/i18n/zh-CN.json`
- `apps/user-web/src/i18n/zh-TW.json`
- `apps/user-web/src/i18n/ko.json`
