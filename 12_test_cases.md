# POSX Token Sale System — Test Cases

## 1. Document Control

- Document Name: `12_Test_Cases.md`
- System Name: POSX Token Sale System
- Purpose: Define functional, business-rule, state-machine, API, UI, auth, settlement, and operational test coverage for the POSX system
- Audience: QA, backend engineers, frontend engineers, product, operations, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `05_User_Frontend_PRD.md`
  - `06_Admin_Panel_PRD.md`
  - `07_State_Machines_And_Exception_Flows.md`
  - `08_Auth_And_Permissions_Spec.md`
  - `09_Config_Center_Spec.md`
  - `10_I18N_And_Content_Spec.md`
  - `11_Reporting_And_Metrics_Definition.md`

---

## 2. Purpose and Scope

This document defines the official test coverage required for the POSX Token Sale System.

It covers:
- user authentication tests
- admin authentication and authorization tests
- purchase flow tests
- referral binding tests
- vesting tests
- reward calculation tests
- burn tests
- claim tests
- team and invite tests
- config effectiveness tests
- settlement and recompute tests
- reporting tests
- i18n tests
- negative and exception-path tests

This document is designed so that:
- QA can execute deterministic test plans
- engineers can generate automated tests from clear scenarios
- Cursor and Claude Code can derive integration and end-to-end cases
- business logic regressions can be caught before release

---

## 3. Test Strategy Overview

Testing should be organized into the following layers:

### 3.1 Unit Tests

Purpose:
- verify pure domain logic and formula correctness

Examples:
- tier resolution
- burn calculation
- team ladder lookup
- equal-level replacement logic
- config resolution logic
- state transition guards

### 3.2 Integration Tests

Purpose:
- verify service + DB + API interactions

Examples:
- purchase order creation
- claim order locking
- settlement snapshot generation
- config version activation
- admin status mutation

### 3.3 End-to-End Tests

Purpose:
- verify full product flows across frontend and backend

Examples:
- wallet login to dashboard
- buy to pending confirmation to success
- rewards claim flow
- admin recompute preview flow

### 3.4 Operational/Job Tests

Purpose:
- verify scheduled jobs and background workers

Examples:
- chain sync
- settlement jobs
- summary refresh jobs
- export jobs

---

## 4. Test Data Conventions

For all test cases:
- use UTC timestamps
- use normalized lowercase wallet addresses
- use exact numeric strings for financial assertions where relevant
- use deterministic seeded fixtures where possible

Recommended wallet aliases for tests:
- `W_ROOT`
- `W_A`
- `W_B`
- `W_C`
- `W_D`
- `W_E`
- `W_F`
- `W_G`
- `W_H`
- `W_I`

Recommended admin aliases:
- `ADMIN_SUPER`
- `ADMIN_OPERATOR`
- `ADMIN_VIEWER`

---

## 5. User Authentication Test Cases

## 5.1 Nonce Creation

### TC-AUTH-001
**Title:** Create nonce for valid wallet address

Preconditions:
- wallet address not currently authenticated

Steps:
1. call `POST /api/v1/auth/nonce` with valid wallet address

Expected:
- response success = true
- nonce returned
- message_to_sign returned
- expires_at returned
- nonce stored server-side

### TC-AUTH-002
**Title:** Nonce returned for first-time wallet

Expected:
- user identity row is created or prepared according to implementation policy
- wallet stored lowercase

### TC-AUTH-003
**Title:** Nonce cannot be reused after successful verification

Steps:
1. request nonce
2. verify successfully
3. submit same nonce again

Expected:
- second verification rejected with `NONCE_ALREADY_USED`

### TC-AUTH-004
**Title:** Expired nonce rejected

Steps:
1. request nonce
2. wait beyond expiration or simulate expiry
3. submit verify request

Expected:
- rejected with `NONCE_EXPIRED`

### TC-AUTH-005
**Title:** Invalid signature rejected

Steps:
1. request nonce
2. submit invalid signature

Expected:
- rejected with `INVALID_SIGNATURE`
- session not issued

---

## 5.2 User Session

### TC-AUTH-006
**Title:** Valid signature creates user session

Expected:
- session token returned
- session row created
- user can access protected API

### TC-AUTH-007
**Title:** Expired session denied on protected endpoint

Expected:
- API returns `SESSION_EXPIRED` or `UNAUTHORIZED`

### TC-AUTH-008
**Title:** Logout revokes session

Steps:
1. authenticate user
2. call logout
3. call protected API with same token

Expected:
- protected API rejected

---

## 6. Admin Authentication and Role Tests

### TC-ADMIN-001
**Title:** Admin login succeeds for active account

Expected:
- session token issued
- admin role returned

### TC-ADMIN-002
**Title:** Disabled admin login rejected

Expected:
- login denied

### TC-ADMIN-003
**Title:** Viewer cannot call mutation API

Steps:
1. login as viewer
2. attempt `POST /api/v1/admin/config`

Expected:
- denied with permission error

### TC-ADMIN-004
**Title:** Operator can run recompute preview but not apply

Expected:
- preview succeeds
- apply rejected

### TC-ADMIN-005
**Title:** Super admin can manage admin accounts

Expected:
- create/update admin APIs succeed for super admin only

---

## 7. User Status and Permission Tests

### TC-PERM-001
**Title:** `restricted_purchase` blocks purchase order creation

Preconditions:
- user status = `restricted_purchase`

Steps:
1. call `POST /api/v1/purchases/orders`

Expected:
- rejected with `PURCHASE_NOT_ALLOWED` or `USER_STATUS_RESTRICTED`

### TC-PERM-002
**Title:** `restricted_claim` blocks claim order creation

Expected:
- claim creation rejected

### TC-PERM-003
**Title:** `suspended` user can still read dashboard if policy allows

Expected:
- read APIs succeed
- purchase/claim APIs fail

### TC-PERM-004
**Title:** `blacklisted` user blocked from mutations

Expected:
- purchase and claim endpoints denied

### TC-PERM-005
**Title:** User cannot access another wallet’s reward snapshot by ID

Steps:
1. authenticate as user A
2. request reward detail belonging to user B

Expected:
- denied or not found

---

## 8. Purchase Flow Test Cases

## 8.1 Purchase Order Creation

### TC-BUY-001
**Title:** Create purchase order with valid amount

Preconditions:
- active user
- min purchase config exists

Steps:
1. call `POST /api/v1/purchases/orders` with amount above minimum

Expected:
- order created
- status = `created`

### TC-BUY-002
**Title:** Reject purchase below minimum amount

Expected:
- `MIN_PURCHASE_NOT_MET`

### TC-BUY-003
**Title:** Duplicate client_order_id is idempotent

Steps:
1. send same create request twice with same client_order_id

Expected:
- same order or idempotent response returned
- no duplicate rows

## 8.2 Purchase Tx Attachment

### TC-BUY-004
**Title:** Attach tx hash to own order

Expected:
- status moves to `purchase_pending`

### TC-BUY-005
**Title:** Cannot attach tx to another user’s order

Expected:
- denied

## 8.3 Purchase Confirmation

### TC-BUY-006
**Title:** Confirmed chain event creates purchase fact exactly once

Preconditions:
- chain event reaches confirmations

Expected:
- purchase fact created
- order becomes `confirmed`
- no duplicate purchase fact on repeated processing

### TC-BUY-007
**Title:** Approval success but purchase fails

Expected:
- no purchase fact created
- order ends in `failed`
- no cumulative deposit update

### TC-BUY-008
**Title:** Purchase recovery by tx hash resolves valid missed purchase

Expected:
- recovery status = `resolved`
- purchase fact created/linked

### TC-BUY-009
**Title:** Invalid tx hash recovery fails

Expected:
- recovery status = `failed`

### TC-BUY-010
**Title:** Duplicate recovery request marked duplicate

Expected:
- recovery status = `duplicate`

---

## 9. Referral Binding Test Cases

### TC-REF-001
**Title:** First successful purchase binds valid referral

Preconditions:
- pending referral capture exists
- user has no prior purchases
- user has no referrer

Expected:
- referral binding created
- child linked to parent
- closure rows created

### TC-REF-002
**Title:** Wallet connect alone does not bind referral

Expected:
- no referral binding row before first successful purchase

### TC-REF-003
**Title:** Second purchase does not change existing referrer

Expected:
- original binding remains unchanged

### TC-REF-004
**Title:** Self-referral rejected

Expected:
- purchase may succeed if otherwise valid
- referral binding not created

### TC-REF-005
**Title:** Referral cycle rejected

Expected:
- binding denied
- audit/log event optional

### TC-REF-006
**Title:** Legacy manual binding blocked if conflicting reward history exists

Expected:
- admin manual binding rejected according to policy

---

## 10. Vesting Test Cases

### TC-VEST-001
**Title:** Each confirmed purchase creates one vesting lot

Expected:
- one lot per confirmed purchase
- no weighted-average merge behavior

### TC-VEST-002
**Title:** Vesting lot stores correct lock and release parameters

Expected:
- `lock_days = 90`
- `release_days = 365`

### TC-VEST-003
**Title:** User vesting summary aggregates multiple lots correctly

Expected:
- total_locked / released / withdrawable / withdrawn consistent with underlying lots

### TC-VEST-004
**Title:** Reversed purchase can void or exclude vesting lot according to policy

Expected:
- vesting consistency preserved

---

## 11. Tier and Qualification Test Cases

### TC-TIER-001
**Title:** User below deposit threshold is not reward-qualified

Expected:
- reward_qualified = false
- team_reward_qualified = false

### TC-TIER-002
**Title:** User with sufficient deposit and holding enters basic tier

Expected:
- tier = `basic`
- direct rate = 5%
- team eligible = false

### TC-TIER-003
**Title:** User with sufficient deposit and holding enters advanced tier

Expected:
- tier = `advanced`
- direct rate = 10%
- team eligible = true

### TC-TIER-004
**Title:** User with sufficient deposit and holding enters elite tier

Expected:
- tier = `elite`
- direct rate = 15%
- team eligible = true

### TC-TIER-005
**Title:** Tier evaluation changes with next-day config effectiveness, not prematurely

Expected:
- old config still governs before effective time
- new config governs after effective time

---

## 12. Team Reward Calculation Test Cases

### TC-TEAM-001
**Title:** Team rate resolves from correct ladder for advanced tier

Expected:
- correct ladder bracket chosen

### TC-TEAM-002
**Title:** Team rate resolves from correct ladder for elite tier

Expected:
- elite ladder used

### TC-TEAM-003
**Title:** Differential calculated as user rate minus subordinate rate

Scenario:
- user rate = 10%
- subordinate rate = 3%
- line effective performance = 10000

Expected:
- line differential = 7%
- raw line reward = 700

### TC-TEAM-004
**Title:** Differential cannot go negative

Scenario:
- subordinate rate > user rate

Expected:
- differential = 0
- no negative reward

### TC-TEAM-005
**Title:** Only configured effective depth contributes to effective performance

Expected:
- descendants outside depth range excluded

### TC-TEAM-006
**Title:** Non-team-eligible user does not receive team reward

Expected:
- no team reward snapshot generated

---

## 13. Equal-Level Reward Test Cases

### TC-EQ-001
**Title:** Equal-level replacement applies when same team rate and threshold met

Expected:
- differential line reward replaced
- equal-level snapshot created

### TC-EQ-002
**Title:** Equal-level not applied if subordinate team performance below threshold

Expected:
- normal differential logic remains

### TC-EQ-003
**Title:** Multiple same-level lines each evaluated independently

Expected:
- per-line replacement behavior correct

### TC-EQ-004
**Title:** Equal-level raw amount equals line effective performance × equal-level rate

Expected:
- exact numeric match

---

## 14. Burn Test Cases

### TC-BURN-001
**Title:** Burn not applied to direct rewards

Expected:
- direct reward amount remains untouched
- no burn record for direct reward

### TC-BURN-002
**Title:** Burn disabled when holding value above threshold

Expected:
- actual = raw for team/equal-level rewards
- no cap enforcement

### TC-BURN-003
**Title:** Burn applies when holding value at or below threshold

Scenario:
- holding value = 8000
- used burn capacity = 7900
- raw reward = 300

Expected:
- actual = 100
- burned = 200

### TC-BURN-004
**Title:** Burn capacity includes claimable and claimed off-chain rewards

Expected:
- user cannot avoid burn by not claiming

### TC-BURN-005
**Title:** Burned amounts are not later recovered when holding increases

Expected:
- no retroactive restoration

---

## 15. Settlement Test Cases

### TC-SETTLE-001
**Title:** Daily settlement runs on UTC date basis

Expected:
- settlement date matches UTC day

### TC-SETTLE-002
**Title:** Settlement creates team and equal-level snapshots for eligible users only

Expected:
- only eligible users receive rows

### TC-SETTLE-003
**Title:** Settlement writes burn records when burn occurs

Expected:
- burn record exists and reconciles with snapshot values

### TC-SETTLE-004
**Title:** Settlement job completed status when all rows processed successfully

Expected:
- job status = `completed`

### TC-SETTLE-005
**Title:** Settlement partial status when some rows fail

Expected:
- job status = `partial`
- error_count > 0

### TC-SETTLE-006
**Title:** Settlement rerun does not create duplicate snapshots for same official run semantics

Expected:
- idempotent or safely constrained behavior

---

## 16. Claim Flow Test Cases

### TC-CLAIM-001
**Title:** Claim order created when claimable amount exists

Expected:
- claim order status = `pending_signature`
- snapshots locked

### TC-CLAIM-002
**Title:** Claim rejected when nothing claimable

Expected:
- `CLAIM_NOTHING_AVAILABLE`

### TC-CLAIM-003
**Title:** Claim rejected below minimum claim amount

Expected:
- `CLAIM_MIN_AMOUNT_NOT_MET`

### TC-CLAIM-004
**Title:** Valid signature moves claim order to queued

Expected:
- status = `queued`

### TC-CLAIM-005
**Title:** Broadcasted claim eventually confirms and snapshots become claimed

Expected:
- claim order status = `confirmed`
- linked snapshots = `claimed`
- claim record created

### TC-CLAIM-006
**Title:** Pending signature claim timeout cancels order and releases locks

Expected:
- claim order = `cancelled`
- snapshots unlocked and claimable again

### TC-CLAIM-007
**Title:** Failed claim before broadcast releases locks

Expected:
- claim order = `failed`
- snapshots claimable again

### TC-CLAIM-008
**Title:** Duplicate claim request with same idempotency key does not create duplicate orders

Expected:
- original claim order returned

### TC-CLAIM-009
**Title:** User cannot create overlapping claim orders for same locked snapshots

Expected:
- rejected or existing in-flight claim returned

---

## 17. Adjustment and Recompute Test Cases

### TC-ADJ-001
**Title:** Recompute preview does not mutate official balances

Expected:
- no reward snapshot changes
- no adjustment rows created

### TC-ADJ-002
**Title:** Recompute apply creates positive adjustment for underpayment

Expected:
- credit adjustment created
- future claimable balance increased

### TC-ADJ-003
**Title:** Recompute apply creates negative adjustment for overpayment

Expected:
- debit adjustment created
- future claimable balance offset behavior correct

### TC-ADJ-004
**Title:** Claimed history is not destructively overwritten by recompute apply

Expected:
- original claimed snapshots remain unchanged
- adjustment rows handle correction

### TC-ADJ-005
**Title:** Only super admin may apply recompute adjustments

Expected:
- operator denied

---

## 18. Purchase Reversal Test Cases

### TC-REV-001
**Title:** Purchase reversal excludes purchase from future deposit and team performance logic

Expected:
- purchase marked reversed/excluded
- future business totals exclude it

### TC-REV-002
**Title:** Reversal after downstream off-chain rewards creates correction path rather than rewriting history

Expected:
- adjustment workflow used

### TC-REV-003
**Title:** Chain-backed direct reward history is not silently deleted by reversal

Expected:
- direct reward fact preserved
- operational correction handled separately

---

## 19. Config Center Test Cases

### TC-CONFIG-001
**Title:** Create valid config version with future `effective_from`

Expected:
- new config version stored
- history row stored
- admin log stored

### TC-CONFIG-002
**Title:** Config creation rejected without `effective_from`

Expected:
- validation error

### TC-CONFIG-003
**Title:** Config creation rejected without `apply_scope`

Expected:
- validation error

### TC-CONFIG-004
**Title:** Overlapping tier intervals rejected

Expected:
- validation error

### TC-CONFIG-005
**Title:** Invalid ladder overlap rejected

Expected:
- validation error

### TC-CONFIG-006
**Title:** Future-effective config does not affect current behavior prematurely

Expected:
- current day logic unchanged before effective time

### TC-CONFIG-007
**Title:** Historical recompute resolves historical config, not latest config

Expected:
- correct old version used

---

## 20. Reporting and Metrics Test Cases

### TC-REPORT-001
**Title:** Deposit total excludes reversed purchases

Expected:
- reversed purchases not included in business deposit totals

### TC-REPORT-002
**Title:** Direct reward total equals sum of direct reward facts in range

Expected:
- exact match

### TC-REPORT-003
**Title:** Team reward total uses actual amount, not raw total, in official dashboard metric

Expected:
- dashboard/report reconciles to actual payable team total

### TC-REPORT-004
**Title:** Burn total equals sum of burn records in range

Expected:
- exact match

### TC-REPORT-005
**Title:** Claim total equals sum of confirmed claim records in range

Expected:
- exact match

### TC-REPORT-006
**Title:** New buyers count based on first confirmed non-reversed purchase date

Expected:
- exact count

### TC-REPORT-007
**Title:** Team ranking sorted correctly and deterministically

Expected:
- sorted by team total performance
- deterministic tie-breaker applied

---

## 21. I18N and Content Test Cases

### TC-I18N-001
**Title:** User can switch among supported languages

Expected:
- UI updates correctly

### TC-I18N-002
**Title:** Language preference persists across refresh

Expected:
- last selected language restored

### TC-I18N-003
**Title:** Missing localized content falls back to zh-CN, then en

Expected:
- fallback chain followed

### TC-I18N-004
**Title:** Backend `error_code` maps to localized frontend error message

Expected:
- correct localized error shown

### TC-I18N-005
**Title:** Dynamic announcements render correct locale version

Expected:
- content value selected correctly

---

## 22. Admin Panel Workflow Test Cases

### TC-ADMINFLOW-001
**Title:** Viewer can read dashboards and logs but not mutate status/config

Expected:
- read succeeds
- mutation fails

### TC-ADMINFLOW-002
**Title:** Operator can change limited user statuses

Expected:
- `restricted_purchase` and `restricted_claim` allowed if policy permits

### TC-ADMINFLOW-003
**Title:** Super admin can create admin accounts

Expected:
- create succeeds

### TC-ADMINFLOW-004
**Title:** High-risk admin actions require reason and audit log

Expected:
- mutation rejected without reason
- accepted action logs correctly

---

## 23. End-to-End Smoke Tests

### TC-E2E-001
**Title:** New user full happy path

Steps:
1. connect TP Wallet
2. sign in
3. create purchase order
4. attach purchase tx
5. confirm purchase via sync
6. view dashboard updated
7. verify vesting lot exists

Expected:
- all core objects created correctly

### TC-E2E-002
**Title:** Referral happy path

Steps:
1. open referral link
2. connect wallet
3. sign in
4. purchase successfully

Expected:
- referral bound once
- direct reward fact created if applicable

### TC-E2E-003
**Title:** Reward and claim happy path

Steps:
1. seed team/equal-level snapshots as claimable
2. open rewards page
3. create claim
4. sign claim
5. broadcast and confirm payout

Expected:
- claim order confirmed
- snapshots claimed
- claim record exists

### TC-E2E-004
**Title:** Admin recompute preview happy path

Steps:
1. login as operator
2. open recompute page
3. run preview

Expected:
- preview job created
- no financial mutation

---

## 24. Regression Priority Matrix

Recommended regression-critical areas:
- auth
- purchase flow
- referral binding
- team reward calculation
- equal-level replacement
- burn logic
- claim locking and confirmation
- config effectiveness
- settlement job behavior
- recompute adjustment behavior

These should be covered in every major release cycle.

---

## 25. Recommended Automated Test Mapping

### Unit Test Candidates
- tier resolution
- team ladder resolution
- equal-level applicability
- burn formula
- config resolver
- permission helpers
- state transition guards

### Integration Test Candidates
- auth verify flow
- purchase order + purchase fact linkage
- referral binding insert + closure creation
- claim order + item locking
- settlement generation
- config version creation
- admin status mutation

### E2E Test Candidates
- wallet login
- buy page flow
- claim flow
- admin recompute preview
- admin config creation

---

## 26. Acceptance Criteria

This test plan is adequate when all are true:

1. every critical business rule has at least one positive and one negative test
2. every major state machine has transition coverage
3. permission boundaries are tested for both user and admin actors
4. financial generation, burn, claim, and correction flows are covered
5. config effectiveness and historical consistency are covered
6. reporting formulas are validated against source-of-truth expectations
7. i18n fallback and dynamic content behavior are covered
8. at least one end-to-end happy path exists for user and admin flows

---

## 27. Next Documents

The next implementation documents should be:
- `13_Seed_Data_And_Mock_Data.md`
- `14_Deployment_And_Env_Spec.md`

These will define fixture data, development seeds, and deployment/runtime setup to support the test cases above.

