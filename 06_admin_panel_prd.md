# POSX Token Sale System — Admin Panel PRD

## 1. Document Control

- Document Name: `06_Admin_Panel_PRD.md`
- System Name: POSX Token Sale System
- Scope: Admin-facing web console only
- Audience: Frontend engineers, backend engineers, product, operations, QA, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `07_State_Machines_And_Exception_Flows.md`
  - `09_Config_Center_Spec.md`
  - `11_Reporting_And_Metrics_Definition.md`

---

## 2. Product Objective

The Admin Panel is the operational control center for the POSX token sale and reward system.

Its responsibilities are to let authorized admins:
- monitor platform activity and business health
- inspect users, purchases, rewards, burns, vesting, referral structures, and claim activity
- manage business configuration in a versioned, auditable way
- monitor chain sync, background jobs, and settlement runs
- execute operational corrections using preview-first, adjustment-based workflows
- export reports and review audit history

The Admin Panel must optimize for:
- operational clarity
- financial safety
- auditability
- role-based access control
- efficiency for day-to-day operations

---

## 3. Design Principles

1. **Operations first.** Every page must answer a real operational question.
2. **No silent mutation.** High-risk actions must be explicit and reviewable.
3. **Readability over density.** Admins need confidence more than raw compactness.
4. **Search, filter, and drill-down everywhere useful.**
5. **Versioned business changes must be visible before and after activation.**
6. **Preview before apply for risky actions.**
7. **Audit trail must be one click away.**
8. **System health and sync lag must be visible.**
9. **All financial numbers must be backend-sourced.**
10. **All UTC business logic must be clearly labeled.**

---

## 4. Admin Roles

### 4.1 Super Admin

Can:
- access all pages
- create and manage admin accounts
- create config versions
- apply financial corrections
- run recompute apply actions
- change any user status
- view all logs and system diagnostics

### 4.2 Operator

Can:
- access most operational pages
- inspect users, rewards, burns, sync status, jobs, and reports
- create config versions within allowed policy
- trigger allowed settlement/backfill jobs
- run recompute preview
- change user statuses where permitted

Cannot:
- perform super-admin-only actions
- manage admin accounts unless explicitly allowed
- apply recompute adjustments

### 4.3 Viewer

Can:
- read dashboards, users, rewards, reports, logs, and system summaries

Cannot:
- mutate configs
- change statuses
- trigger jobs
- apply corrections

---

## 5. Technical Scope

### 5.1 Stack

- Vite
- React
- TypeScript
- Ant Design Pro
- React Query or equivalent
- Router-based SPA
- role-aware route guards

### 5.2 Session Model

- admin login with session token
- protected routes
- role-based UI visibility and action disabling

### 5.3 Display Conventions

- all dates default to UTC display with clear label
- all amounts shown with exact backend values
- long hashes and wallet addresses copyable
- primary tables support filters, sorting, pagination, export where relevant

---

## 6. Admin Information Architecture

Primary routes:

- `/login`
- `/dashboard`
- `/users`
- `/users/:wallet_address`
- `/users/:wallet_address/tree`
- `/rewards/direct`
- `/rewards/team`
- `/rewards/equal-level`
- `/rewards/burns`
- `/config`
- `/reports`
- `/settlement/jobs`
- `/recompute`
- `/system/chain-sync`
- `/system/jobs`
- `/system/health`
- `/logs`
- `/admin-accounts`

Navigation groups:
- Overview
- Users
- Rewards
- Configuration
- Reports
- Settlement & Corrections
- System
- Security / Admin

---

## 7. Global Admin Shell

## 7.1 Layout

Desktop-first admin shell with:
- left navigation
- top bar
- content container
- global notification layer
- slide-over/drawer support
- global filter/date context where helpful

### 7.2 Top Bar

Includes:
- current page title
- optional date range quick picker
- environment badge (staging / production)
- UTC time indicator
- current admin name and role
- logout

### 7.3 Left Navigation

Sections:
- Dashboard
- Users
- Rewards
- Config
- Reports
- Settlement Jobs
- Recompute
- Chain Sync
- System Jobs
- System Health
- Audit Logs
- Admin Accounts

Role-based visibility:
- hide unavailable pages by role where appropriate
- or show disabled entries with lock icon if preferred by UX policy

### 7.4 Global Warning Banners

Show prominent banners for:
- chain sync lag beyond threshold
- settlement job failure
- production mode high-risk action reminder
- invalid or missing config warning
- report/export subsystem failure

---

## 8. Common UI Patterns

## 8.1 List Pages

Every major list page should support:
- filter panel
- keyword search
- pagination
- server-side sorting
- row click to detail page or drawer
- export entry if business-appropriate

### 8.2 Detail Pages

Detail pages should use:
- summary header
- tabs or sections
- action bar
- timeline or audit panel where appropriate

### 8.3 Dangerous Actions

For high-risk actions use:
- confirmation modal
- typed reason input or required textarea
- explicit role check
- success toast + audit note

### 8.4 Status Tags

Use consistent status tags for:
- user status
- claim status
- purchase status
- settlement job status
- chain event status
- config status

### 8.5 UTC Labels

Every date-based operational page must show a note like:
- “All business dates shown in UTC unless noted otherwise.”

---

## 9. Login Page PRD

Route:
- `/login`

Goal:
- secure admin sign-in

## 9.1 Page Elements

- email field
- password field
- sign-in button
- error message area
- environment label

### 9.2 Behavior

On success:
- store admin session token
- redirect to `/dashboard`

On failure:
- show clear message
- do not reveal sensitive auth details

### 9.3 States

- idle
- submitting
- invalid credentials
- admin disabled

---

## 10. Dashboard Page PRD

Route:
- `/dashboard`

Goal:
- provide a real operational snapshot of platform business and system status

## 10.1 Data Source

- `GET /api/v1/admin/dashboard`

## 10.2 Page Sections

### A. KPI Summary Cards
Display:
- platform total deposit
- today deposit
- total users
- today new users
- total locked POSX
- total released POSX
- 24h direct reward total
- 24h team reward total
- 24h equal-level reward total
- total burn amount

### B. Trend Charts
Show time-series charts for selected range:
- deposit total
- new users count
- total rewards issued

### C. Tier Distribution
Show chart/table for tier distribution.

### D. Operational Health Snapshot
Display compact health indicators:
- chain sync status
- last settlement status
- pending recompute jobs
- failed jobs in last 24h

Each health card should deep-link to the relevant system page.

### E. Quick Actions
Role-aware quick actions:
- trigger settlement backfill
- open recompute preview
- open config center
- open logs

Super admin only actions should not appear for lower roles.

## 10.3 Loading and Error States

- skeleton cards and charts on load
- compact retry panel on failure

---

## 11. User Management List Page PRD

Route:
- `/users`

Goal:
- let admins search, segment, and inspect users efficiently

## 11.1 Data Source

- `GET /api/v1/admin/users`

## 11.2 Filter Panel

Filters:
- wallet address search
- status
- tier
- min deposit
- max deposit
- created from / to
- sort by
- sort order

### 11.3 Table Columns

- wallet address
- status
- cumulative deposit
- holding value (USDT)
- current tier
- referrer address
- direct referral count
- team total performance
- created at
- actions

### 11.4 Row Actions

- View Detail
- Open Tree
- Change Status

### 11.5 Bulk Actions

Not required in v1 unless clearly needed. Avoid risky bulk mutation in first release.

### 11.6 Empty State

- no matching users found
- clear filters CTA

---

## 12. User Detail Page PRD

Route:
- `/users/:wallet_address`

Goal:
- give operations a full operational view of one user

## 12.1 Data Sources

- `GET /api/v1/admin/users/{wallet_address}`
- supporting linked list pages for deeper drill-down if needed

## 12.2 Page Header

Display:
- wallet address
- copy button
- status tag
- current tier
- action buttons

Action buttons:
- Change Status
- View Tree
- Open Reward Records
- Open Purchases

## 12.3 Sections / Tabs

### A. Identity
- wallet address
- status
- created at
- first purchase at

### B. Referral
- referrer address
- bound at
- binding source
- direct referral count

### C. Financial Snapshot
- cumulative deposit
- holding POSX amount
- holding value (USDT)
- current tier
- reward qualification
- team reward qualification
- team total performance

### D. Reward Summary
- direct total
- team total
- equal-level total
- claimable total
- burned total

### E. Vesting Summary
- total locked
- total released
- total withdrawable
- total withdrawn

### F. Linked Activity Sections
Optional linked cards to open filtered lists for:
- purchases
- direct rewards
- team rewards
- equal-level rewards
- claims
- burns

## 12.4 Status Change Flow

Open modal with:
- current status
- target status dropdown
- effective_from datetime
- required reason
- optional note

Permission behavior:
- operator and super admin per policy
- viewer sees no action

---

## 13. Referral Tree Page PRD

Route:
- `/users/:wallet_address/tree`

Goal:
- visualize and inspect a user’s referral network

## 13.1 Data Source

- `GET /api/v1/admin/users/{wallet_address}/tree`

## 13.2 Views

Support at least two modes:
- tree view
- flat table view

### 13.3 Tree View

Each node shows:
- wallet address
- parent wallet address
- depth
- status
- cumulative deposit
- current tier

### 13.4 Flat View Filters

- max depth
- search wallet
- status
- tier

### 13.5 Performance Rules

- default max depth should be limited
- deeper load by explicit action
- do not render extremely deep trees all at once without lazy expansion

---

## 14. Direct Rewards Page PRD

Route:
- `/rewards/direct`

Goal:
- inspect chain-backed direct reward records

## 14.1 Data Source

- `GET /api/v1/admin/rewards/direct`

## 14.2 Filter Panel

- recipient wallet
- source wallet
- date range

### 14.3 Table Columns

- direct reward id
- from wallet
- to wallet
- purchase amount
- reward rate
- reward amount
- tx hash
- rewarded at

### 14.4 Detail Drawer

Optional drawer for:
- linked purchase id
- block number
- raw payload reference if needed later

### 14.5 Notes

Display helper note:
- direct rewards are chain-backed and not subject to burn

---

## 15. Team Rewards Page PRD

Route:
- `/rewards/team`

Goal:
- inspect daily team reward settlements and drill into line calculations

## 15.1 Data Sources

- `GET /api/v1/admin/rewards/team`
- `GET /api/v1/admin/rewards/team/{team_reward_daily_id}`

## 15.2 Filter Panel

- wallet address
- settle date
- status
- date range

### 15.3 Table Columns

- team reward daily id
- wallet address
- settle date
- qualification tier
- user team rate
- team total performance
- effective performance
- raw total
- burned amount
- actual total
- status
- action: View Detail

### 15.4 Detail Drawer / Page

Display:
- summary header
- line detail table

Line detail columns:
- line root wallet address
- line effective performance
- subordinate team rate
- differential rate
- raw reward amount
- equal-level replaced

### 15.5 Use Cases

This page is primarily for:
- explaining payouts
- validating settlement logic
- auditing user disputes

---

## 16. Equal-Level Rewards Page PRD

Route:
- `/rewards/equal-level`

Goal:
- inspect equal-level replacement rewards

## 16.1 Data Source

- `GET /api/v1/admin/rewards/equal-level`

## 16.2 Filters

- wallet address
- line root wallet address
- settle date
- status

### 16.3 Table Columns

- equal-level reward id
- wallet address
- line root wallet address
- settle date
- equal-level rate
- subordinate team total performance
- line effective performance
- raw amount
- burned amount
- actual amount
- status

### 16.4 Detail Behavior

Row expand or detail drawer optional for showing relationship to settlement job.

---

## 17. Burn Records Page PRD

Route:
- `/rewards/burns`

Goal:
- give operations and finance visibility into burn enforcement

## 17.1 Data Source

- `GET /api/v1/admin/rewards/burns`

## 17.2 Filters

- wallet address
- reward type
- date range

### 17.3 Table Columns

- burn record id
- wallet address
- reward type
- settle date
- holding value at snapshot
- used burn capacity before
- burn cap
- raw amount
- burned amount
- actual amount
- reason

### 17.4 Purpose

This page should make it easy to explain:
- why a user received less than raw amount
- which cap was applied
- what the remaining room was at that time

---

## 18. Config Center Page PRD

Route:
- `/config`

Goal:
- manage versioned business and display configuration safely

## 18.1 Data Sources

- `GET /api/v1/admin/config`
- `POST /api/v1/admin/config`
- `GET /api/v1/admin/config/history`

## 18.2 Page Structure

Tabs or sections by config group:
- pricing
- tier thresholds
- team ladders
- equal-level settings
- burn settings
- vesting settings
- claim settings
- display settings

### 18.3 Current Effective Config List

Table columns:
- config group
- config key
- version no
- summarized value
- effective from
- apply scope
- status
- description
- action: View / New Version / History

### 18.4 Create New Version Flow

Form fields:
- config group
- config key
- config value editor
- effective_from
- apply_scope
- description

Validation:
- backend must validate schema and ranges
- frontend should show helpful inline rules

### 18.5 History Drawer

Display:
- old value
- new value
- changed by
- changed at
- effective from
- apply scope
- note

### 18.6 Safety UI

For sensitive config groups:
- show impact warning
- show “takes effect next UTC day” helper when relevant
- show current active version and incoming version side-by-side

---

## 19. Reports Page PRD

Route:
- `/reports`

Goal:
- let admins analyze core business metrics and export structured reports

## 19.1 Data Sources

- `GET /api/v1/admin/reports/summary`
- `GET /api/v1/admin/reports/rankings/team`
- `POST /api/v1/admin/reports/export`
- `GET /api/v1/admin/reports/export/{report_export_job_id}`

## 19.2 Sections

### A. Report Filters
- from date
- to date
- granularity

### B. Totals Cards
- deposit total
- direct reward total
- team reward total
- equal-level reward total
- burn total
- claim total

### C. Series Charts
- deposits over time
- rewards over time
- burn over time

### D. Team Ranking Table
Columns:
- rank
- wallet address
- team total performance
- current tier
- team rate

### E. Export Center
Allow export job creation for selected report types.

Display export job status table with:
- report export job id
- report type
- status
- created at
- finished at
- file path or download action

---

## 20. Settlement Jobs Page PRD

Route:
- `/settlement/jobs`

Goal:
- inspect daily settlement and backfill runs

## 20.1 Data Sources

- `GET /api/v1/admin/settlement/jobs`
- `GET /api/v1/admin/settlement/jobs/{settlement_job_id}`
- `POST /api/v1/admin/settlement/trigger`

## 20.2 Filters

- settlement date
- job type
- status

### 20.3 Table Columns

- settlement job id
- job type
- mode
- settlement date
- status
- processed user count
- created snapshot count
- created adjustment count
- error count
- started at
- finished at
- action: View Detail

### 20.4 Trigger Backfill Action

Available to allowed roles.

Modal fields:
- settlement date
- mode (backfill)
- reason

### 20.5 Job Detail View

Display:
- core metadata
- config version snapshot
- counts
- error sample
- reason
- triggered by

---

## 21. Recompute Page PRD

Route:
- `/recompute`

Goal:
- support preview-first operational financial correction workflow

## 21.1 Data Sources

- `POST /api/v1/admin/recompute/preview`
- `POST /api/v1/admin/recompute/apply`
- `GET /api/v1/admin/settlement/jobs`
- `GET /api/v1/admin/settlement/jobs/{settlement_job_id}`

## 21.2 Main Sections

### A. Recompute Control Panel
Fields:
- settlement date
- reason

Actions:
- Run Preview
- Apply Adjustment

Role behavior:
- preview for operator+
- apply for super admin only

### B. Preview Result Panel
After preview completes, show:
- processed user count
- difference count
- positive difference total
- negative difference total
- link to detailed job view

### C. Safety Messaging
Show clear messages:
- preview does not mutate official balances
- apply creates adjustment records and does not rewrite claimed history

### D. Apply Flow
For super admin only:
- confirmation modal
- required reason
- optional second confirmation text input if desired in production

---

## 22. Chain Sync Page PRD

Route:
- `/system/chain-sync`

Goal:
- monitor synchronization state of blockchain event ingestion

## 22.1 Data Source

- `GET /api/v1/admin/system/chain-sync`

## 22.2 Table Columns

- chain id
- contract address
- sync key
- last scanned block
- last confirmed block
- last scanned at
- updated at
- derived lag metrics if computed client-side from backend data or delivered directly later

### 22.3 Health Indicators

Show warnings when:
- scan lag exceeds threshold
- updated_at stale beyond threshold

### 22.4 Future Extensibility

Page should allow expansion later for:
- raw event queue health
- failed processing count
- reorg incident visibility

---

## 23. System Jobs Page PRD

Route:
- `/system/jobs`

Goal:
- inspect scheduled and background job execution history

## 23.1 Data Source

- `GET /api/v1/admin/system/jobs`

## 23.2 Filters

- job name
- status
- date range

### 23.3 Table Columns

- job run id
- job name
- status
- started at
- finished at
- rows scanned
- rows processed
- rows failed
- error message

### 23.4 Use Cases

- verify scheduled jobs are healthy
- inspect failures
- identify unusually slow runs

---

## 24. System Health Page PRD

Route:
- `/system/health`

Goal:
- show high-level health checks across critical backend subsystems

## 24.1 Data Source

- `GET /api/v1/admin/system/health`

## 24.2 Display

Card or table per health check:
- health key
- status
- checked at
- detail

Suggested checks:
- database
- chain sync
- settlement pipeline
- report export subsystem
- claim broadcaster

### 24.3 Visual Priority

Use clear severity hierarchy:
- ok
- warn
- error

---

## 25. Audit Logs Page PRD

Route:
- `/logs`

Goal:
- inspect admin audit trails

## 25.1 Data Source

- `GET /api/v1/admin/logs`

## 25.2 Filters

- admin user id
- action
- target type
- date range

### 25.3 Table Columns

- admin log id
- admin user id or name
- action
- target type
- target id
- detail summary
- IP address
- created at

### 25.4 Detail Drawer

Show full structured detail JSON in readable format.

### 25.5 Use Cases

- review status changes
- review config changes
- review recompute or settlement triggers
- review admin account changes

---

## 26. Admin Accounts Page PRD

Route:
- `/admin-accounts`

Goal:
- manage admin users and roles

## 26.1 Data Sources

- `GET /api/v1/admin/accounts`
- `POST /api/v1/admin/accounts`
- `PATCH /api/v1/admin/accounts/{admin_user_id}`

## 26.2 Access

Super admin only.

## 26.3 Table Columns

- admin user id
- email
- name
- role
- status
- last login at
- created at
- actions

### 26.4 Actions

- Create Admin
- Edit Admin

### 26.5 Create Admin Modal

Fields:
- email
- password
- name
- role

### 26.6 Edit Admin Modal

Fields:
- name
- role
- status

Safety note:
- changing one’s own role should be protected by policy if desired in implementation

---

## 27. Page-Level Permission Matrix

## 27.1 Viewer
Can access:
- dashboard
- users list/detail/tree
- all reward pages
- reports
- settlement jobs view
- chain sync
- system jobs
- system health
- logs

Cannot mutate.

## 27.2 Operator
Can access everything viewer can, plus:
- config create version if allowed
- user status change if allowed
- settlement trigger
- recompute preview
- report exports

Cannot:
- recompute apply
- admin accounts management unless granted separately

## 27.3 Super Admin
Can access all pages and all actions.

---

## 28. Global Loading, Empty, and Error States

## 28.1 Loading

Use page skeletons for large pages.
Use table loading states for list refreshes.
Use button loading states for actions.

## 28.2 Empty States

Provide empty states for:
- no users matching filter
- no burn records
- no reward rows in range
- no logs in range
- no export jobs yet

## 28.3 Error States

Pages should support:
- inline error panel
- retry
- partial page resilience where one widget fails but others remain visible

---

## 29. Search, Filter, and Query Param Strategy

All major admin pages should persist useful filters in route query parameters where practical.

Benefits:
- refresh-safe state
- sharable operational views
- predictable browser back behavior

Suggested pages for query-param persistence:
- users
- reward pages
- reports
- settlement jobs
- logs

---

## 30. Forms and Validation Rules

## 30.1 User Status Form
- target status required
- reason required
- effective time required if delayed action supported

## 30.2 Config Version Form
- config group required
- config key required
- config value required
- effective_from required
- apply_scope required
- backend validation authoritative

## 30.3 Recompute / Settlement Forms
- settlement date required
- reason required

## 30.4 Admin Account Form
- email required
- valid email format
- name required
- role required
- password required on create

---

## 31. Notifications and Success Messaging

Use toast/notification patterns for:
- config version created
- user status updated
- settlement triggered
- recompute preview completed
- recompute apply started
- export job created
- admin account created/updated

Error notifications should use backend `error_code` mapping plus meaningful message.

---

## 32. Page-by-Page API Mapping Summary

### Login
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/logout`

### Dashboard
- `GET /api/v1/admin/dashboard`

### Users
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{wallet_address}`
- `PATCH /api/v1/admin/users/{wallet_address}/status`
- `GET /api/v1/admin/users/{wallet_address}/tree`

### Rewards
- `GET /api/v1/admin/rewards/direct`
- `GET /api/v1/admin/rewards/team`
- `GET /api/v1/admin/rewards/team/{team_reward_daily_id}`
- `GET /api/v1/admin/rewards/equal-level`
- `GET /api/v1/admin/rewards/burns`

### Config
- `GET /api/v1/admin/config`
- `POST /api/v1/admin/config`
- `GET /api/v1/admin/config/history`

### Reports
- `GET /api/v1/admin/reports/summary`
- `GET /api/v1/admin/reports/rankings/team`
- `POST /api/v1/admin/reports/export`
- `GET /api/v1/admin/reports/export/{report_export_job_id}`

### Settlement & Recompute
- `POST /api/v1/admin/settlement/trigger`
- `GET /api/v1/admin/settlement/jobs`
- `GET /api/v1/admin/settlement/jobs/{settlement_job_id}`
- `POST /api/v1/admin/recompute/preview`
- `POST /api/v1/admin/recompute/apply`

### System
- `GET /api/v1/admin/system/chain-sync`
- `GET /api/v1/admin/system/jobs`
- `GET /api/v1/admin/system/health`
- `GET /api/v1/admin/logs`

### Admin Accounts
- `GET /api/v1/admin/accounts`
- `POST /api/v1/admin/accounts`
- `PATCH /api/v1/admin/accounts/{admin_user_id}`

---

## 33. UX Notes for Financial Safety

1. Never allow recompute apply from an inline row button without a confirmation flow.
2. Always show reason fields for user status changes and operational correction actions.
3. Always show which data is historical fact vs current summary when ambiguity exists.
4. Label pages and fields clearly when values are based on UTC daily settlement.
5. Avoid auto-refreshing detail screens during active admin review unless explicitly opted in.

---

## 34. Acceptance Criteria

The Admin Panel is considered correct when all are true:

1. admin can log in and role-based navigation works correctly
2. dashboard provides operationally useful overview of business and system state
3. users can be searched, filtered, opened, and their referral tree inspected
4. reward pages allow investigation of direct, team, equal-level, and burn records
5. config center supports versioned config management with history visibility
6. reports page supports analysis and export job workflow
7. settlement jobs page shows official runs and backfills clearly
8. recompute page supports preview-first correction workflow and restricts apply to super admin
9. chain sync, job history, and system health are operationally visible
10. audit log page clearly exposes sensitive admin actions
11. admin account management is available to super admin only
12. all high-risk actions are auditable and gated by role

---

## 35. Recommended Implementation Order

1. admin auth and protected shell
2. dashboard
3. user list and user detail
4. reward pages
5. config center
6. reports and export center
7. settlement jobs page
8. recompute page
9. system monitoring pages
10. logs page
11. admin accounts page

---

## 36. Next Documents

The next documents to implement are:
- `07_State_Machines_And_Exception_Flows.md`
- `08_Auth_And_Permissions_Spec.md`
- `09_Config_Center_Spec.md`
- `11_Reporting_And_Metrics_Definition.md`

These documents will define state transitions, access control detail, config semantics, and metric formulas used by this panel.

