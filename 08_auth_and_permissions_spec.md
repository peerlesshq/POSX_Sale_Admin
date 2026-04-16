# POSX Token Sale System — Auth and Permissions Spec

## 1. Document Control

- Document Name: `08_Auth_And_Permissions_Spec.md`
- System Name: POSX Token Sale System
- Purpose: Define authentication, session management, role permissions, capability checks, route guards, API guards, and privileged action controls for both user and admin surfaces
- Audience: Backend engineers, frontend engineers, QA, security reviewers, operations, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `05_User_Frontend_PRD.md`
  - `06_Admin_Panel_PRD.md`
  - `07_State_Machines_And_Exception_Flows.md`

---

## 2. Purpose and Scope

This document defines the complete authentication and authorization model for the POSX Token Sale System.

It covers:
- end-user authentication with TP Wallet
- end-user session lifecycle
- end-user capability rules derived from account status and business state
- admin authentication and admin session lifecycle
- admin role-based access control
- route-level access rules for user frontend and admin panel
- API-level authorization rules
- high-risk action restrictions
- audit logging requirements for privileged operations
- frontend permission behavior versus backend enforcement rules

This document is authoritative for deciding:
- who can access which page
- who can call which API
- who can perform which mutation
- what must be logged for each privileged action

---

## 3. Security Principles

1. Authentication proves identity. Authorization proves allowed action.
2. All authorization must be enforced server-side.
3. Frontend route guards are UX helpers only and are not a security boundary.
4. Wallet ownership must be proven by signature, never by claimed address alone.
5. User role and user status are different concepts and must remain separate.
6. Admin role and admin account status are different concepts and must remain separate.
7. Privileged financial actions must require the minimum necessary role.
8. Every privileged mutation must create an audit trail.
9. Session tokens must be time-bound and revocable.
10. Business capability checks must run in addition to auth checks.
11. Sensitive admin actions must never rely only on hidden buttons in UI.
12. Read permissions and write permissions must be modeled separately.

---

## 4. Access Control Model Overview

The system has two primary actor classes:

### 4.1 End Users
- identified by wallet address
- authenticated through TP Wallet signature flow
- authorized by resource ownership plus user status plus business capability checks

### 4.2 Admin Users
- identified by admin account
- authenticated through admin login
- authorized by role plus account status plus object/action policy checks

Authorization decisions come from three layers:

1. **Identity layer**
   - who the actor is
2. **Role layer**
   - what broad category of actions the actor may perform
3. **Capability/state layer**
   - whether the current object state and business conditions allow the action now

---

## 5. User Authentication Specification

## 5.1 Authentication Method

End users authenticate using TP Wallet.

Required login flow:
1. user connects TP Wallet
2. frontend requests nonce from backend
3. backend returns nonce and signable message
4. user signs message in wallet
5. frontend submits signature to backend
6. backend verifies signature and issues session token

No email/password login exists for end users in v1.

## 5.2 Wallet Address Normalization

All wallet addresses must be normalized to lowercase before persistence and permission checks.

## 5.3 Wallet Ownership Proof

Wallet ownership is established only when all of the following are true:
- nonce exists
- nonce is unexpired
- nonce has not been used
- signature is valid
- signature resolves to the submitted wallet address

## 5.4 User Record Creation Policy

Recommended behavior:
- create or upsert `users` row during first successful auth verification if wallet is first seen
- keep wallet identity row lightweight and separate from financial facts

## 5.5 User Session Issuance

After successful verification, backend issues a user session token.

Requirements:
- token must be revocable
- token must expire
- token must map to wallet address and issued session record
- token must not grant access to another wallet’s resources

Recommended default:
- session TTL = 7 days

## 5.6 Logout

Logout must:
- revoke current session server-side
- clear frontend local session/token storage
- clear user-scoped cached data on frontend

---

## 6. User Session Lifecycle Rules

## 6.1 Session States

User sessions are considered:
- `active`
- `expired`
- `revoked`

## 6.2 Session Validity Conditions

A user session is valid only when:
- session exists
- session is not revoked
- current time is before `expires_at`

## 6.3 Session Expiration Behavior

If session expires:
- protected APIs return `SESSION_EXPIRED` or `UNAUTHORIZED`
- frontend clears stale state and requests re-authentication

## 6.4 Session Revocation Triggers

User session may be revoked by:
- explicit logout
- security invalidation
- backend operational invalidation if implemented later

## 6.5 Session Scope Rule

A valid user session grants access only to resources belonging to that wallet.

The backend must never trust a wallet address from the client when determining resource ownership. It must derive the authenticated wallet address from the session itself.

---

## 7. User Authorization Model

User authorization depends on:
- valid user session
- ownership of resource
- user account status
- business capability checks
- object state

## 7.1 Resource Ownership Rule

A user may only read or mutate resources belonging to their own wallet address.

Examples:
- can read own profile
- can read own purchases
- can read own rewards
- can read own team overview
- cannot read another user’s reward snapshot by modifying route params or IDs

## 7.2 User Status and Capability Rule

Even if authenticated, user actions may be blocked by user status or business rules.

Examples:
- `restricted_purchase` blocks purchase creation
- `restricted_claim` blocks claim creation
- `suspended` blocks purchase and claim creation
- `blacklisted` blocks normal operations
- insufficient claimable amount blocks claim creation
- minimum purchase threshold check blocks invalid buy attempt

## 7.3 User Capability Matrix

### active
Can:
- access all protected user pages
- create purchase orders
- submit purchase tx linkage
- view purchases, vesting, rewards, team, and invite info
- create claim orders if business conditions are met

### restricted_purchase
Can:
- access protected user pages
- view account data
- create claim order if claim otherwise allowed

Cannot:
- create new purchase order
- continue normal purchase initiation flow

### restricted_claim
Can:
- access protected user pages
- create purchase order
- continue standard non-claim account usage

Cannot:
- create claim order
- sign new claim intent

### suspended
Can:
- access read-only account pages if frontend policy allows

Cannot:
- create purchase order
- create claim order
- use invite actions that require active status if policy blocks them
- accrue future off-chain team/equal-level rewards from effective suspension time forward

### blacklisted
Can:
- access only the minimal allowed read-only interface if product policy allows

Cannot:
- create purchase order
- create claim order
- use invite actions
- perform normal account operations
- accrue future off-chain team/equal-level rewards

---

## 8. User-Protected Route Rules

Protected user routes:
- `/dashboard`
- `/buy`
- `/rewards`
- `/my-team`
- `/invite`

## 8.1 Unauthenticated Behavior

If an unauthenticated user opens a protected route:
- do not render privileged account data
- show connect/sign-in prompt
- preserve intended destination where practical

## 8.2 Authenticated but Restricted Behavior

If authenticated user is restricted:
- route may still render if read access is allowed
- restricted actions must be disabled and explained
- server must still enforce denial if frontend control is bypassed

## 8.3 Frontend Capability Guards

Frontend should pre-check user capabilities to improve UX.

Examples:
- disable Buy button when `restricted_purchase`
- disable Claim button when `restricted_claim`
- show notice banner when `suspended` or `blacklisted`

These checks are convenience only. Backend remains authoritative.

---

## 9. User API Authorization Rules

Every user API must:
- require valid session unless explicitly public
- derive wallet identity from session
- verify ownership for the requested resource
- enforce user status and business capability checks

## 9.1 Public User-Facing APIs

Public APIs:
- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/verify`
- `GET /api/v1/config/public`

These must not require a user session.

## 9.2 Protected User APIs

Protected APIs include:
- `/api/v1/user/profile`
- `/api/v1/user/dashboard`
- `/api/v1/purchases/...`
- `/api/v1/vesting`
- `/api/v1/rewards/...`
- `/api/v1/claims/...`
- `/api/v1/team/...`
- `/api/v1/invite...`
- `/api/v1/auth/logout`

## 9.3 User API Examples

### `POST /api/v1/purchases/orders`
Must verify:
- session valid
- authenticated wallet exists
- user status permits purchase
- amount is valid and above minimum threshold

### `POST /api/v1/purchases/orders/{purchase_order_id}/tx`
Must verify:
- session valid
- purchase order belongs to authenticated wallet
- order state allows tx attachment

### `POST /api/v1/claims`
Must verify:
- session valid
- user status permits claim
- claimable amount exists
- min claim amount is satisfied
- no conflicting locked/in-flight claim order if policy blocks it

### `GET /api/v1/rewards/team/{team_reward_daily_id}`
Must verify:
- snapshot belongs to authenticated wallet

### `GET /api/v1/team/members`
Must verify:
- only authenticated wallet’s team data is returned
- deeper member data respects privacy constraints defined by frontend/business specs

---

## 10. Admin Authentication Specification

## 10.1 Authentication Method

Admin users authenticate with admin credentials.

Minimum v1 behavior:
- email + password
- backend verifies credentials
- backend issues admin session token

Optional later enhancement:
- MFA support
- SSO integration

## 10.2 Admin Account Status

Admin accounts should support at least:
- `active`
- `disabled`

If account is `disabled`:
- login must fail
- any active sessions should be considered invalid on next authorization check or actively revoked

## 10.3 Admin Session Issuance

After successful login, backend issues an admin session token.

Requirements:
- token must be revocable
- token must expire
- token must map to admin account and role

Recommended default:
- session TTL = 7 days or shorter in production-hardening mode

## 10.4 Admin Logout

Logout must:
- revoke current admin session server-side
- clear admin frontend session state

---

## 11. Admin Session Rules

## 11.1 Session Validity

An admin session is valid only when:
- session exists
- session is not revoked
- current time is before `expires_at`
- linked admin account is `active`

## 11.2 Session Revocation Triggers

- explicit logout
- admin account disabled
- credential rotation or security invalidation

## 11.3 Session Scope

Admin session scope is determined by admin role and page/action policies.

---

## 12. Admin Role Model

Admin roles:
- `super_admin`
- `operator`
- `viewer`

These roles determine the maximum allowed action set.

## 12.1 Viewer

Viewer is read-only.

Can:
- access dashboard
- access users list/detail/tree
- access reward pages
- access reports page for read-only analysis
- access settlement jobs list/detail
- access chain sync, system jobs, system health, and audit logs

Cannot:
- change user status
- create config versions
- trigger settlement/backfill
- run recompute preview or apply
- create report export jobs if restricted by policy
- manage admin accounts

## 12.2 Operator

Operator is the standard operational role.

Can:
- do everything viewer can
- create config versions where allowed by policy
- change some user statuses where allowed by policy
- trigger settlement/backfill jobs
- run recompute preview
- create report export jobs

Cannot:
- apply recompute adjustments
- manage admin accounts unless future policy explicitly grants it
- perform super-admin-only security-sensitive actions

## 12.3 Super Admin

Super admin may perform all system operations including:
- all viewer actions
- all operator actions
- apply recompute adjustments
- manage admin accounts
- perform exceptional recovery/correction actions where business policy allows
- perform high-risk user status transitions

---

## 13. Page-Level Permission Matrix

## 13.1 User Frontend

All user protected pages require valid user session.

| Route | active | restricted_purchase | restricted_claim | suspended | blacklisted |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | Yes | Yes | Yes | Read-only | Limited read-only if allowed |
| `/buy` | Yes | View-only, no buy | Yes | View-only, no buy | Blocked or view-only |
| `/rewards` | Yes | Yes | Yes, claim blocked | Read-only | Limited read-only |
| `/my-team` | Yes | Yes | Yes | Read-only | Limited read-only |
| `/invite` | Yes | Yes, invite visible | Yes | Possibly limited | Possibly limited |

Notes:
- exact `suspended` / `blacklisted` read behavior can remain read-only rather than hard-route block for better user communication
- backend still decides mutation capability

## 13.2 Admin Panel

| Route | viewer | operator | super_admin |
| --- | --- | --- | --- |
| `/dashboard` | Yes | Yes | Yes |
| `/users` | Yes | Yes | Yes |
| `/users/:wallet_address` | Yes | Yes | Yes |
| `/users/:wallet_address/tree` | Yes | Yes | Yes |
| `/rewards/direct` | Yes | Yes | Yes |
| `/rewards/team` | Yes | Yes | Yes |
| `/rewards/equal-level` | Yes | Yes | Yes |
| `/rewards/burns` | Yes | Yes | Yes |
| `/config` | Read-only | Read + mutate allowed by policy | Yes |
| `/reports` | Read-only | Read + export | Yes |
| `/settlement/jobs` | Read-only | Read + trigger settlement/backfill | Yes |
| `/recompute` | Read-only job visibility if allowed | Preview only | Preview + apply |
| `/system/chain-sync` | Yes | Yes | Yes |
| `/system/jobs` | Yes | Yes | Yes |
| `/system/health` | Yes | Yes | Yes |
| `/logs` | Yes | Yes | Yes |
| `/admin-accounts` | No | No | Yes |

---

## 14. Admin Action-Level Permission Matrix

### 14.1 User Status Changes

Recommended v1 policy:

| Target Status | viewer | operator | super_admin |
| --- | --- | --- | --- |
| `restricted_purchase` | No | Yes | Yes |
| `restricted_claim` | No | Yes | Yes |
| `suspended` | No | No | Yes |
| `blacklisted` | No | No | Yes |
| restore to `active` from limited states | No | `restricted_*` only if allowed | Yes |

Requirements:
- reason required
- effective time recorded
- audit log mandatory

### 14.2 Create Config Version

| Action | viewer | operator | super_admin |
| --- | --- | --- | --- |
| Create config version | No | Yes | Yes |
| Read config history | Yes | Yes | Yes |

Requirements:
- validated config payload
- `effective_from` required
- `apply_scope` required
- audit log mandatory

### 14.3 Trigger Settlement / Backfill

| Action | viewer | operator | super_admin |
| --- | --- | --- | --- |
| Trigger backfill/settlement | No | Yes | Yes |

Requirements:
- settlement date required
- reason required
- audit log mandatory

### 14.4 Run Recompute Preview

| Action | viewer | operator | super_admin |
| --- | --- | --- | --- |
| Recompute preview | No | Yes | Yes |

Requirements:
- settlement date required
- reason required
- audit log mandatory

### 14.5 Apply Recompute Adjustment

| Action | viewer | operator | super_admin |
| --- | --- | --- | --- |
| Recompute apply | No | No | Yes |

Requirements:
- settlement date required
- reason required
- confirmation step required
- audit log mandatory
- must create adjustments, never destructive rewrite of claimed history

### 14.6 Report Export

| Action | viewer | operator | super_admin |
| --- | --- | --- | --- |
| Create export job | Optional No/Read-only | Yes | Yes |
| Read export jobs | Yes | Yes | Yes |

Recommended v1:
- viewer read-only
- operator and super admin may create exports

### 14.7 Admin Account Management

| Action | viewer | operator | super_admin |
| --- | --- | --- | --- |
| List admin accounts | No | No | Yes |
| Create admin account | No | No | Yes |
| Update admin account | No | No | Yes |
| Disable admin account | No | No | Yes |

---

## 15. Backend Authorization Rules

All backend authorization must follow this order:

1. validate session
2. resolve actor identity
3. resolve actor role/status
4. resolve target resource ownership or target object
5. evaluate action permission
6. evaluate object state/business preconditions
7. execute action
8. write audit log if action is privileged

No API may skip object-state validation merely because the actor has role permission.

---

## 16. User API Authorization Rules

## 16.1 General Rule

User APIs must derive the wallet address from the validated session token, not from request body or route param.

## 16.2 Ownership Enforcement

If an API references a record by ID, the backend must verify that the record belongs to the authenticated wallet.

Examples:
- team reward snapshot id must belong to wallet
- equal-level reward snapshot id must belong to wallet
- claim order id must belong to wallet
- purchase order id must belong to wallet

## 16.3 Capability Enforcement Examples

### `POST /api/v1/purchases/orders`
Must deny when:
- no valid session
- user status is `restricted_purchase`, `suspended`, or `blacklisted`
- amount invalid
- minimum purchase amount not met

### `POST /api/v1/claims`
Must deny when:
- no valid session
- user status is `restricted_claim`, `suspended`, or `blacklisted`
- claimable amount is zero
- claimable amount below min claim amount
- conflicting in-flight claim order exists and policy forbids another

### `GET /api/v1/team/members`
Must ensure:
- returned data belongs only to authenticated wallet’s hierarchy
- privacy rules for deeper levels are respected

---

## 17. Admin API Authorization Rules

## 17.1 General Rule

Admin APIs must:
- validate admin session
- ensure admin account is active
- load admin role
- check page/action role permission
- check target object constraints
- log privileged mutations

## 17.2 Read vs Write Separation

Read permission never implies mutation permission.

Examples:
- operator may read recompute history but only super admin may apply recompute corrections
- viewer may read user detail but may not change status

## 17.3 Sensitive Mutation Rules

### `PATCH /api/v1/admin/users/{wallet_address}/status`
Must check:
- admin session valid
- role allowed for target status transition
- reason present
- target transition legal per status state machine
- audit log written

### `POST /api/v1/admin/config`
Must check:
- admin session valid
- role allowed
- payload valid
- `effective_from` and `apply_scope` present
- audit log written

### `POST /api/v1/admin/settlement/trigger`
Must check:
- admin session valid
- role allowed
- valid settlement date
- reason present
- audit log written

### `POST /api/v1/admin/recompute/preview`
Must check:
- admin session valid
- role allowed
- reason present
- audit log written

### `POST /api/v1/admin/recompute/apply`
Must check:
- admin session valid
- role is `super_admin`
- reason present
- audit log written

### `POST /api/v1/admin/accounts`
Must check:
- admin session valid
- role is `super_admin`
- target payload valid
- audit log written

---

## 18. Route Guard Specification

## 18.1 User Frontend Route Guards

### Public routes
- login/connect entry surfaces if any
- static marketing or landing pages if they exist

### Protected routes
- dashboard
- buy
- rewards
- team
- invite

User route guard behavior:
- if no user session: redirect or show auth prompt
- if session invalid: clear session and re-authenticate
- if user restricted: allow route render if read access allowed, but pass capability flags down to page components

## 18.2 Admin Panel Route Guards

### Public route
- `/login`

### Protected routes
- all other admin routes

Admin route guard behavior:
- if no admin session: redirect to `/login`
- if session invalid: redirect to `/login`
- if role insufficient: show access denied page or redirect to nearest allowed route

Route guards must not be the only permission layer. Backend remains authoritative.

---

## 19. Capability Flags for Frontend Consumption

To reduce frontend guesswork, backend should expose or derive capability flags for current user/admin context where useful.

## 19.1 User Capability Flags

Recommended flags:
- `can_purchase`
- `can_claim`
- `can_view_invite_link`
- `can_accrue_offchain_rewards`
- `can_bind_referral_on_first_purchase`

These may be returned inside profile or dashboard payloads if helpful.

## 19.2 Admin Capability Flags

Recommended flags for frontend shell or per-page actions:
- `can_change_user_status_basic`
- `can_change_user_status_severe`
- `can_create_config_version`
- `can_trigger_settlement`
- `can_run_recompute_preview`
- `can_run_recompute_apply`
- `can_manage_admin_accounts`
- `can_export_reports`

Even if frontend receives such flags, backend must independently verify permissions.

---

## 20. Audit Requirements for Privileged Actions

The following actions must always generate admin audit logs:
- user status changes
- config version creation or disabling
- settlement/backfill trigger
- recompute preview trigger
- recompute apply trigger
- purchase reversal or financial correction actions
- admin account creation/update/disable

Audit log must include at minimum:
- actor admin id
- action name
- target type
- target id
- reason or note where required
- before/after summary when relevant
- timestamp
- IP metadata if available

---

## 21. High-Risk Action Safeguards

High-risk actions include:
- recompute apply
- severe user restriction transitions (`suspended`, `blacklisted`)
- admin account management
- approved purchase reversal or financial correction actions

Safeguards required:
- explicit role check
- confirmation step in UI
- required reason
- backend validation
- audit log

Recommended production safeguard for highest-risk actions:
- typed confirmation phrase or second confirmation modal

---

## 22. Forbidden Authorization Behaviors

The following are explicitly forbidden:

1. Trusting wallet address from request body without session verification
2. Letting frontend-only hidden buttons act as permission control
3. Allowing viewer to mutate data through direct API calls
4. Allowing operator to run super-admin-only financial correction actions
5. Reading another user’s resources by ID enumeration
6. Using stale frontend role state as sole source of truth
7. Applying user status restrictions only in UI but not in API
8. Skipping audit log for privileged mutations

---

## 23. Recommended Backend Permission Helpers

Implement reusable backend helpers such as:
- `requireUserSession()`
- `requireAdminSession()`
- `requireAdminRole(minRole or exactRole)`
- `assertUserOwnsResource(wallet, resource)`
- `assertUserCanPurchase(userStatus)`
- `assertUserCanClaim(userStatus)`
- `assertAdminCanChangeUserStatus(actorRole, targetStatus)`
- `assertAdminCanApplyRecompute(actorRole)`
- `assertAdminCanManageAdmins(actorRole)`

Prefer centralized permission services over ad hoc inline checks.

---

## 24. Recommended Frontend Permission Helpers

User frontend helpers:
- `isUserAuthenticated()`
- `getUserCapabilities(profile)`
- `canRenderProtectedRoute(session)`
- `canTriggerBuy(profile)`
- `canTriggerClaim(profile, rewardOverview)`

Admin frontend helpers:
- `isAdminAuthenticated()`
- `hasAdminRole(role)`
- `canViewAdminRoute(role, route)`
- `canExecuteAdminAction(role, action)`

These must be used only for rendering and UX, not security.

---

## 25. Example Permission Matrix by API Group

| API Group | User Session | Admin Session | Role Required |
| --- | --- | --- | --- |
| `/auth/*` user | Public | No | N/A |
| `/config/public` | Public | No | N/A |
| `/user/*` | Yes | No | N/A |
| `/purchases/*` | Yes | No | N/A |
| `/rewards/*` user-side | Yes | No | N/A |
| `/claims/*` | Yes | No | N/A |
| `/team/*` | Yes | No | N/A |
| `/invite/*` | Yes | No | N/A |
| `/admin/auth/*` | No | Public login | N/A |
| `/admin/dashboard` | No | Yes | viewer+ |
| `/admin/users/*` read | No | Yes | viewer+ |
| `/admin/users/*` status mutation | No | Yes | operator+/super-admin depending on target |
| `/admin/rewards/*` | No | Yes | viewer+ |
| `/admin/config` read | No | Yes | viewer+ |
| `/admin/config` write | No | Yes | operator+ |
| `/admin/settlement/*` trigger | No | Yes | operator+ |
| `/admin/recompute/preview` | No | Yes | operator+ |
| `/admin/recompute/apply` | No | Yes | super_admin |
| `/admin/reports/export` | No | Yes | operator+ |
| `/admin/accounts/*` | No | Yes | super_admin |

---

## 26. QA Authorization Checklist

QA must verify at minimum:

1. user cannot access protected pages without wallet auth
2. user cannot call another user’s resource by ID guessing
3. `restricted_purchase` blocks purchase API even if frontend button is forced
4. `restricted_claim` blocks claim API even if frontend button is forced
5. suspended and blacklisted users cannot perform blocked actions
6. viewer cannot mutate through admin APIs
7. operator can run preview but cannot apply recompute adjustments
8. only super admin can manage admin accounts
9. all privileged admin actions create audit log entries
10. disabled admin accounts cannot continue using sessions
11. session expiration is enforced on both user and admin surfaces

---

## 27. Acceptance Criteria

This document is correctly implemented when all are true:

1. TP Wallet login proves wallet ownership through nonce + signature
2. user session only grants access to that wallet’s resources
3. user status restrictions are enforced by backend APIs
4. admin login and session validation work correctly
5. admin role matrix is enforced on pages and APIs
6. operator and super-admin capabilities are clearly separated
7. high-risk actions are restricted and audited
8. frontend route guards align with backend permissions but do not replace them
9. resource ownership checks prevent cross-user access
10. privileged mutations always record audit trails

---

## 28. Next Documents

The next implementation documents should be:
- `09_Config_Center_Spec.md`
- `10_I18N_And_Content_Spec.md`
- `11_Reporting_And_Metrics_Definition.md`
- `12_Test_Cases.md`

These will define config semantics, translation/content behavior, metric formulas, and formal test coverage on top of this auth and permission model.

