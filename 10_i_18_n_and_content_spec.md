# POSX Token Sale System — I18N and Content Spec

## 1. Document Control

- Document Name: `10_I18N_And_Content_Spec.md`
- System Name: POSX Token Sale System
- Purpose: Define internationalization behavior, language support, translation source model, dynamic content storage, fallback rules, formatting standards, and content governance for the POSX user frontend and admin panel
- Audience: Frontend engineers, backend engineers, product, operations, QA, content editors, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `04_API_Spec.md`
  - `05_User_Frontend_PRD.md`
  - `06_Admin_Panel_PRD.md`
  - `09_Config_Center_Spec.md`

---

## 2. Purpose and Scope

This document defines how language, translation, and dynamic content must work across the POSX system.

It covers:
- supported languages
- static UI copy management
- dynamic content storage model
- fallback rules
- error-code-to-copy mapping strategy
- formatting rules for numbers, dates, and labels
- content responsibilities between frontend, backend, and admin operations
- user frontend language behavior
- admin panel language behavior

This document aims to ensure that:
- the product is multilingual from the beginning
- static and dynamic content are managed consistently
- missing translations fail gracefully
- backend APIs stay language-neutral where appropriate
- frontend components remain translation-key-driven rather than hardcoded

---

## 3. Supported Languages

The default supported languages in v1 are:
- `zh-CN`
- `zh-TW`
- `en`
- `ko`

These should be treated as the initial supported locale set for both user frontend and admin-rendered content views where applicable.

---

## 4. I18N Design Principles

1. All user-facing static text must be translation-key-based.
2. Backend business APIs should return stable codes and structured data, not hardcoded localized paragraphs.
3. Dynamic content should be stored per language in structured content objects.
4. Missing translations must follow a deterministic fallback path.
5. All formatting should be locale-aware where reasonable but business meaning must stay consistent.
6. Language selection must not alter financial meaning.
7. Error messages should map from backend `error_code` to frontend-localized copy.
8. User-generated or admin-entered content should support per-language versions where business-relevant.
9. Admin operations should be warned when content is missing in some locales.
10. The system should be ready to add more locales later without re-architecting core flows.

---

## 5. Language Selection Model

## 5.1 User Frontend

User frontend must support language selection through:
- manual language switcher in header
- persistence of selected language in local storage or equivalent client preference store

Preferred behavior:
1. use explicit user-selected language if present
2. otherwise use browser-preferred supported language if possible
3. otherwise fall back to `zh-CN`

## 5.2 Admin Panel

Admin panel may use the same language selection logic, but operational clarity should take priority over localization complexity.

Recommended default:
- allow admin UI language switcher
- persist choice locally
- default to `en` or `zh-CN` based on product preference

---

## 6. Static Copy Architecture

## 6.1 Definition

Static copy includes text that ships with frontend code and does not need runtime content management.

Examples:
- button labels
- table headers
- modal titles
- status labels
- helper text
- empty state titles
- route names
- tooltip labels

## 6.2 Storage Model

Static copy should live in frontend i18n resource files, not in backend database.

Recommended structure:

```text
/src/i18n/
  zh-CN.json
  zh-TW.json
  en.json
  ko.json
```

Or modular namespace structure:

```text
/src/i18n/
  user/
    zh-CN.json
    zh-TW.json
    en.json
    ko.json
  admin/
    zh-CN.json
    zh-TW.json
    en.json
    ko.json
  common/
    zh-CN.json
    zh-TW.json
    en.json
    ko.json
```

## 6.3 Namespace Recommendation

Recommended namespaces:
- `common`
- `auth`
- `dashboard`
- `buy`
- `rewards`
- `team`
- `invite`
- `admin.common`
- `admin.dashboard`
- `admin.users`
- `admin.rewards`
- `admin.config`
- `admin.reports`
- `admin.system`
- `errors`

---

## 7. Dynamic Content Architecture

## 7.1 Definition

Dynamic content includes text that should be editable without redeploying frontend code.

Examples:
- announcements
- operational notices
- campaign content
- temporary warnings
- homepage banners if needed

## 7.2 Storage Model

Dynamic content should be stored in the backend as structured multilingual content objects.

Recommended schema pattern:

```json
{
  "zh-CN": "...",
  "zh-TW": "...",
  "en": "...",
  "ko": "..."
}
```

This content may live in `content_entries` or config-managed content groups depending on implementation.

## 7.3 Content Keys

Each dynamic content object should be addressed by:
- `content_group`
- `content_key`

Examples:
- `global_notice / main_banner`
- `buy_page / risk_notice`
- `rewards_page / claim_notice`

## 7.4 Dynamic Content Resolution

Frontend should request dynamic content from public config/content APIs and then select language variant locally according to fallback rules.

---

## 8. Fallback Rules

The fallback chain for dynamic and static content should be:

1. selected locale
2. `zh-CN`
3. `en`
4. last resort raw key or safe placeholder in development only

Recommended production behavior:
- never display raw internal key to end users if avoidable
- prefer fallback language over broken tokenized UI

## 8.1 Missing Translation Policy

If a locale value is missing:
- use fallback language immediately
- optionally log missing translation event in non-production diagnostics

## 8.2 Missing Content Object Policy

If the content object itself is missing:
- hide optional content block if non-critical
- show generic safe default if critical
- raise operational visibility for admins

---

## 9. Backend and API Language Responsibilities

## 9.1 Backend Business APIs

Business APIs should remain language-neutral wherever possible.

They should return:
- structured data
- enums/status values
- `error_code`
- optional generic developer-safe message

They should not return long localized paragraphs as the primary user-facing copy mechanism.

## 9.2 Error Message Strategy

Backend should return stable `error_code` values.
Frontend maps `error_code` to localized copy using i18n resources.

Example:
- backend returns `CLAIM_NOT_ALLOWED`
- frontend maps to localized UI string

## 9.3 Public Content API

Public content APIs may return multilingual blobs, and frontend selects current locale with fallback.

---

## 10. Error Localization Strategy

## 10.1 Source of Truth

`error_code` is the source of truth.

The frontend must maintain an error dictionary such as:

```json
{
  "CLAIM_NOT_ALLOWED": "Claim is currently unavailable for this account",
  "MIN_PURCHASE_NOT_MET": "Minimum purchase amount not met"
}
```

localized per supported language.

## 10.2 Error Categories

Recommended error namespaces in frontend i18n:
- `errors.common`
- `errors.auth`
- `errors.purchase`
- `errors.claim`
- `errors.config`
- `errors.permission`

## 10.3 Unknown Error Fallback

If `error_code` is missing or unmapped:
- show generic localized fallback such as “Something went wrong. Please try again.”
- log unknown code in diagnostics if desired

---

## 11. Status and Enum Localization Strategy

Backend status values should remain stable codes.

Frontend must map these to localized labels.

Examples:

### User Status
- `active`
- `restricted_purchase`
- `restricted_claim`
- `suspended`
- `blacklisted`

### Purchase Order Status
- `created`
- `approval_pending`
- `approval_done`
- `purchase_pending`
- `confirmed`
- `failed`
- `reversed`
- `cancelled`

### Claim Order Status
- `pending_signature`
- `queued`
- `broadcasted`
- `confirmed`
- `failed`
- `cancelled`

These must be translated in frontend dictionaries, not replaced at API level.

---

## 12. Number Formatting Rules

## 12.1 Raw Value Preservation

APIs return numeric values as exact strings.
Frontend should preserve precision internally and format for display without mutating business meaning.

## 12.2 Display Rules

For most UI contexts:
- show grouped thousands
- limit visible decimals contextually
- allow exact value on hover/copy/details when truncated

Examples:
- token price may show up to 4 or more decimals as needed
- balances may show compact view plus exact detail

## 12.3 Locale-aware Formatting

Use locale-aware formatting for presentation where possible, but ensure:
- decimal meaning stays consistent
- copied values remain exact when needed

---

## 13. Date and Time Formatting Rules

## 13.1 Business Rule Reminder

All system business logic uses UTC.

## 13.2 User Frontend Display

User frontend may present times in localized human-readable format, but any business-sensitive text should clarify if the underlying rule is UTC.

Examples:
- “Settlement is based on UTC day boundaries”
- “Pending confirmation refers to current UTC day”

## 13.3 Admin Panel Display

Admin panel should default to UTC display for operational consistency.

Dates and times in admin should be labeled explicitly as UTC.

---

## 14. Currency and Token Label Rules

## 14.1 Stable Business Labels

The following labels should remain consistent across locales:
- `USDT`
- `POSX`
- `UTC`
- wallet address, tx hash, IDs

These labels may appear untranslated or only lightly localized.

## 14.2 Localized Surrounding Text

The explanatory text around these labels should be localized.

---

## 15. Content Ownership Rules

## 15.1 Frontend Team Owns
- static UI translation files
- translation key structure
- error code mappings
- status label mappings

## 15.2 Operations / Product Owns
- dynamic announcements
- runtime notices
- temporary campaign copy
- admin-managed multilingual content entries

## 15.3 Backend Owns
- content API structure
- content retrieval
- content validation and storage
- enforcement of supported locale keys where appropriate

---

## 16. Translation Key Naming Conventions

Keys should be:
- stable
- hierarchical
- semantic
- not coupled to UI placement where possible

Recommended examples:
- `common.actions.copy`
- `common.status.active`
- `dashboard.cards.cumulativeDeposit`
- `buy.form.usdtAmount`
- `rewards.claim.modal.title`
- `admin.users.table.walletAddress`
- `errors.claim.CLAIM_NOT_ALLOWED`

Avoid weak keys like:
- `text1`
- `buttonA`
- `lineTitleNew`

---

## 17. Content Entry Validation Rules

Dynamic content validation should ensure:
- object shape is valid
- supported locale keys are known
- content length limits are reasonable for target slot
- no unexpected unsupported locale keys if strict policy is desired

Recommended policy:
- allow partial locale population
- warn if some locales missing
- do not block optional content publication solely because one translation is absent unless policy requires it

---

## 18. Admin Content Management Requirements

If Admin Panel exposes content editing, it should provide:
- content group and key selectors
- per-language text fields
- preview or raw structured view
- missing-locale warnings
- status indicator (`draft`, `active`, `disabled` if implemented)
- effective date metadata if content scheduling is needed

At minimum, admin should be able to read which multilingual content is live.

---

## 19. Frontend Behavior for Missing Content

## 19.1 Optional Blocks

If optional dynamic content is missing:
- hide block cleanly
- avoid broken card layout or empty shells

## 19.2 Critical Notices

If a critical notice is missing in selected locale:
- use fallback locale
- do not suppress safety-critical message purely due to translation gap

---

## 20. Accessibility and Readability Rules

1. Text length may vary by language, so layouts must handle expansion.
2. Buttons and cards must not assume English-only string lengths.
3. Critical warnings should be concise and readable in all supported locales.
4. Avoid embedding text in images for primary UI copy.
5. Truncation should be avoided for critical financial or status messages.

---

## 21. Suggested Static Translation Domains

Recommended file/domain breakdown:

### Common
- app name
- buttons
- labels
- statuses
- copy helpers
- timestamps

### User Frontend
- auth
- dashboard
- buy
- rewards
- team
- invite
- modals
- empty states
- banners

### Admin Panel
- admin.auth
- admin.dashboard
- admin.users
- admin.rewards
- admin.config
- admin.reports
- admin.settlement
- admin.system
- admin.logs
- admin.accounts

### Errors
- common errors
- auth errors
- purchase errors
- claim errors
- config errors
- permission errors

---

## 22. Suggested Dynamic Content Slots

Recommended dynamic content slots for v1 or near-future use:
- global app notice
- buy page notice
- rewards page notice
- maintenance banner
- temporary campaign message
- chain sync delay notice if operationally needed

Each should support multilingual content values.

---

## 23. Example Dynamic Content Object

```json
{
  "content_group": "global_notice",
  "content_key": "main_banner",
  "content_value": {
    "zh-CN": "系统结算按 UTC 时间进行，请留意每日结算时间。",
    "zh-TW": "系統結算按 UTC 時間進行，請留意每日結算時間。",
    "en": "Settlement is based on UTC day boundaries. Please note the daily settlement timing.",
    "ko": "정산은 UTC 기준 일자에 따라 진행됩니다. 일일 정산 시간을 확인해 주세요."
  }
}
```

---

## 24. Locale Persistence Rules

Recommended client persistence:
- store selected locale locally per app/browser
- do not require backend persistence in v1

Optional later enhancement:
- store preferred locale server-side for authenticated users

---

## 25. Testing Requirements for I18N

QA should verify at minimum:

1. user can switch among supported languages
2. language choice persists across refreshes
3. missing translation falls back correctly
4. error codes display localized copy
5. status labels display localized copy
6. dynamic content renders the right locale variant
7. unsupported browser locale falls back correctly
8. layouts do not break with longer strings
9. UTC-sensitive messaging remains clear across locales

---

## 26. Acceptance Criteria

This document is correctly implemented when all are true:

1. supported languages are available across user frontend and admin UI where intended
2. static UI text is translation-key-driven rather than hardcoded in components
3. dynamic content supports per-language storage and runtime selection
4. missing translations follow a deterministic fallback chain
5. backend returns stable codes and structured data instead of embedding full localized business prose
6. error messages are localized on frontend via `error_code` mapping
7. status and enum values are localized on frontend through dictionaries
8. numbers and timestamps are formatted consistently without changing business meaning
9. dynamic content can be managed without redeploying frontend code
10. layouts remain usable across supported locales

---

## 27. Next Documents

The next implementation documents should be:
- `11_Reporting_And_Metrics_Definition.md`
- `12_Test_Cases.md`
- `13_Seed_Data_And_Mock_Data.md`

These define metric semantics, test coverage, and sample data on top of the multilingual/content model.

