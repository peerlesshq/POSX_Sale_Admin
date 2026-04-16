# POSX Token Sale System — Seed Data and Mock Data

## 1. Document Control

- Document Name: `13_Seed_Data_And_Mock_Data.md`
- System Name: POSX Token Sale System
- Purpose: Define development seed data, staging fixture data, mock objects, sample business scenarios, and dataset patterns required for local development, integration testing, UI development, QA, and AI-assisted code generation
- Audience: Backend engineers, frontend engineers, QA, product, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `05_User_Frontend_PRD.md`
  - `06_Admin_Panel_PRD.md`
  - `07_State_Machines_And_Exception_Flows.md`
  - `09_Config_Center_Spec.md`
  - `11_Reporting_And_Metrics_Definition.md`
  - `12_Test_Cases.md`

---

## 2. Purpose and Scope

This document defines the seed and mock data needed to make the POSX system buildable, testable, and demoable from day one.

It covers:
- minimum system seed data
- admin account seeds
- default config seeds
- user fixture seeds
- referral tree fixture data
- purchase and vesting fixture data
- reward fixture data
- burn fixture data
- claim fixture data
- reporting fixture data
- frontend mock payloads
- recommended environment-specific data strategy

This document is designed so that:
- local development can boot with meaningful data
- frontend teams can build pages before real integrations are finished
- backend teams can run integration tests quickly
- QA can reproduce known business scenarios
- Cursor and Claude Code can generate realistic initial fixtures

---

## 3. Seed Data Design Principles

1. Seed data must reflect realistic business scenarios, not only trivial placeholders.
2. Every important business rule should have at least one matching seed scenario.
3. Seed data for local/dev should be deterministic.
4. Seed data for staging should be richer and closer to operational reality.
5. Mock data for frontend should mirror actual API response shape.
6. Seed data should separate source-of-truth facts from derived summaries.
7. Rebuildable summary tables may be seeded indirectly by running refresh jobs instead of hardcoding them.
8. Sensitive secrets must never be embedded in seed documents.
9. Wallet addresses in seed data may be synthetic and clearly non-production.
10. Seed scenarios should cover both happy paths and edge cases.

---

## 4. Environment Data Strategy

## 4.1 Local / Dev

Purpose:
- fast local bootstrapping
- deterministic development
- UI building and integration testing

Recommended contents:
- 1 super admin
- 1 operator admin
- 1 viewer admin
- baseline config versions
- 10 to 30 users
- 1 to 3 referral trees
- purchases, vesting lots, rewards, claims, burns, jobs, logs

## 4.2 Staging

Purpose:
- richer realistic testing
- full workflow validation
- performance sanity checks

Recommended contents:
- more users
- deeper referral structures
- multiple settlement days
- failed and partial job records
- pending and completed claims
- config version history

## 4.3 Production

Purpose:
- no artificial business seeds

Allowed initial data:
- super admin bootstrap account
- required config versions
- chain sync state initialization
- empty or minimum content entries

---

## 5. Minimum Required Seed Data

At minimum, the system should be able to boot with:

1. admin accounts
2. core config versions
3. chain sync state rows
4. optional content entries for public announcements

Recommended additional baseline for local/staging:
5. users
6. referral bindings and closure rows
7. purchases
8. vesting lots
9. direct rewards
10. team and equal-level reward snapshots
11. burn records
12. claim orders and claim records
13. summary tables or summary rebuild jobs

---

## 6. Admin Account Seed Data

Recommended admin seeds:

### Super Admin
- email: `superadmin@posx.local`
- role: `super_admin`
- status: `active`

### Operator
- email: `operator@posx.local`
- role: `operator`
- status: `active`

### Viewer
- email: `viewer@posx.local`
- role: `viewer`
- status: `active`

Notes:
- passwords should be environment-specific and hashed through real code, not hardcoded in plaintext in production
- for local/dev, clearly documented default credentials may be acceptable if isolated

---

## 7. Baseline Config Seed Data

The following config groups should be seeded at minimum.

## 7.1 Pricing

```json
{
  "config_group": "pricing",
  "config_key": "token_price",
  "version_no": 1,
  "config_value": {
    "token_price": "0.0618",
    "currency": "USDT"
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "next_settlement_day",
  "status": "active"
}
```

## 7.2 Purchase Rules

```json
{
  "config_group": "purchase_rules",
  "config_key": "minimum_purchase_amount",
  "version_no": 1,
  "config_value": {
    "minimum_purchase_amount": "1000",
    "currency": "USDT"
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "new_orders_only",
  "status": "active"
}
```

```json
{
  "config_group": "purchase_rules",
  "config_key": "quick_amount_options",
  "version_no": 1,
  "config_value": {
    "options": ["1000", "5000", "10000", "50000"]
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "all_users",
  "status": "active"
}
```

## 7.3 Qualification Rules

```json
{
  "config_group": "qualification_rules",
  "config_key": "reward_minimums",
  "version_no": 1,
  "config_value": {
    "reward_min_deposit_threshold": "1000",
    "reward_min_holding_threshold": "1000"
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "next_settlement_day",
  "status": "active"
}
```

## 7.4 Tier Definitions

```json
{
  "config_group": "tier_rules",
  "config_key": "tier_definitions",
  "version_no": 1,
  "config_value": {
    "tiers": [
      {
        "tier_code": "basic",
        "display_name": "Basic",
        "holding_min": "1000",
        "holding_max": "9999.999999999999999999",
        "deposit_min": "1000",
        "direct_rate": "0.05",
        "team_eligible": false
      },
      {
        "tier_code": "advanced",
        "display_name": "Advanced",
        "holding_min": "10000",
        "holding_max": "49999.999999999999999999",
        "deposit_min": "1000",
        "direct_rate": "0.10",
        "team_eligible": true
      },
      {
        "tier_code": "elite",
        "display_name": "Elite",
        "holding_min": "50000",
        "holding_max": null,
        "deposit_min": "1000",
        "direct_rate": "0.15",
        "team_eligible": true
      }
    ]
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "next_settlement_day",
  "status": "active"
}
```

## 7.5 Team Reward Rules

```json
{
  "config_group": "team_reward_rules",
  "config_key": "effective_depth",
  "version_no": 1,
  "config_value": {
    "effective_level_start": 2,
    "effective_level_end": 7
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "next_settlement_day",
  "status": "active"
}
```

```json
{
  "config_group": "team_reward_rules",
  "config_key": "team_ladders",
  "version_no": 1,
  "config_value": {
    "ladders": {
      "advanced": [
        {"performance_min": "1", "performance_max": "100000", "team_rate": "0.01"},
        {"performance_min": "100001", "performance_max": "500000", "team_rate": "0.03"},
        {"performance_min": "500001", "performance_max": "1000000", "team_rate": "0.05"},
        {"performance_min": "1000001", "performance_max": "5000000", "team_rate": "0.10"},
        {"performance_min": "5000001", "performance_max": null, "team_rate": "0.15"}
      ],
      "elite": [
        {"performance_min": "1", "performance_max": "100000", "team_rate": "0.02"},
        {"performance_min": "100001", "performance_max": "500000", "team_rate": "0.03"},
        {"performance_min": "500001", "performance_max": "1000000", "team_rate": "0.05"},
        {"performance_min": "1000001", "performance_max": "5000000", "team_rate": "0.10"},
        {"performance_min": "5000001", "performance_max": null, "team_rate": "0.15"}
      ]
    },
    "max_team_rate": "0.15"
  },
  "effective_from": "2026-01-01T00:00:00Z",
  "apply_scope": "next_settlement_day",
  "status": "active"
}
```

## 7.6 Equal-Level, Burn, Vesting, Claim, Display, Sync

Seed with the exact defaults from `09_Config_Center_Spec.md`.

---

## 8. Chain Sync State Seed Data

At minimum, seed one sync source per chain/contract pair.

Example:

```json
{
  "chain_id": 1,
  "contract_address": "0xseedcontract000000000000000000000000000001",
  "sync_key": "main_purchase_contract",
  "last_scanned_block": 0,
  "last_confirmed_block": 0
}
```

For staging, additional sync sources may be included for multiple contracts or networks.

---

## 9. Recommended User Fixture Set

Create a deterministic set of seed users with meaningful roles in the referral graph.

## 9.1 Suggested Wallet Aliases

- `W_ROOT_ELITE`
- `W_ADV_1`
- `W_ADV_2`
- `W_BASIC_1`
- `W_BASIC_2`
- `W_BASIC_3`
- `W_NEW_UNQUALIFIED`
- `W_RESTRICTED_PURCHASE`
- `W_RESTRICTED_CLAIM`
- `W_SUSPENDED`
- `W_BLACKLISTED`
- `W_NO_REFERRER`

## 9.2 Suggested User Status Seeds

- `W_ROOT_ELITE` -> `active`
- `W_ADV_1` -> `active`
- `W_ADV_2` -> `active`
- `W_BASIC_1` -> `active`
- `W_BASIC_2` -> `active`
- `W_BASIC_3` -> `active`
- `W_NEW_UNQUALIFIED` -> `active`
- `W_RESTRICTED_PURCHASE` -> `restricted_purchase`
- `W_RESTRICTED_CLAIM` -> `restricted_claim`
- `W_SUSPENDED` -> `suspended`
- `W_BLACKLISTED` -> `blacklisted`
- `W_NO_REFERRER` -> `active`

## 9.3 Suggested User Timing

Spread `created_at`, `first_authenticated_at`, and `first_purchase_at` across a realistic timeline so dashboard and report ranges have meaningful variation.

---

## 10. Referral Tree Fixture Scenarios

## 10.1 Scenario A — Simple Balanced Tree

Structure:

- `W_ROOT_ELITE`
  - `W_ADV_1`
    - `W_BASIC_1`
    - `W_BASIC_2`
  - `W_ADV_2`
    - `W_BASIC_3`

Purpose:
- baseline team performance
- direct referrals
- differential lines
- equal-level possibilities

## 10.2 Scenario B — Unqualified User with Pending Referral

- `W_NEW_UNQUALIFIED` opened referral link from `W_ADV_1`
- no successful purchase yet
- pending referral capture exists

Purpose:
- test “capture but not bound yet” behavior

## 10.3 Scenario C — Status Restricted Users

- `W_RESTRICTED_PURCHASE`
- `W_RESTRICTED_CLAIM`
- `W_SUSPENDED`
- `W_BLACKLISTED`

Purpose:
- test permission and UI restrictions

---

## 11. Purchase Fixture Scenarios

## 11.1 Baseline Purchases

Recommended confirmed purchases:

### `W_ROOT_ELITE`
- Purchase P1: `50000 USDT`

### `W_ADV_1`
- Purchase P2: `10000 USDT`
- Purchase P3: `5000 USDT`

### `W_ADV_2`
- Purchase P4: `12000 USDT`

### `W_BASIC_1`
- Purchase P5: `3000 USDT`

### `W_BASIC_2`
- Purchase P6: `1500 USDT`

### `W_BASIC_3`
- Purchase P7: `1000 USDT`

### `W_NO_REFERRER`
- Purchase P8: `2000 USDT`

These amounts provide meaningful tier variation under default config.

## 11.2 Failed / Pending Purchase Orders

Create additional purchase orders for local/staging:
- one `purchase_pending`
- one `failed`
- one `cancelled`

Purpose:
- test pending and exception UI

## 11.3 Recovery Scenario

Create one purchase order and tx hash recovery scenario where:
- original order did not finalize normally
- recovery request exists
- final purchase fact exists

---

## 12. Vesting Fixture Scenarios

Each confirmed purchase should generate one `vesting_lot`.

## 12.1 Lot Diversity

Seed lots across states such as:
- just locked, release not started
- partially released
- partially withdrawn
- fully completed

Example distribution:
- `W_ROOT_ELITE`: one active partially released lot
- `W_ADV_1`: one active early lock lot, one partially released lot
- `W_BASIC_1`: one active lot with small released amount

## 12.2 Summary Consistency

Either:
- seed `user_vesting_summary` directly for convenience in local dev
- or derive it from job/rebuild logic after lot insertion

Recommended for correctness:
- generate summary from lots

---

## 13. Direct Reward Fixture Scenarios

Use confirmed purchase facts and referral structure to create direct reward facts.

Examples:
- `W_ADV_1` refers `W_BASIC_1` and receives direct reward on `W_BASIC_1` purchase
- `W_ADV_1` refers `W_BASIC_2` and receives direct reward on `W_BASIC_2` purchase
- `W_ROOT_ELITE` refers `W_ADV_1` and receives direct reward on `W_ADV_1` purchases

Purpose:
- test reward history display
- test direct total reporting
- verify direct rewards remain unaffected by burn

---

## 14. Team Reward Fixture Scenarios

Seed at least three daily settlement dates.

## 14.1 Settlement Day A — Normal Differential Day

Goal:
- differential reward lines without equal-level replacement

Expected setup:
- `W_ROOT_ELITE` has rate above subordinate line rates
- team reward snapshot with line details exists

## 14.2 Settlement Day B — Equal-Level Replacement Day

Goal:
- `W_ROOT_ELITE` and `W_ADV_1` or similar line have same team rate
- equal-level replacement applies on one line

Expected setup:
- team line detail marked `equal_level_replaced = true`
- equal-level reward row exists

## 14.3 Settlement Day C — Burn Day

Goal:
- user below or at burn threshold receives partially burned team/equal-level rewards

Expected setup:
- raw > actual
- burn record exists

---

## 15. Equal-Level Reward Fixture Scenarios

Seed at least one user with:
- same-level subordinate line
- subordinate team cumulative performance above threshold
- valid equal-level daily reward row

Example:
- `W_ROOT_ELITE` and `W_ADV_1` resolve to same team rate on a particular settlement day
- `W_ADV_1` subordinate performance threshold met

Purpose:
- test equal-level display and reporting

---

## 16. Burn Fixture Scenarios

Create users for both burn states:

### Burn Disabled User
- holding value > `10000`
- no burn applied

### Burn Enabled User
- holding value = `8000`
- used burn capacity already non-zero
- current settlement partially burned

Seed burn record example:

```json
{
  "wallet_address": "w_basic_2",
  "reward_type": "team",
  "settle_date": "2026-04-12",
  "holding_value_at_snapshot": "8000",
  "used_burn_capacity_before": "7900",
  "burn_cap": "8000",
  "raw_amount": "300",
  "burned_amount": "200",
  "actual_amount": "100",
  "reason": "burn_cap_exceeded"
}
```

Purpose:
- verify burn UI, reports, and formulas

---

## 17. Claim Fixture Scenarios

Create at least these claim scenarios:

### C1 — Successful Claim
- claim order `confirmed`
- linked snapshots `claimed`
- claim record `confirmed`

### C2 — Pending Signature Claim
- claim order `pending_signature`
- snapshots locked

### C3 — Queued or Broadcasted Claim
- claim order in-flight
- snapshots locked

### C4 — Failed Claim
- claim order `failed`
- snapshots released back to claimable if policy requires

### C5 — Cancelled Claim
- claim order `cancelled`
- snapshots unlocked

Purpose:
- drive frontend claim-state rendering and backend retry logic tests

---

## 18. Adjustment Fixture Scenarios

Create at least:

### Positive Adjustment
- credit remaining > 0

### Negative Adjustment
- debit remaining > 0

### Fully Offset Adjustment
- remaining amount = 0
- status = `fully_offset`

Purpose:
- test claimable summary behavior and recompute correction display

---

## 19. Settlement Job Fixture Scenarios

Create settlement jobs with varying statuses:
- `completed`
- `partial`
- `failed`
- recompute preview completed
- recompute apply completed

Purpose:
- test admin settlement jobs page
- test recompute history display

Each should have realistic counts and timestamps.

---

## 20. Job Run and System Health Fixture Scenarios

## 20.1 Job Runs

Seed job runs such as:
- `sync_contract_events` completed
- `settle_team_rewards` completed
- `settle_equal_level_rewards` partial
- `rebuild_dashboard_daily_summary` completed
- `export_reward_report` failed

## 20.2 System Health Checks

Seed a mix of statuses:
- `database` -> `ok`
- `chain_sync` -> `warn`
- `claim_broadcaster` -> `ok`
- `report_export` -> `error`

Purpose:
- test admin system pages and health banners

---

## 21. Audit Log Fixture Scenarios

Seed admin audit entries for:
- user status update
- config version creation
- settlement trigger
- recompute preview
- recompute apply
- admin account creation/update

Purpose:
- test logs page and operational audit drill-down

---

## 22. Dynamic Content Fixture Scenarios

Seed at least these content entries:

### Global Notice
```json
{
  "content_group": "global_notice",
  "content_key": "main_banner",
  "content_value": {
    "zh-CN": "系统结算基于 UTC 时间，请留意结算时间。",
    "zh-TW": "系統結算基於 UTC 時間，請留意結算時間。",
    "en": "Settlement is based on UTC time. Please note the settlement schedule.",
    "ko": "정산은 UTC 기준으로 진행됩니다. 정산 시간을 확인해 주세요."
  }
}
```

### Buy Page Notice
### Rewards Page Notice

Purpose:
- test i18n + dynamic content rendering

---

## 23. Recommended Local Mock API Payloads

Frontend mock payloads should match real API shapes exactly.

## 23.1 Mock: User Profile

```json
{
  "wallet_address": "0xrootelite000000000000000000000000000001",
  "status": "active",
  "referrer_address": null,
  "referral_bound": false,
  "bound_at": null,
  "cumulative_deposit": "50000",
  "holding_posx_amount": "809061.488673139158576051",
  "holding_value_usdt": "50000",
  "current_tier": "elite",
  "reward_qualified": true,
  "team_reward_qualified": true,
  "direct_rate": "0.15",
  "team_rate": "0.15",
  "created_at": "2026-04-01T00:00:00Z"
}
```

## 23.2 Mock: Dashboard

```json
{
  "overview": {
    "cumulative_deposit": "50000",
    "holding_value_usdt": "50000",
    "current_tier": "elite",
    "locked_posx_total": "809061.488673139158576051",
    "referral_count": 2
  },
  "claimable": {
    "direct_claimable": "0",
    "team_claimable": "300",
    "equal_level_claimable": "120",
    "adjustment_credit_claimable": "20",
    "total_claimable": "440"
  },
  "reward_summary": {
    "direct_total": "500",
    "team_total": "800",
    "equal_level_total": "200",
    "burned_total": "50"
  },
  "burn_status": {
    "burn_enabled": false,
    "holding_value_usdt": "50000",
    "burn_cap": null,
    "used_burn_capacity": null,
    "remaining_burn_capacity": null
  },
  "vesting_summary": {
    "total_locked": "809061.488673139158576051",
    "total_released": "12000",
    "total_withdrawable": "6000",
    "total_withdrawn": "6000"
  },
  "recent_purchases": []
}
```

## 23.3 Mock: Team Overview

```json
{
  "team_total_performance": "31500",
  "today_effective_performance": "4000",
  "claimable_amount": "420",
  "pending_confirmation_amount": "60",
  "total_received": "1000",
  "total_claimed": "580",
  "current_team_rate": "0.03",
  "current_tier": "advanced",
  "next_rate_target": {
    "next_rate": "0.05",
    "required_team_total_performance": "500001",
    "remaining_needed": "468501"
  }
}
```

## 23.4 Mock: Invite

```json
{
  "invite_unlocked": true,
  "unlock_threshold": "1000",
  "current_cumulative_deposit": "12000",
  "invite_link": "https://posx.local?r=adv1",
  "referral_code": "adv1",
  "referral_count": 2,
  "referral_stats": {
    "total_referral_deposit": "4500",
    "active_referral_count": 2
  }
}
```

## 23.5 Mock: Admin Dashboard Summary

```json
{
  "summary": {
    "platform_total_deposit": "84500",
    "today_deposit": "3000",
    "total_users": 12,
    "today_new_users": 1,
    "total_locked_posx": "1367313.915857605177993528",
    "total_released_posx": "24000",
    "reward_24h": {
      "direct": "150",
      "team": "420",
      "equal_level": "120"
    },
    "burn_total": "200"
  },
  "trend": [],
  "tier_distribution": []
}
```

---

## 24. Recommended Frontend Demo Scenarios

To help UI development, prepare mock personas:

### Persona A — Elite Leader
- lots of deposits
- multiple direct referrals
- team + equal-level claimable rewards
- no burn

### Persona B — Basic User with Burn
- low holding value
- some off-chain rewards
- visible burn progress

### Persona C — New User
- no purchases yet
- invite locked
- no rewards

### Persona D — Restricted Claim User
- can see rewards but claim button disabled

### Persona E — Pending Purchase User
- purchase order in `purchase_pending`

### Persona F — Pending Signature Claim User
- claim modal/in-flight state demo

---

## 25. Recommended SQL / Seeder Implementation Strategy

## 25.1 Seed Order

Recommended insertion order:
1. admin users
2. config versions
3. chain sync state
4. users
5. referral pending captures
6. referral bindings
7. referral closure
8. purchase orders
9. purchases
10. purchase recoveries / reversals if needed
11. vesting lots
12. direct rewards
13. settlement jobs
14. team reward snapshots
15. team line details
16. equal-level rewards
17. burn records
18. claim orders
19. claim order items
20. claim records
21. adjustment records
22. content entries
23. summaries/materializations
24. admin logs and job runs

## 25.2 Summary Table Strategy

Preferred approach:
- seed source-of-truth data
- run summary rebuild jobs to populate summary tables

Fallback for local speed:
- seed summaries directly only if rebuild pipeline is not available yet

---

## 26. Data Volume Recommendations

## 26.1 Local Dev

Recommended counts:
- users: 10–20
- purchases: 10–30
- settlement dates: 3–5
- claim orders: 3–8
- burn records: 1–5
- admin logs: 10–20

## 26.2 Staging

Recommended counts:
- users: 50–500
- purchases: 100–2000
- settlement dates: 10–30
- claim orders: 20–200
- burn records: 10–100
- logs/jobs: realistic operational volume

---

## 27. Seed Maintenance Rules

1. Seed fixtures must stay synchronized with business rule changes.
2. Config defaults in seed data must match the latest config spec.
3. Mock API payloads must match the latest API contract exactly.
4. If a state machine changes, at least one seed scenario should cover each important status.
5. Local seeds should remain human-readable and deterministic.

---

## 28. QA and Developer Usage Recommendations

### QA
Use seed scenarios to:
- verify page rendering
- reproduce core rule behaviors
- validate reporting and export totals

### Frontend Engineers
Use mock payloads to:
- build UI before backend ready
- test empty/loading/filled states
- test restricted and in-flight states

### Backend Engineers
Use seeded source-of-truth data to:
- validate query correctness
- test settlement generation
- test claim locking
- test config resolution over historical dates

---

## 29. Acceptance Criteria

This seed and mock data spec is sufficient when all are true:

1. local dev can boot the full product with meaningful data
2. at least one seed scenario exists for every major business flow
3. mock payloads match API spec shape exactly
4. source-of-truth seeds cover purchases, rewards, burns, claims, and config
5. frontend can render happy path, empty state, restricted state, and in-flight state using provided mock personas
6. QA can execute the core test plan using deterministic seed fixtures
7. summary tables can be rebuilt from seeded facts where intended

---

## 30. Next Document

The next implementation document should be:
- `14_Deployment_And_Env_Spec.md`

That document should define environment setup, secrets, deployment flow, and operational runtime settings for the seeded system.

