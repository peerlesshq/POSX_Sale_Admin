# POSX Token Sale System — User Frontend PRD

## 1. Document Control

- Document Name: `05_User_Frontend_PRD.md`
- System Name: POSX Token Sale System
- Scope: User-facing web frontend only
- Audience: Frontend engineers, full-stack engineers, designers, QA, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `07_State_Machines_And_Exception_Flows.md`
  - `10_I18N_And_Content_Spec.md`

---

## 2. Product Objective

The user frontend is the wallet-based operating surface for POSX buyers and promoters.

Its responsibilities are to let users:
- connect TP Wallet and authenticate
- understand current account status
- purchase POSX with USDT
- track lockup and vesting status
- view direct, team, and equal-level rewards
- understand burn status and pending confirmation values
- inspect team growth and invite performance
- claim eligible off-chain rewards safely

The frontend must be:
- mobile-first
- clear for non-technical users
- consistent with backend calculations
- safe against misleading display of estimated vs finalized values

---

## 3. Design Principles

1. **Backend is the authority.** Frontend never reimplements settlement formulas.
2. **Mobile-first first, desktop-adaptive second.**
3. **Status clarity matters more than density.**
4. **Financial values must always be explicit.**
5. **Estimated values must be visibly labeled.**
6. **Every action must show current status, loading state, and result state.**
7. **Wallet interaction steps must be obvious and sequential.**
8. **Important restrictions must surface before user action, not after failure.**
9. **All copy must be i18n-ready.**
10. **Dark mode and light mode must both be supported.**

---

## 4. Frontend Technical Scope

### 4.1 Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- TP Wallet-compatible wallet connection flow
- React Query or equivalent server-state library
- Router-based SPA structure
- i18n library for static copy

### 4.2 Supported Platforms

- mobile web as primary target
- desktop web as adaptive target

### 4.3 Authentication Model

- connect TP Wallet
- request nonce
- sign login message
- receive user session token
- store session token securely in frontend session layer

---

## 5. Frontend Information Architecture

Primary routes:

- `/dashboard`
- `/buy`
- `/rewards`
- `/my-team`
- `/invite`

System-level surfaces:

- connect wallet modal
- sign message modal state
- claim modal
- global status banner
- language switcher
- theme switcher
- not-found page
- maintenance / service degradation banner if needed

---

## 6. Global App Structure

## 6.1 App Shell

The app shell contains:
- top header
- route content area
- bottom tab navigation on mobile
- side navigation on desktop
- global notification/toast layer
- modal portal

### 6.2 Header

Header must include:
- POSX logo
- current page title
- theme toggle
- language selector
- wallet/account button

Connected wallet button states:
- disconnected: `Connect Wallet`
- connected but unauthenticated: `Sign In`
- authenticated: shortened wallet address + status badge if restricted

### 6.3 Mobile Navigation

Bottom navigation tabs:
- Dashboard
- Buy
- Rewards
- Team
- Invite

### 6.4 Desktop Navigation

Left sidebar or equivalent:
- Dashboard
- Buy
- Rewards
- Team
- Invite

### 6.5 Global Status Banner

Show a banner when relevant for:
- restricted claim
- restricted purchase
- suspended or blacklisted account
- service degradation
- chain sync delay affecting display freshness

---

## 7. Global Data Dependencies

The frontend should centrally fetch and cache:

- public config via `GET /api/v1/config/public`
- user profile via `GET /api/v1/user/profile`
- dashboard data via `GET /api/v1/user/dashboard`
- reward overview via `GET /api/v1/rewards/overview`
- team overview via `GET /api/v1/team/overview`
- invite data via `GET /api/v1/invite`

These should feed common UI elements such as:
- tier badge
- account status badge
- total claimable badge
- invite unlocked status

---

## 8. Global Status, Loading, and Empty State Rules

## 8.1 Loading Rules

Every page must support:
- initial skeleton state
- refresh state
- action-level loading state

Do not block the whole screen for a small mutation if local component loading is sufficient.

## 8.2 Empty State Rules

Empty states must be explicit and friendly.

Examples:
- no purchases yet
- no claimable rewards yet
- no referrals yet
- no vesting lots yet

### 8.3 Error State Rules

Each page must support:
- recoverable inline error state
- retry action where appropriate
- general failure fallback

### 8.4 Data Freshness Notes

For values that may lag due to confirmation or daily settlement, show helper text such as:
- “Updated from confirmed on-chain data”
- “Estimated until UTC settlement completes”

---

## 9. Authentication and Wallet UX

## 9.1 Connect Flow

Entry points:
- header wallet button
- purchase page CTA when disconnected
- claim action if not authenticated

Connect flow:
1. user clicks connect
2. wallet modal opens
3. TP Wallet selected
4. wallet connects
5. app requests nonce
6. user signs login message
7. session token stored
8. user lands on current intended route

### 9.2 Disconnect Flow

User may disconnect from account menu.

Disconnect should:
- clear user session token
- clear user-specific cached data
- keep public config cached

### 9.3 Auth Guards

Protected routes:
- `/dashboard`
- `/buy`
- `/rewards`
- `/my-team`
- `/invite`

If unauthenticated:
- show connect/auth prompt instead of full broken page

### 9.4 Restricted User Messaging

If user is:
- `restricted_purchase`: disable buy action and explain why
- `restricted_claim`: disable claim action and explain why
- `suspended` or `blacklisted`: app remains readable but action surfaces are disabled and prominent notice is shown

---

## 10. Dashboard Page PRD

Route:
- `/dashboard`

Goal:
- provide a concise, trustworthy overview of account, rewards, vesting, burn status, and recent activity

## 10.1 Data Sources

- `GET /api/v1/user/dashboard`
- `GET /api/v1/user/profile`

## 10.2 Page Sections

### A. Overview Cards
Display:
- cumulative deposit
- holding value (USDT)
- current tier
- locked POSX total
- referral count

Each card shows:
- title
- primary value
- optional helper text

### B. Claimable Rewards Card
Display:
- team claimable
- equal-level claimable
- adjustment credit claimable
- total claimable
- primary CTA: `Claim All`

Rules:
- if total claimable below min claim amount, CTA disabled and helper text shown
- if user status blocks claim, CTA disabled and reason shown

### C. Reward Summary Module
Display:
- direct total
- team total
- equal-level total
- burned total

This is historical cumulative overview, not claimable balance.

### D. Burn Status Card
Display differently based on burn state.

If burn disabled:
- show “Burn cap inactive”
- show holding value and threshold

If burn enabled:
- show holding value
- burn cap
- used burn capacity
- remaining burn capacity
- progress bar
- burned total

### E. Vesting Summary Card
Display:
- total locked
- total released
- total withdrawable
- total withdrawn
- CTA: `View Vesting Details` (anchors to Buy page vesting tab or opens details section)

### F. Recent Purchases
Display latest 5 purchases:
- purchase date/time
- USDT amount
- POSX amount
- price at purchase

### G. Account Info Card
Display:
- full wallet address with copy action
- referrer address or “Not bound”
- referral bound status
- reward qualification
- team reward qualification

## 10.3 CTA Rules

Main CTAs:
- Claim All
- Buy More POSX
- View Rewards
- View Team

### 10.4 Loading State

- overview skeleton cards
- recent purchases table skeleton

### 10.5 Empty State

If no purchases:
- show onboarding empty state
- CTA: `Buy POSX`

### 10.6 Error State

If dashboard API fails:
- show inline retry panel

---

## 11. Buy Page PRD

Route:
- `/buy`

Goal:
- support POSX purchase flow and vesting visibility in one place

Tabs:
- `Buy POSX`
- `Vesting`

## 11.1 Data Sources

- `GET /api/v1/config/public`
- `GET /api/v1/user/profile`
- `GET /api/v1/vesting`
- purchase mutation APIs

## 11.2 Buy POSX Tab

### A. Price and Rules Summary
Display:
- current token price
- minimum purchase amount
- quick amount options
- current tier
- next tier goal

### B. Purchase Form
Fields:
- USDT amount input
- quick amount buttons
- optional referral code display if pending capture exists client-side

Derived display from backend/public config:
- expected POSX amount
- current token price
- current tier and next tier helper

Actions:
- `Approve USDT` or wallet approval step messaging
- `Buy POSX`

### C. Purchase Process UI
The page must display multi-step progress:
1. order created
2. approval requested
3. purchase tx submitted
4. awaiting confirmations
5. purchase confirmed

Each stage must have visible status.

### D. Current Status Summary
Display:
- cumulative deposit
- holding value
- current tier
- reward qualification
- team reward qualification

### E. Restriction Handling
If user is `restricted_purchase`, disable buy actions and show message.

## 11.3 Buy Flow UX

When user clicks buy:
1. validate amount client-side
2. call `POST /purchases/orders`
3. if success, open wallet flow guidance
4. after user submits chain tx, attach tx hash with `POST /purchases/orders/{id}/tx`
5. poll purchase order status until terminal or user exits

### 11.4 Buy Success State
Show success panel with:
- confirmed purchase id
- amount spent
- POSX received into vesting
- CTA to view dashboard
- CTA to view vesting

### 11.5 Buy Failure State
Handle distinct cases:
- approval success but purchase not submitted
- purchase tx failed
- purchase pending too long
- backend recovery needed

Support secondary action:
- `Recover by Tx Hash`

## 11.6 Vesting Tab

### A. Vesting Summary
Display:
- total locked
- total released
- total withdrawable
- total withdrawn

### B. Vesting Lot List
Each lot row shows:
- lot id or purchase reference
- start time
- total locked
- released amount
- withdrawable amount
- withdrawn amount
- status

### C. Progress Display
Show per-lot and overall release progress bars.

### D. Notes Area
Explain:
- each purchase creates a separate vesting lot
- lock period
- release period
- displayed values are based on synced vesting data

### E. Empty State
If no lots:
- show “No vesting lots yet” with CTA to buy

---

## 12. Rewards Page PRD

Route:
- `/rewards`

Goal:
- allow users to understand historical rewards, claimable balances, and claim history

Tabs:
- `Overview`
- `Direct Rewards`
- `Team Rewards`
- `Equal-Level Rewards`
- `Claim History`

## 12.1 Data Sources

- `GET /api/v1/rewards/overview`
- `GET /api/v1/rewards/direct`
- `GET /api/v1/rewards/team`
- `GET /api/v1/rewards/equal-level`
- `GET /api/v1/rewards/claims`
- claim APIs

## 12.2 Overview Tab

Display:
- team claimable
- equal-level claimable
- adjustment credit claimable
- total claimable
- direct total
- team total
- equal-level total
- burned total

Primary CTA:
- `Claim All`

## 12.3 Direct Rewards Tab

List columns:
- from wallet masked
- purchase amount
- reward rate
- reward amount
- rewarded at
- tx hash link/copy

Notes:
- mark as on-chain
- no burn applies

## 12.4 Team Rewards Tab

List columns:
- settle date
- qualification tier
- user team rate
- effective performance
- raw total
- burned amount
- actual total
- status
- action: `View Detail`

Detail drawer/modal/page shows line details.

## 12.5 Equal-Level Rewards Tab

List columns:
- settle date
- line root wallet masked
- equal-level rate
- line effective performance
- raw amount
- burned amount
- actual amount
- status

## 12.6 Claim History Tab

List columns:
- claim record id
- claim order id
- amount
- tx hash
- status
- recorded at

## 12.7 Claim All Flow

Trigger:
- overview tab CTA or dashboard CTA

Steps:
1. create claim order
2. show preview modal with included items and total
3. user signs
4. show queued/broadcast state
5. poll claim order status
6. success or failure result

### Claim Modal States
- preparing order
- ready to sign
- signing in wallet
- queued
- broadcasted
- confirmed
- failed

### Disabled Conditions
- no claimable amount
- below minimum claim amount
- restricted claim status
- active non-terminal claim already exists

---

## 13. Team Page PRD

Route:
- `/my-team`

Goal:
- help users understand team growth, team reward status, pending confirmation, and member structure without exposing unlimited sensitive detail

Tabs:
- `Overview`
- `Daily Details`
- `Members`

## 13.1 Data Sources

- `GET /api/v1/team/overview`
- `GET /api/v1/team/daily-details`
- `GET /api/v1/team/members`

## 13.2 Overview Tab

Cards:
- team total performance
- today effective performance
- claimable amount
- pending confirmation amount
- total received
- total claimed

Current team rate card:
- current team rate
- current tier
- next rate target
- remaining needed
- progress visualization

Explain “Pending Confirmation” clearly:
- estimated reward for current UTC day
- not yet claimable
- may change until settlement finalization

## 13.3 Daily Details Tab

List columns:
- date
- effective performance
- team rate
- team raw amount
- equal-level raw amount
- burned amount
- actual amount
- status (`settled` / `pending_confirmation`)

This tab gives daily operational clarity, not low-level full settlement audit.

## 13.4 Members Tab

Default behavior:
- show detailed rows for direct members
- show aggregates for deeper levels

Visible fields per direct member:
- masked wallet address
- level
- joined at
- cumulative deposit
- current tier
- direct referral count
- status

Aggregates section:
- level
- member count
- active count
- new performance
- cumulative performance

Filtering:
- by level
- search on masked/direct members only as permitted by backend

### Privacy Rules
- never show full wallet addresses for non-direct descendants in user view
- never show exact claimable balances of team members
- never show admin-only flags

---

## 14. Invite Page PRD

Route:
- `/invite`

Goal:
- let users understand invite eligibility, copy/share invite link, and track direct referral performance

## 14.1 Data Sources

- `GET /api/v1/invite`
- `GET /api/v1/invite/referrals`

## 14.2 Invite Locked State

If invite not unlocked:
- show unlock threshold
- show current cumulative deposit
- show progress bar
- CTA: `Buy POSX`

## 14.3 Invite Unlocked State

Display:
- invite link
- referral code
- copy action
- share action if supported by browser
- referral count
- total referral deposit
- active referral count

## 14.4 Direct Referral List

Columns:
- masked wallet address
- bound at
- cumulative deposit
- current tier
- status

## 14.5 Helper Messaging

Explain:
- referral is bound on first successful purchase
- once bound, referral cannot be changed

---

## 15. Claim Interaction UX Specification

## 15.1 Entry Points

- dashboard
- rewards overview

## 15.2 Pre-Claim Validation

Before opening sign step, UI should confirm:
- user is authenticated
- claim not blocked by user status
- claimable total > 0
- claimable total >= minimum claim amount

## 15.3 Claim Preview Modal

Display:
- claim order id (or short reference)
- total claimable amount in this order
- breakdown by reward type
- note that wallet signature is required

Actions:
- Cancel
- Sign Claim

## 15.4 In-Progress UX

While claim is running:
- keep modal/state open
- show step progress
- do not let user create another claim order

## 15.5 Success UX

Show:
- amount claimed
- tx hash
- time
- CTA to view claim history

## 15.6 Failure UX

Show:
- failure reason if safe to display
- CTA to retry when appropriate
- CTA to refresh status

---

## 16. Purchase Interaction UX Specification

## 16.1 Step Labels

Recommended labels:
- Create Order
- Approve USDT
- Submit Purchase
- Waiting for Confirmation
- Purchase Confirmed

## 16.2 Persistent Pending State

If user leaves the page during pending purchase:
- the app should recover the in-flight purchase order state when returning if possible
- latest pending order can be surfaced in dashboard/banner

## 16.3 Recovery Flow UX

Provide a small utility panel:
- paste tx hash
- call recovery API
- show recovery status

---

## 17. Global Components Specification

## 17.1 Tier Badge

Display values:
- none
- basic
- advanced
- elite

Should be reusable across pages.

## 17.2 Account Status Badge

Display values:
- active
- restricted_purchase
- restricted_claim
- suspended
- blacklisted

Should include tooltip or helper copy.

## 17.3 Amount Display Component

Requirements:
- supports big-number string input
- locale-aware formatting for display
- exact value accessible if truncated visually

## 17.4 Wallet Address Component

Requirements:
- mask by default in most list contexts
- full display in personal account context
- copy support

## 17.5 Empty State Component

Reusable component for:
- no purchases
- no rewards
- no referrals
- no vesting lots

## 17.6 Table/List Component Rules

For mobile:
- use stacked cards when wide tables are impractical

For desktop:
- use table layouts where data density helps readability

---

## 18. Route-Level Data Fetching Strategy

## 18.1 Dashboard
- prefetch profile and dashboard summary after login

## 18.2 Buy
- fetch public config + profile immediately
- fetch vesting only when vesting tab is opened or prefetched after idle

## 18.3 Rewards
- fetch overview immediately
- tab content lazy-loaded per tab with cache

## 18.4 Team
- fetch overview immediately
- members and daily details lazy-loaded per tab

## 18.5 Invite
- fetch invite overview immediately
- referral list lazy-loaded or loaded with first page

---

## 19. Caching and Refresh Rules

## 19.1 Short-Lived Cache

Use short TTL or background refresh for:
- dashboard
- reward overview
- team overview
- invite overview

## 19.2 Polling Use Cases

Polling allowed for:
- purchase order pending confirmation
- claim order in queued/broadcasted state

### Suggested Polling
- 3 to 5 seconds during active in-flight operations
- stop when terminal state reached

## 19.3 Manual Refresh

Pages should support pull-to-refresh on mobile or visible refresh action where appropriate.

---

## 20. Validation Rules on Frontend

Frontend validation is for UX only and does not replace backend enforcement.

### 20.1 Purchase Form
- amount required
- numeric only
- min purchase threshold check
- positive value only

### 20.2 Claim Flow
- no manual amount entry in claim-all flow
- ensure claim order exists before sign step

### 20.3 Search and Filters
- sanitize search input
- preserve filter state in route query when useful

---

## 21. Accessibility and Usability Requirements

1. Buttons and interactive rows must have clear touch targets.
2. Critical status text must not rely on color alone.
3. Error messages must be readable and specific.
4. Long numeric values should be copyable or expandable.
5. Modals must be keyboard accessible on desktop.
6. Important transaction states must be visible without scrolling excessively.

---

## 22. Analytics and Event Tracking Suggestions

If frontend analytics are added later, recommended events include:
- wallet_connect_clicked
- wallet_connected
- auth_sign_requested
- auth_sign_success
- buy_order_created
- buy_tx_attached
- buy_confirmed
- claim_started
- claim_signed
- claim_confirmed
- invite_link_copied
- rewards_detail_opened

This is optional and should not block v1 implementation.

---

## 23. Page-by-Page API Mapping Summary

### Dashboard
- `GET /api/v1/user/profile`
- `GET /api/v1/user/dashboard`

### Buy
- `GET /api/v1/config/public`
- `GET /api/v1/user/profile`
- `POST /api/v1/purchases/orders`
- `POST /api/v1/purchases/orders/{purchase_order_id}/tx`
- `GET /api/v1/purchases/orders/{purchase_order_id}`
- `POST /api/v1/purchases/recover`
- `GET /api/v1/vesting`

### Rewards
- `GET /api/v1/rewards/overview`
- `GET /api/v1/rewards/direct`
- `GET /api/v1/rewards/team`
- `GET /api/v1/rewards/team/{team_reward_daily_id}`
- `GET /api/v1/rewards/equal-level`
- `GET /api/v1/rewards/claims`
- `POST /api/v1/claims`
- `POST /api/v1/claims/{claim_order_id}/sign`
- `GET /api/v1/claims/{claim_order_id}`

### Team
- `GET /api/v1/team/overview`
- `GET /api/v1/team/daily-details`
- `GET /api/v1/team/members`

### Invite
- `GET /api/v1/invite`
- `GET /api/v1/invite/referrals`

---

## 24. Acceptance Criteria

The user frontend is considered correct when all are true:

1. a user can connect TP Wallet, sign in, and persist a valid session
2. dashboard shows accurate backend-driven summaries
3. buy page supports purchase initiation and pending confirmation tracking
4. vesting page shows lot-based vesting data clearly
5. rewards page supports claim-all flow with wallet signature and status tracking
6. team page separates settled data from pending confirmation data clearly
7. invite page correctly handles locked and unlocked states
8. restricted account states are surfaced and enforced in UI
9. mobile and desktop layouts are both usable
10. all copy and status labels are i18n-ready
11. no critical business formula is reimplemented in frontend logic

---

## 25. Recommended Implementation Order

1. app shell and routing
2. wallet connect + auth flow
3. global profile/config store
4. dashboard
5. buy page
6. rewards overview + claim flow
7. team page
8. invite page
9. error/empty/restricted states hardening
10. theming and i18n polish

---

## 26. Next Documents

The next documents to implement are:
- `06_Admin_Panel_PRD.md`
- `07_State_Machines_And_Exception_Flows.md`

The admin panel PRD should mirror this level of page and interaction detail for operational workflows.

