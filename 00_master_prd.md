# POSX Token Sale System — Master PRD

## 1. Document Control

- Document Name: `00_Master_PRD.md`
- System Name: POSX Token Sale System
- Product Type: Web3 token sale + referral rewards + team rewards + admin operations platform
- Primary Purpose: Provide the master product definition and implementation boundary for Cursor and Claude Code to generate the complete codebase for the user frontend, admin panel, and backend services.
- Source of Truth Priority:
  1. `01_Business_Rules_Spec.md`
  2. `03_Database_Schema_Spec.md`
  3. `04_API_Spec.md`
  4. `07_State_Machines_And_Exception_Flows.md`
  5. This document

---

## 2. Product Overview

POSX is a blockchain-based token sale and referral incentive system. Users purchase POSX using USDT. Purchased POSX enters vesting according to the on-chain lockup model. Eligible users may earn direct referral rewards, team differential rewards, and equal-level rewards according to a defined incentive structure.

The system consists of three major product surfaces:

1. **User Frontend**
   - Wallet-based user-facing SPA
   - Supports purchase, reward viewing, team statistics, invite link usage, and vesting claim status

2. **Admin Panel**
   - Operations-focused dashboard and management console
   - Supports user management, reward oversight, settlement visibility, config versioning, reporting, reconciliation, and system monitoring

3. **Backend Platform**
   - Supabase PostgreSQL + Edge Functions + Cron Jobs + contract event synchronization
   - Responsible for user aggregation, config management, settlement pipelines, claim orchestration, and auditability

---

## 3. Product Goals

### 3.1 Business Goals

- Enable users to purchase POSX with USDT through a wallet-connected flow
- Support stable referral binding and a transparent promotion network
- Support direct referral reward tracking
- Support daily settlement of team differential rewards and equal-level rewards
- Support lockup/vesting visibility for purchased POSX
- Provide an admin system for operating and monitoring the full lifecycle
- Ensure every reward, burn, adjustment, and configuration change is auditable

### 3.2 Product Goals

- Mobile-first user experience
- Low-friction wallet-based login and interaction
- High clarity of reward logic and account status
- Configurable but controlled incentive engine
- Strong operational tools for admin users
- Production-ready data model for future scaling and compliance review

### 3.3 Engineering Goals

- Clear separation of source-of-truth tables and derived cache tables
- Idempotent chain event synchronization
- Daily UTC-based settlement design
- Deterministic reward calculation
- Re-runnable settlement and adjustment framework
- Strong audit logs and config version tracking

---

## 4. In Scope

### 4.1 User Frontend Scope

- TP Wallet login / wallet signature authentication
- Dashboard
- Buy POSX
- View vesting status
- View direct / team / equal-level rewards
- Claim reward flow
- Team overview and member view
- Invite link and referral view
- Multi-language rendering
- Light / dark mode

### 4.2 Admin Panel Scope

- Admin authentication and role permissions
- Dashboard and KPI views
- User list and user detail
- User status management
- Referral tree view
- Reward records and settlement views
- Burn record views
- Config center with versioning
- Reports and exports
- Chain sync monitoring
- Cron job monitoring
- Recompute / adjustment operations
- Audit logging

### 4.3 Backend Scope

- Wallet auth support for user-side APIs
- Admin auth support for admin APIs
- Contract event sync
- Purchase order lifecycle handling
- Reward aggregation and settlement
- Claim order lifecycle
- Config version management
- UTC-based cron settlement
- Recompute / adjustment framework
- Exception and reversal handling
- Reporting data aggregation

---

## 5. Out of Scope

The following are explicitly not in scope for the first implementation unless later added by a separate document revision:

- Smart contract redevelopment or contract business logic redesign
- Fiat payment methods
- Email/password user login for normal users
- Social login
- NFT features
- P2P transfer features
- KYC/AML workflow integration
- Push notification systems
- Native iOS / Android apps
- Customer support ticketing system
- Marketing CRM system
- Exchange listing logic

---

## 6. Primary Roles

### 6.1 End User

A wallet-connected user who can:
- purchase POSX
- view referral and reward data
- view team data
- claim claimable rewards
- access personal vesting status

### 6.2 Super Admin

Can manage everything in the admin system, including:
- admin accounts
- config changes
- recompute apply actions
- user status changes
- audit inspection

### 6.3 Operator Admin

Can:
- view data
- manage business operations
- create config drafts / changes within permission
- run allowed previews / tasks
- cannot perform the highest-risk irreversible actions reserved for super admin

### 6.4 Viewer Admin

Read-only access to admin dashboards, reports, and logs.

---

## 7. System Principles

1. **Business rules must be deterministic.**
2. **Daily settlement must use UTC only.**
3. **Direct reward is on-chain fact and not subject to burn.**
4. **Team and equal-level rewards are off-chain settled and can be burned.**
5. **Config changes are versioned and default to next-day effectiveness.**
6. **Reward and settlement data must be auditable and reproducible.**
7. **Frontend display must never be the source of truth.**
8. **Derived data can be rebuilt from fact tables.**
9. **Every manual correction must leave an audit trail.**
10. **User state restrictions must be explicit and consistent across UI, API, and settlement.**

---

## 8. High-Level User Journey

### 8.1 Acquisition and Binding

1. User opens referral link
2. Frontend stores referral code locally
3. User connects TP Wallet
4. User reviews buy page
5. On first successful purchase, the referral relationship is bound if valid

### 8.2 Purchase and Vesting

1. User enters USDT amount
2. User approves token allowance
3. User confirms on-chain purchase
4. Contract emits purchase-related event(s)
5. Backend syncs event after required confirmations
6. Purchase record is created
7. A vesting lot is created or synced
8. User dashboard updates

### 8.3 Reward Lifecycle

1. Direct reward is recorded from chain sync
2. Team and equal-level rewards are calculated by daily UTC settlement
3. Burn rules are applied to team and equal-level rewards only
4. Claimable balances are generated
5. User signs and initiates claim
6. Claim order is broadcast and confirmed
7. Claim snapshots are marked claimed

### 8.4 Admin Operations

1. Admin logs in
2. Admin monitors users, rewards, sync status, reports
3. Admin updates config with effective date and apply scope
4. Admin inspects settlement results
5. If needed, admin preview recomputation
6. Super admin may apply adjustment-based correction

---

## 9. Core Business Modules

### 9.1 Wallet Authentication Module

- TP Wallet connection
- nonce issuance
- message signing
- signature verification
- user session issuance

### 9.2 Purchase Module

- create purchase order
- approve status handling
- on-chain purchase confirmation
- order recovery by tx hash
- duplicate request protection
- abnormal order handling

### 9.3 Referral Binding Module

- referral code capture
- first successful purchase binding
- immutable binding after success
- anti-self-referral and anti-cycle checks
- manual legacy binding controls

### 9.4 Tier and Qualification Module

- holding value based tier evaluation
- cumulative deposit qualification checks
- reward eligibility status
- team reward eligibility status
- next-tier progress computation

### 9.5 Reward Module

- direct referral reward sync and display
- daily team differential reward settlement
- daily equal-level reward settlement
- burn application for eligible reward types
- claimable balance aggregation

### 9.6 Vesting Module

- lot-based vesting tracking
- total released / withdrawable / withdrawn summary
- vesting lot-level source-of-truth storage
- user-side summary rendering

### 9.7 Claim Module

- reward snapshot locking
- claim order generation
- wallet signature confirmation
- payout orchestration
- success / failure handling
- idempotency protection

### 9.8 Admin Management Module

- user management
- status control
- reward and burn views
- chain sync monitoring
- cron monitoring
- config version management
- reports and exports
- audit logs
- recompute preview / apply adjustment workflows

### 9.9 Reporting Module

- platform metrics
- reward metrics
- user metrics
- burn metrics
- team ranking
- export support

---

## 10. Technology Stack

### 10.1 User Frontend

- Vite
- React
- TypeScript
- Tailwind CSS
- RainbowKit / wagmi or compatible wallet-connect stack supporting TP Wallet login flow
- i18n library for static translations

### 10.2 Admin Panel

- Vite
- React
- TypeScript
- Ant Design Pro

### 10.3 Backend

- Supabase PostgreSQL
- Supabase Edge Functions
- Supabase Cron / scheduled jobs
- Blockchain RPC provider(s)

### 10.4 Chain and Wallet

- Existing smart contract remains unchanged unless separately specified
- TP Wallet as supported user wallet login method

---

## 11. Information Architecture

### 11.1 User Frontend Pages

- `/dashboard`
- `/buy`
- `/rewards`
- `/my-team`
- `/invite`
- auth/connect modal
- claim modal(s)
- language/theme controls

### 11.2 Admin Pages

- `/login`
- `/dashboard`
- `/users`
- `/users/:wallet`
- `/users/:wallet/tree`
- `/rewards/direct`
- `/rewards/team`
- `/rewards/equal`
- `/rewards/burns`
- `/config`
- `/reports`
- `/system/chain-sync`
- `/system/cron`
- `/system/logs`
- `/system/admins`
- `/system/recompute`

---

## 12. High-Level Data Flow

### 12.1 Purchase Flow

1. User creates purchase order
2. User approves USDT
3. User confirms on-chain purchase
4. Chain event observed
5. Chain event confirmed after required confirmations
6. Purchase fact is stored
7. Vesting lot is stored or synced
8. Derived summaries update

### 12.2 Direct Reward Flow

1. Chain emits direct reward event or purchase event sufficient for derivation
2. Sync pipeline records direct reward fact
3. Direct reward appears in user reward history
4. Direct reward is not affected by burn

### 12.3 Team / Equal-Level Reward Flow

1. Daily UTC settlement gathers eligible users
2. Team performance snapshots are read/generated
3. Team differential reward is computed per line
4. Equal-level reward replaces differential on eligible same-level lines
5. Burn is applied to team/equal-level reward only
6. Daily reward snapshots become claimable

### 12.4 Claim Flow

1. User requests claim
2. Backend locks claimable snapshots
3. Claim order is created
4. User signs
5. Backend broadcasts payout
6. Confirmation marks claim order success
7. Reward snapshots change to claimed

### 12.5 Config Update Flow

1. Admin submits config version
2. System stores config version with `effective_from` and `apply_scope`
3. Audit log is written
4. Future settlement / orders read the correct version according to scope

---

## 13. Domain Concepts

### 13.1 User

A wallet-based participant with cumulative purchase activity, current status, and potentially a referral relationship.

### 13.2 Purchase Order

A request lifecycle object that represents the frontend/backend orchestration of a purchase before final chain confirmation.

### 13.3 Purchase Fact

The confirmed chain-backed purchase record used as source of truth.

### 13.4 Referral Binding

An immutable mapping from a buyer wallet to a referring wallet, normally fixed on first successful purchase.

### 13.5 Vesting Lot

A source-of-truth lot representing one purchase’s locked amount and release schedule.

### 13.6 Reward Snapshot

A daily settlement result or direct reward fact used for display and claim logic.

### 13.7 Burn Record

A record of the non-payable portion of team/equal-level reward due to burn rules.

### 13.8 Claim Order

The off-chain lifecycle object used to orchestrate a reward payout claim.

### 13.9 Adjustment Record

A correction record that changes future balances without overwriting historical claimed snapshots.

### 13.10 Config Version

A versioned definition of a configurable business rule or display setting with a defined effective time and apply scope.

---

## 14. Non-Functional Requirements

### 14.1 Correctness

- Settlement must be deterministic
- All calculations must be reproducible from fact data and config versions
- No reward snapshot may be claimable twice

### 14.2 Auditability

- Every config change must record old/new value, operator, timestamp, scope, and effective time
- Every manual correction must be logged
- Every admin status change must include reason

### 14.3 Security

- Nonce-based wallet auth
- Signed session issuance
- Admin role checks on every protected route
- Risky actions limited to super admin
- Idempotency on payout-related flows

### 14.4 Performance

- User team page must not recursively query unlimited depth in real time
- Aggregate summaries should be precomputed where appropriate
- Admin list pages must support pagination and filtering

### 14.5 Reliability

- Chain event sync must be restart-safe
- Settlement jobs must be re-runnable
- Failed purchase sync must be recoverable by tx hash
- Failed claim broadcast must not double-pay

### 14.6 Internationalization

- Static UI copy managed in frontend i18n files
- Dynamic announcement content stored per language in backend content configuration
- Fallback order defined in i18n spec

---

## 15. Master Feature List

### User Features

- Connect wallet
- Authenticate
- Buy POSX
- View price and purchase options
- View cumulative deposit
- View current tier and qualification
- View lockup summary
- View release progress
- View direct rewards
- View team rewards
- View equal-level rewards
- View burn status
- View team overview
- View invite link and invite statistics
- Claim rewards

### Admin Features

- Login
- View dashboard
- Search/filter users
- View user details
- Change user status
- View referral tree
- View direct reward records
- View team reward daily snapshots
- View equal-level reward daily snapshots
- View burn records
- Manage configs
- Inspect config history
- View reports
- Export reports
- Monitor sync jobs
- Monitor cron tasks
- View logs
- Preview recompute
- Apply adjustments

### Backend Features

- Auth nonce and verify
- Purchase order creation and recovery
- Chain sync
- Daily settlement
- Claim order creation and processing
- Adjustment generation
- Reporting aggregation
- Config version evaluation
- Audit logging

---

## 16. Delivery Structure for AI Code Generation

This project should be generated as a multi-surface but shared-domain codebase with clear boundaries:

### 16.1 Preferred Structure

- `apps/user-web`
- `apps/admin-web`
- `packages/shared-types`
- `packages/shared-utils`
- `packages/domain-rules`
- `supabase/functions`
- `supabase/migrations`
- `docs/`

### 16.2 Shared Domain Rules

Business calculations should be centralized into reusable domain logic where possible so that:
- backend calculations stay authoritative
- frontend reads derived values without re-implementing sensitive formulas
- test cases can validate the same rule engine inputs/outputs

---

## 17. Dependencies Across Documents

### This document depends on
- `01_Business_Rules_Spec.md`
- `03_Database_Schema_Spec.md`
- `04_API_Spec.md`
- `07_State_Machines_And_Exception_Flows.md`

### Subsequent documents must inherit from this document
- `05_User_Frontend_PRD.md`
- `06_Admin_Panel_PRD.md`
- `08_Auth_And_Permissions_Spec.md`
- `09_Config_Center_Spec.md`
- `11_Reporting_And_Metrics_Definition.md`

---

## 18. Acceptance Criteria for Phase 1

Phase 1 is considered complete when:

1. A user can connect TP Wallet and authenticate successfully
2. A user can submit and recover a purchase flow reliably
3. First successful purchase binds referral correctly
4. Confirmed purchase creates purchase facts and vesting lots
5. Direct rewards are synced and visible
6. Daily UTC team/equal-level settlement runs successfully
7. Burn logic applies correctly to team/equal-level rewards
8. Claim flow works with snapshot locking and no double-claim
9. Admin can manage configs with effective dates and version history
10. Admin can view users, rewards, burns, sync state, logs, and reports
11. Recompute preview and adjustment flow works without overwriting claimed history
12. Auditability exists for critical business actions

---

## 19. Open Implementation Guidance

For code generation:

- Do not embed business constants directly into UI components
- Read public config from API or generated typed config source
- Keep source-of-truth data immutable wherever possible
- Treat admin changes as versioned business events, not plain settings overwrites
- Use strongly typed enums for statuses and reward types
- Avoid real-time recursive team tree computation on user-facing pages
- Prefer summary tables or cached views for heavy queries

---

## 20. Next Document

The next document to implement against is:

- `01_Business_Rules_Spec.md`

This document defines the authoritative business behavior for all reward, binding, vesting, burn, claim, settlement, and config effectiveness logic.
