# POSX Token Sale System — Backend Architecture Spec

## 1. Document Control

- Document Name: `02_Backend_Architecture_Spec.md`
- System Name: POSX Token Sale System
- Scope: Backend services, domain architecture, sync pipelines, settlement architecture, claim orchestration, admin service boundaries, and operational design
- Audience: Backend engineers, full-stack engineers, Cursor, Claude Code, QA, DevOps
- Priority: This document must be implemented together with:
  - `01_Business_Rules_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `07_State_Machines_And_Exception_Flows.md`

---

## 2. Purpose

This document defines the production-oriented backend architecture for the POSX Token Sale System.

It exists to ensure that code generation produces:
- a deterministic reward and settlement engine
- a clean separation between chain facts, business rules, and derived summaries
- safe claim orchestration
- idempotent event synchronization
- auditable admin actions
- maintainable service boundaries

This document is the implementation blueprint for the backend only. UI behavior belongs to the frontend and admin PRDs.

---

## 3. Backend Responsibilities

The backend is responsible for:

1. user wallet authentication
2. admin authentication and authorization
3. purchase order orchestration and recovery
4. contract event synchronization
5. confirmed purchase fact creation
6. referral binding on first successful purchase
7. user snapshots and derived summaries
8. daily UTC settlement of team and equal-level rewards
9. burn application for off-chain rewards
10. claim order creation and payout orchestration
11. config version evaluation and history
12. recompute preview and adjustment-based correction
13. reporting aggregation
14. audit logging and operational visibility

The backend is **not** the owner of on-chain contract logic, but it must treat chain-confirmed facts as authoritative inputs.

---

## 4. Architecture Principles

1. **Facts first, derived later**
   - confirmed purchases, chain events, reward snapshots, vesting lots, and claim records are source-of-truth objects
   - aggregate user snapshots and dashboards are rebuildable derivatives

2. **Deterministic settlement**
   - the same inputs, config version, and settlement date must always produce the same result

3. **Idempotent side effects**
   - event sync, claim broadcast, and purchase recovery must be restart-safe and duplicate-safe

4. **Explicit state machines**
   - purchase orders, claim orders, chain events, settlement jobs, and user statuses must all use typed statuses

5. **UTC-only business clock**
   - daily business computation uses UTC regardless of user locale

6. **Versioned mutable rules**
   - config changes are stored as dated versions with scope metadata

7. **No destructive rewrites of claimed history**
   - corrections after claim use adjustments, not mutation of claimed facts

8. **Backend owns sensitive formulas**
   - frontend should consume calculated values, not independently implement payout logic

---

## 5. Recommended Runtime Stack

### 5.1 Core Platform

- Supabase PostgreSQL
- Supabase Edge Functions
- Scheduled jobs / cron tasks
- Blockchain RPC provider(s)
- Optional queue-like retry table pattern inside PostgreSQL

### 5.2 Language and Runtime

- TypeScript
- Deno-compatible code for Supabase Edge Functions where applicable
- Shared domain logic packaged as TypeScript modules

### 5.3 Architectural Mode

Use a **modular monorepo-style backend layout** even if deployed through Supabase functions.

Recommended structure:

```text
/apps
  /user-web
  /admin-web
/packages
  /shared-types
  /shared-utils
  /domain-rules
  /domain-models
  /api-contracts
/supabase
  /functions
    /auth_nonce
    /auth_verify
    /user_profile
    /user_dashboard
    /purchase_create
    /purchase_recover
    /claim_create
    /claim_sign
    /admin_login
    /admin_dashboard
    /admin_users
    /admin_user_detail
    /admin_rewards
    /admin_config
    /admin_reports
    /admin_system
  /migrations
  /seed
/backend
  /workers
  /services
  /repos
  /jobs
  /chains
  /settlement
  /reporting
  /config
  /observability
/docs
```

The `/backend` folder represents shared implementation modules imported into edge functions and scheduled tasks.

---

## 6. Logical Architecture Overview

The backend should be implemented as these logical layers:

### 6.1 API Layer

Edge Functions exposing public and admin APIs.

Responsibilities:
- request parsing
- auth validation
- permission enforcement
- invoking domain services
- shaping API responses
- returning typed errors

### 6.2 Domain Service Layer

Pure or mostly-pure business service modules.

Responsibilities:
- business rule evaluation
- orchestration of repositories
- state transitions
- validation
- deterministic calculations

Examples:
- `ReferralBindingService`
- `TierEvaluationService`
- `SettlementService`
- `BurnService`
- `ClaimService`
- `ConfigResolverService`
- `AdjustmentService`

### 6.3 Repository Layer

Data access layer for PostgreSQL.

Responsibilities:
- select/insert/update with typed contracts
- encapsulate query details
- enforce transaction boundaries
- provide reusable read models

### 6.4 Job / Worker Layer

Scheduled and event-driven background processors.

Responsibilities:
- chain event scanning
- daily settlement
- summary recomputation
- claim broadcast retries
- reporting snapshot generation

### 6.5 Shared Domain Rules Layer

Reusable pure functions for:
- tier evaluation
- team level lookup
- burn calculations
- effective config resolution
- reward formulas
- validation helpers

This layer should contain no direct database or RPC access.

---

## 7. Bounded Contexts

The backend should be organized around the following bounded contexts.

### 7.1 Auth Context

Owns:
- wallet nonce issuance
- signature verification
- user session generation
- admin login session generation

### 7.2 Purchase Context

Owns:
- purchase order lifecycle
- tx hash recovery
- purchase fact creation from chain sync
- duplicate protection

### 7.3 Referral Context

Owns:
- referral link interpretation
- binding on first successful purchase
- anti-self-referral
- anti-cycle validation
- manual legacy binding correction rules

### 7.4 Wallet / Chain Sync Context

Owns:
- contract event polling
- confirmation tracking
- reorg handling
- event deduplication
- event processing checkpoints

### 7.5 Reward Context

Owns:
- direct reward storage
- team reward settlement
- equal-level settlement
- burn application
- reward snapshot visibility

### 7.6 Claim Context

Owns:
- claim order creation
- claim snapshot locking
- wallet-signed confirmation
- payout orchestration
- retry safety

### 7.7 Config Context

Owns:
- config versions
- effective date logic
- apply scope logic
- config history and resolution

### 7.8 Reporting Context

Owns:
- dashboard metrics
- daily summaries
- exports
- rankings

### 7.9 Admin Operations Context

Owns:
- user status actions
- recompute preview/apply flows
- adjustment creation
- audit logging

---

## 8. Service Inventory

Recommended backend services:

### 8.1 Auth Services

- `WalletNonceService`
- `WalletVerifyService`
- `SessionService`
- `AdminAuthService`

### 8.2 Purchase Services

- `PurchaseOrderService`
- `PurchaseRecoveryService`
- `PurchaseFactService`

### 8.3 Referral Services

- `ReferralCaptureService`
- `ReferralBindingService`
- `ReferralTreeService`

### 8.4 Config Services

- `ConfigResolverService`
- `ConfigVersionService`
- `ConfigValidationService`

### 8.5 Qualification Services

- `TierEvaluationService`
- `RewardQualificationService`
- `TeamRateService`

### 8.6 Reward and Settlement Services

- `DirectRewardSyncService`
- `TeamSettlementService`
- `EqualLevelSettlementService`
- `BurnService`
- `SettlementOrchestrator`
- `AdjustmentService`

### 8.7 Claim Services

- `ClaimPreparationService`
- `ClaimSigningService`
- `ClaimBroadcastService`
- `ClaimFinalizationService`

### 8.8 Chain Services

- `ChainEventScanner`
- `ChainEventConfirmationService`
- `ChainEventProcessor`
- `ChainReorgService`

### 8.9 Summary and Reporting Services

- `UserSummaryService`
- `DashboardSummaryService`
- `TeamAggregateService`
- `ReportExportService`

### 8.10 Operational Services

- `AuditLogService`
- `JobRunService`
- `HealthCheckService`
- `AdminActionGuardService`

---

## 9. Primary Data Categories

The backend should treat data in four categories.

### 9.1 Source-of-Truth Facts

Examples:
- chain events
- confirmed purchases
- direct reward facts
- referral bindings
- vesting lots
- team/equal-level daily reward snapshots
- burn records
- claim orders
- claim records
- adjustment records
- config versions

### 9.2 Current Operational State

Examples:
- user current status
- active session state
- chain sync checkpoints
- job run state

### 9.3 Derived Summaries

Examples:
- user current tier snapshot
- dashboard daily summary
- user reward summary
- team level aggregate daily
- report materializations

### 9.4 Audit and Operational Logs

Examples:
- admin logs
- config change history
- job execution logs
- system errors

---

## 10. API Architecture

### 10.1 Public/User API Characteristics

User APIs must:
- require wallet session auth except for nonce/public config endpoints
- return only data permitted for the authenticated wallet
- never expose admin-only fields
- rely on backend calculations for reward and summary values

### 10.2 Admin API Characteristics

Admin APIs must:
- require admin auth
- enforce role-based permissions
- log sensitive operations
- use pagination on list views
- support filtering and sorting where operationally useful

### 10.3 API Versioning

Use `/api/v1/...` style internally or equivalent routing convention even if hidden behind edge function routes. Keep request/response contracts versionable.

### 10.4 Error Convention

Each API should return:
- `success`
- `data`
- `error_code`
- `message`
- `request_id`

The backend should prefer stable `error_code` values over user-facing prose.

---

## 11. Authentication Architecture

## 11.1 User Authentication

The system supports TP Wallet login using:
- nonce issuance
- signature verification
- session token issuance

Flow:
1. user requests nonce
2. backend creates one-time nonce with expiration
3. user signs message in TP Wallet
4. backend verifies signature and wallet address
5. backend issues session token
6. subsequent API requests use session token

Rules:
- nonce single-use
- nonce expiration default 5 minutes
- session token default 7 days
- token revocation on logout or invalidation

### 11.2 Admin Authentication

Admin auth uses admin-specific credentials and session controls.

Recommended:
- Supabase auth or secure admin session table pattern
- bcrypt/argon2 password hash where applicable
- optional MFA-ready design

### 11.3 Session Validation Layer

Implement middleware helpers:
- `requireUserSession()`
- `requireAdminSession()`
- `requireAdminRole(role)`

---

## 12. Purchase Architecture

## 12.1 Purchase Lifecycle Responsibilities

The backend should support the full lifecycle:
- purchase order creation
- allowance/approval-aware flow support
- on-chain purchase confirmation
- tx hash recovery
- duplicate protection
- final fact creation

### 12.2 Purchase Order vs Purchase Fact

Separate these clearly:

- **Purchase Order**: orchestration object created by frontend/backend
- **Purchase Fact**: confirmed chain-backed financial record

A purchase fact should only exist after chain confirmation threshold is satisfied.

### 12.3 Purchase Order Flow

1. frontend requests purchase creation
2. backend validates user status and min amount
3. backend creates `purchase_order` with idempotency fields
4. frontend submits on-chain tx
5. tx hash is attached
6. chain sync later confirms and processes the event
7. system creates purchase fact and updates order state

### 12.4 Recovery Flow

If chain purchase succeeds but backend missed initial linkage:
- user may submit tx hash to recovery endpoint
- backend verifies tx hash against chain data
- if valid and not processed, system links it and completes normal flow

### 12.5 Duplicate Protection

Protect against duplicates using:
- `client_order_id`
- `tx_hash`
- chain event unique key `(chain_id, tx_hash, log_index)`

---

## 13. Chain Event Synchronization Architecture

## 13.1 Design Goals

- no duplicate processing
- no false confirmation before threshold
- recover safely on restart
- handle reorgs
- support incremental scanning

### 13.2 Event Pipeline Stages

1. **Observe**
   - scan blocks and detect relevant contract events
2. **Store raw event**
   - upsert into chain event table using unique event key
3. **Track confirmations**
   - periodically update confirmation count
4. **Mark confirmed**
   - when threshold is met
5. **Process business effect**
   - create purchase facts, direct reward facts, related updates
6. **Mark processed**
   - once side effects committed

### 13.3 Required Event States

- `observed`
- `confirmed`
- `processed`
- `reverted`
- `failed_processing`

### 13.4 Checkpoint Strategy

Maintain checkpoint state per chain/contract source.

Checkpoint data should include:
- last scanned block
- last finalized/confirmed block
- last updated timestamp

### 13.5 Reorg Handling

If a previously observed event disappears or its block hash changes before business finalization:
- mark event `reverted`
- rollback unfinalized downstream artifacts where applicable

If an event has already become an immutable chain fact and downstream financial processing occurred, follow the reversal/adjustment policy rather than silently deleting history.

### 13.6 Event Processor Responsibilities

For each confirmed event type:
- validate payload
- idempotently map to business action
- execute transaction-safe writes
- record processing result

### 13.7 Processing Transactions

Use database transactions around each event processing unit where feasible:
- create purchase fact
- apply referral binding if first purchase
- create vesting lot or sync vesting data
- create direct reward fact if applicable
- update derived user summaries or enqueue summary recompute

---

## 14. Referral Binding Architecture

## 14.1 Binding Source

Referral binding should normally be executed during confirmed purchase processing, not during frontend connect.

### 14.2 Binding Algorithm

When processing a user’s first confirmed purchase:
1. check whether user already has bound referrer
2. check whether user has prior confirmed purchase
3. resolve pending referral capture candidate if available
4. validate candidate wallet
5. reject self-referral
6. reject cyclical relationship
7. insert immutable referral binding
8. update closure/path structures

### 14.3 Tree Storage Strategy

Use a dedicated referral tree representation optimized for reads.

Recommended:
- base `referral_bindings`
- closure table or materialized path support table for level queries

### 14.4 Manual Override Safety

Any admin binding correction must:
- be super-admin restricted
- be blocked if dependent reward history already exists unless explicit correction flow is used
- always generate audit logs

---

## 15. Qualification and Tier Evaluation Architecture

## 15.1 Resolver Inputs

Tier and qualification evaluation should use:
- user cumulative deposit
- user holding amount/value
- effective config version
- evaluation timestamp or settlement day

### 15.2 Implementation Guidance

Implement as pure calculation functions where possible:
- `isRewardQualified()`
- `resolveTier()`
- `resolveDirectRate()`
- `isTeamEligible()`
- `resolveTeamRate()`

### 15.3 Snapshot Strategy

The system may store current-user summaries for performance, but authoritative computation must be reproducible from facts plus config.

---

## 16. Settlement Architecture

## 16.1 Overview

Settlement is a daily UTC process producing official off-chain reward snapshots.

It should be implemented as a deterministic multi-stage pipeline.

### 16.2 Daily Settlement Stages

1. create settlement job record
2. resolve effective config version set for the day
3. prepare or validate team aggregates
4. enumerate eligible users
5. compute per-user team differential result
6. compute per-user equal-level replacement result
7. apply burn logic
8. persist daily snapshots and burn records
9. update summary tables
10. finalize settlement job and store metrics

### 16.3 Settlement Job Entity

Each run should have a settlement job record containing:
- settlement date
- mode
- status
- config version references
- start/end timestamps
- row counts
- error summary
- operator if manually triggered

### 16.4 Enumeration Strategy

Eligible users for team/equal-level settlement should be determined from current summary/qualification datasets rather than traversing the entire tree for every wallet blindly.

### 16.5 Per-User Calculation Strategy

For each eligible user:
1. fetch direct subordinate lines
2. resolve user tier and team rate
3. compute each line’s effective performance
4. resolve subordinate team rate for each line root
5. determine whether equal-level replacement applies
6. compute line differential or equal-level raw amount
7. sum raw reward totals
8. apply burn cap if applicable
9. persist snapshots

### 16.6 Equal-Level Replacement Handling

Equal-level logic must be evaluated line-by-line before line differential is finalized.

### 16.7 Burn Service Usage

Burn should be a reusable service that receives:
- user id / wallet
- settlement date
- raw reward totals
- holding value at snapshot
- previously used burn-counted amount

It returns:
- actual payable amount
- burned amount
- remaining capacity after settlement

### 16.8 Settlement Output Strategy

Recommended output pattern:
- one daily row per user for team reward snapshot
- one or multiple equal-level line rows, or a normalized child detail structure
- separate burn record entries when burn occurs
- aggregated user reward summary refresh

### 16.9 Idempotency

Settlement for a day should not create duplicates if rerun in the same mode. Use settlement job identity and uniqueness rules.

---

## 17. Summary and Aggregate Architecture

## 17.1 Why Summaries Are Needed

Some reads are too expensive for real-time recursive execution:
- user team page
- admin dashboards
- rankings
- settlement candidate scanning

Therefore the backend should maintain summary tables/materializations.

### 17.2 Recommended Summaries

- current user summary
- user reward summary
- team performance snapshot by day
- team level aggregate by day and level
- dashboard daily summary
- report export staging summary

### 17.3 Refresh Strategy

Use a hybrid approach:
- near-real-time refresh for user-level summaries after important processed events
- daily batch refresh for reporting summaries
- settlement-day refresh for team metrics

### 17.4 Rebuildability

Every summary must be rebuildable from source-of-truth tables.

---

## 18. Claim Architecture

## 18.1 Overview

Claim is an off-chain orchestration flow that locks claimable snapshots and coordinates payout execution.

### 18.2 Claim Stages

1. user requests claim
2. backend validates user status and minimum amount
3. backend fetches claimable snapshots
4. backend locks selected snapshots to a new claim order
5. backend returns signable claim intent payload
6. user signs with TP Wallet
7. backend verifies signature and moves order to queued state
8. payout broadcaster submits chain transaction or payout action
9. confirmation finalizes order and marks snapshots claimed

### 18.3 Claim Order Locking

Snapshot locking is mandatory to prevent double claim.

Lock requirements:
- a snapshot may belong to at most one non-terminal claim order
- terminal states release or finalize the lock as appropriate

### 18.4 Idempotency

Idempotency must apply to claim creation requests.

Recommended keys:
- `client_request_id`
- user wallet
- current selected snapshot set hash

### 18.5 Failure and Retry

Failures may occur in:
- signing
- broadcast
- confirmation

The system must distinguish:
- user never signed
- signed but not broadcast
- broadcast but not confirmed
- confirmed success

Retries must never produce duplicate payout.

### 18.6 Finalization Rule

Only after successful payout confirmation should:
- claim order become `confirmed`
- claim snapshots become `claimed`
- claim record be finalized

### 18.7 Adjustment Interaction

Negative adjustments should reduce future claimable balance and must be factored into reward summary reads.

---

## 19. Config Architecture

## 19.1 Versioned Config Storage

Config values must be stored as versioned entries, not mutable singletons.

### 19.2 Config Resolver

All runtime business logic should read config through a `ConfigResolverService`.

The resolver must determine the valid config version by:
- config key/group
- evaluation timestamp or settlement date
- apply scope
- user/order context when relevant

### 19.3 Config Categories

Recommended categories:
- pricing
- tier thresholds
- direct rate definitions
- team ladders
- equal-level settings
- burn settings
- vesting settings
- display settings
- claim settings
- sync settings

### 19.4 Validation

Before a config version is activated, backend validation should ensure:
- schema correctness
- range correctness
- no overlapping ladder intervals
- no invalid effective-from metadata

### 19.5 Config Change Audit

Every config write must generate:
- version record
- change history entry
- admin audit log entry

---

## 20. Recompute and Adjustment Architecture

## 20.1 Use Cases

- missed settlement day
- bug correction
- config interpretation correction
- reversal downstream correction
- payout discrepancy review

### 20.2 Supported Modes

- `backfill`
- `recompute_preview`
- `recompute_apply_adjustment`

### 20.3 Preview Mode

Produces a comparison result only.
No official financial records are mutated.

### 20.4 Apply Adjustment Mode

Produces difference rows without destructively rewriting immutable historical data.

### 20.5 Negative Adjustment Logic

If prior claim exceeded corrected entitlement:
- create negative adjustment record
- future claimable balance calculation offsets against that negative amount

### 20.6 Positive Adjustment Logic

If prior claim was too low:
- create positive adjustment record
- expose in claimable balance

### 20.7 Safety Guards

- apply mode restricted to super admin
- every run stores input config versions, counts, operator, reason
- diff report must be persisted or exportable

---

## 21. User Status Enforcement Architecture

## 21.1 Enforcement Locations

User status restrictions must be enforced in all of these places:
- purchase creation API
- claim creation API
- invite/binding-sensitive actions
- settlement eligibility enumeration
- admin UI response metadata

### 21.2 Service Pattern

Implement a `UserAccessPolicyService` that answers:
- canPurchase?
- canClaim?
- canBindReferral?
- canAccrueOffChainRewards?

Do not scatter status checks across random handlers.

---

## 22. Reporting Architecture

## 22.1 Operational Reporting

For admin dashboards and report pages, backend should provide aggregated endpoints instead of forcing frontend to compose raw datasets.

### 22.2 Recommended Reporting Jobs

- daily platform summary materialization
- daily user growth materialization
- daily reward issuance materialization
- daily burn materialization
- ranking refresh job

### 22.3 Export Strategy

Exports should be generated from stable read models or query snapshots, not ad-hoc unbounded live joins for every request.

### 22.4 Metrics Consistency

All reported metrics must align with the metric definitions document and business rule semantics.

---

## 23. Observability and Audit Architecture

## 23.1 Request Tracing

All API responses should include `request_id` or equivalent trace correlation identifier.

### 23.2 Job Logging

Each scheduled/background job should produce a job-run record with:
- job name
- status
- start/end time
- rows scanned
- rows processed
- rows failed
- error sample

### 23.3 Admin Audit Logging

Sensitive admin actions must always log:
- actor
- action
- target type
- target id
- before/after or relevant detail
- timestamp
- IP metadata if available

### 23.4 Business Event Logging

Recommended logs for:
- referral binding created
- purchase recovered
- claim broadcast failed
- settlement partial failure
- adjustment created

---

## 24. Performance Strategy

## 24.1 Heavy Query Avoidance

Avoid these patterns on hot paths:
- full recursive team traversal in user page request time
- repeated ladder parsing per row
- scanning entire chain history on every sync job
- joining raw chain events directly in admin page list endpoints

### 24.2 Recommended Optimizations

- indexed lookup tables
- daily aggregates
- paginated list endpoints
- precomputed summary tables
- line-root-focused settlement reads
- narrow projection queries

### 24.3 Pagination Defaults

Admin lists and large user lists should default to:
- page size 20 or 50
- server-side filtering and sorting

### 24.4 Read vs Write Isolation

When possible, summary refreshes should happen asynchronously after fact writes rather than blocking user-facing requests.

---

## 25. Security Architecture

## 25.1 Auth Security

- one-time nonce
- signature verification
- token expiration
- admin role verification

### 25.2 Data Security

- never trust wallet address passed from client without auth verification
- never expose internal adjustment data to ordinary users unless intended through summary views
- admin-only fields must be server-side filtered

### 25.3 Financial Safety

- claim locking required
- broadcast idempotency required
- settlement reruns guarded
- config changes versioned
- destructive rewrites prohibited on claimed history

### 25.4 Operational Safety

- super admin required for high-risk financial mutations
- preview before apply for recompute
- status changes logged with reason

---

## 26. Failure Handling Strategy

## 26.1 Categories of Failure

- request validation failure
- auth failure
- chain RPC failure
- sync partial failure
- settlement calculation failure
- claim broadcast failure
- summary refresh failure

### 26.2 Guiding Behavior

- preserve source facts already committed
- avoid partial double side effects
- allow safe retry where possible
- record failure state explicitly

### 26.3 Retry Candidates

Safe retry domains include:
- chain event confirmation polling
- failed event processing
- claim broadcast in non-duplicating states
- summary refresh jobs
- purchase recovery scans

### 26.4 Manual Intervention Candidates

Require admin intervention for:
- conflicting financial corrections
- complex reversal downstream effects
- repeated payout broadcast inconsistencies
- broken config version requiring business decision

---

## 27. Deployment and Runtime Separation

## 27.1 Environments

At minimum:
- local/dev
- staging
- production

### 27.2 Environment Variables

Backend env groups should include:
- database and supabase env
- RPC endpoint URLs
- contract addresses
- chain id
- auth signing settings
- admin session secrets
- payout/broadcast secrets if required
- confirmation threshold settings

### 27.3 Production Controls

Production should require:
- protected secrets
- migration discipline
- admin access control
- observability enabled
- rollback/recovery plan

---

## 28. Recommended Implementation Order

For code generation, implement backend in this order:

1. shared types and domain enums
2. config resolver
3. auth flows
4. core repositories
5. purchase order and chain event sync skeleton
6. purchase fact processing and referral binding
7. summary refresh basics
8. settlement engine
9. burn service
10. claim engine
11. admin APIs
12. recompute and adjustment flows
13. reporting and exports
14. observability hardening

---

## 29. Acceptance Criteria

The backend architecture is considered correctly implemented when all of the following are true:

1. wallet auth works with nonce + TP Wallet signature + session token
2. confirmed purchases become purchase facts exactly once
3. referral binding occurs only on first successful purchase and is immutable thereafter
4. chain events are scanned and processed idempotently
5. direct rewards are persisted as chain facts and are never burned
6. daily UTC team/equal-level settlement is deterministic
7. burn logic applies only to off-chain reward categories
8. claim flow locks snapshots and prevents duplicate claim
9. config versions resolve correctly by effective date and scope
10. recompute preview does not mutate official balances
11. apply-adjustment mode corrects future balances without rewriting claimed history
12. admin actions are permissioned and audited
13. operational monitoring exists for jobs, sync state, and failures

---

## 30. Next Documents

The next documents that must be implemented after this one are:

- `03_Database_Schema_Spec.md`
- `04_API_Spec.md`
- `07_State_Machines_And_Exception_Flows.md`

These documents will convert this architecture into concrete tables, endpoints, and state transitions.

