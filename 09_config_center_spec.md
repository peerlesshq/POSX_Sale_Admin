# POSX Token Sale System — Config Center Spec

## 1. Document Control

- Document Name: `09_Config_Center_Spec.md`
- System Name: POSX Token Sale System
- Purpose: Define the full configuration model, config groups, config keys, value schemas, effectiveness rules, validation policies, versioning semantics, operational workflows, and risk controls for the POSX system
- Audience: Backend engineers, frontend engineers, operations, product, QA, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `06_Admin_Panel_PRD.md`
  - `07_State_Machines_And_Exception_Flows.md`
  - `08_Auth_And_Permissions_Spec.md`

---

## 2. Purpose and Scope

The Config Center is the operational control layer for all mutable business and display settings in the POSX Token Sale System.

It exists to ensure that:
- reward logic is configurable without uncontrolled code edits
- changes are versioned and auditable
- effective dates and scope are explicit
- future and historical calculations remain consistent
- risky changes are visible before they take effect
- frontend and backend consume the same resolved business configuration

This document covers:
- config model
- config group taxonomy
- config key definitions
- default values
- value schemas
- `effective_from` rules
- `apply_scope` rules
- validation rules
- version lifecycle
- admin workflow
- rollback and supersession policy
- risk controls

---

## 3. Configuration Design Principles

1. Config must be versioned, not overwritten in place.
2. Historical calculations must always resolve the config version that was effective at that time.
3. Every config change must have an explicit `effective_from` and `apply_scope`.
4. Business-critical config must default to future effectiveness, not immediate mutation.
5. Schema validation must happen before version activation.
6. Config resolution must be centralized through backend services.
7. Frontend must never hardcode sensitive business constants.
8. Display config and financial config may share a platform but must remain logically separated.
9. Config changes must be auditable and attributable to an admin actor.
10. High-risk config changes must be reviewable and clearly explained in UI.

---

## 4. Config Model Overview

A config item is defined by:
- `config_group`
- `config_key`
- `version_no`
- `config_value`
- `effective_from`
- `apply_scope`
- `status`
- `description`
- `created_by_admin_id`
- `created_at`

Each config version is immutable after creation except for status lifecycle changes allowed by policy.

Recommended lifecycle statuses:
- `draft`
- `active`
- `superseded`
- `disabled`

---

## 5. `effective_from` Semantics

## 5.1 Definition

`effective_from` is the earliest UTC timestamp at which a config version may be resolved as valid for matching scope.

## 5.2 General Rule

Unless explicitly stated otherwise, config changes should become effective on the next UTC day.

## 5.3 Operational Rule

For v1, Admin UI should default `effective_from` to the next UTC day at `00:00:00Z` for business-sensitive settings.

## 5.4 Immediate Effect Policy

Immediate same-day effectiveness should be discouraged for business-critical config. If later supported, it must be explicitly approved by product/security policy and clearly labeled in the UI.

---

## 6. `apply_scope` Semantics

Allowed `apply_scope` values:
- `all_users`
- `new_users_only`
- `new_orders_only`
- `next_settlement_day`

## 6.1 `all_users`

Meaning:
- applies globally to all relevant reads/writes from `effective_from` onward

Typical use:
- display content
- public UI settings
- general app presentation config

## 6.2 `new_users_only`

Meaning:
- applies only to users created after `effective_from`

Typical use:
- onboarding/policy variants if ever needed
- should be used sparingly in v1

## 6.3 `new_orders_only`

Meaning:
- applies only to orders or purchase-related actions created after `effective_from`

Typical use:
- minimum purchase amount
- vesting parameter changes for future purchases
- purchase UX configuration tied to new transactions only

## 6.4 `next_settlement_day`

Meaning:
- applies from the next settlement-effective business day forward
- used for future settlement calculations, not retroactive rewrites

Typical use:
- tier thresholds
- team ladder rules
- equal-level rule values
- burn rule values
- claim minimum configuration if claim policy wants daily consistency

---

## 7. Config Resolution Rules

The backend must resolve config through a centralized config resolver.

Resolution inputs may include:
- `config_group`
- `config_key`
- evaluation timestamp
- settlement date
- user creation timestamp if needed
- order creation timestamp if needed
- scope-specific context

## 7.1 Resolution Priority

For a given key, select the latest valid version where:
- `status` is usable for resolution
- `effective_from <= evaluation_time`
- `apply_scope` matches the business context

If multiple versions could match, choose the most recent valid version by `effective_from`, then by `version_no` if needed.

## 7.2 Historical Integrity

Settlement and recompute must use the version that was valid for the original settlement date and scope.

## 7.3 Missing Config Behavior

If required config is missing:
- backend should fail safely
- operational alert/log should be generated
- admin UI should surface invalid config state

Do not silently fall back to code constants for critical business rules.

---

## 8. Config Categories and Ownership

Recommended config categories:
- pricing
- purchase_rules
- qualification_rules
- tier_rules
- team_reward_rules
- equal_level_rules
- burn_rules
- vesting_rules
- claim_rules
- display_rules
- sync_rules
- system_limits

Each category must have a clear owner internally, even if all are edited in the same Admin Panel.

---

## 9. Config Group and Key Definitions

## 9.1 `pricing`

### Key: `token_price`

Purpose:
- define the POSX sale price used for frontend display and holding-value-based business evaluation where applicable

Suggested `config_value` schema:

```json
{
  "token_price": "0.0618",
  "currency": "USDT"
}
```

Recommended default:
- `token_price = 0.0618`

Recommended `apply_scope`:
- `next_settlement_day` for tier/holding-value business usage
- public display may read current active version

Validation rules:
- `token_price > 0`
- currency must be `USDT` in v1

Risk level:
- High, because it affects tier and holding-value evaluation logic if used in those rules

---

## 9.2 `purchase_rules`

### Key: `minimum_purchase_amount`

Purpose:
- define minimum USDT amount for new purchase creation

Schema:

```json
{
  "minimum_purchase_amount": "1000",
  "currency": "USDT"
}
```

Default:
- `1000`

Recommended `apply_scope`:
- `new_orders_only`

Validation:
- positive numeric string
- currency must be `USDT`

### Key: `quick_amount_options`

Purpose:
- define frontend quick-select amount buttons

Schema:

```json
{
  "options": ["1000", "5000", "10000", "50000"]
}
```

Recommended `apply_scope`:
- `all_users`

Validation:
- non-empty array
- all values positive
- values should be unique and ascending

---

## 9.3 `qualification_rules`

### Key: `reward_minimums`

Purpose:
- define the base qualification thresholds for off-chain reward eligibility

Schema:

```json
{
  "reward_min_deposit_threshold": "1000",
  "reward_min_holding_threshold": "1000"
}
```

Defaults:
- deposit threshold = `1000`
- holding threshold = `1000`

Recommended `apply_scope`:
- `next_settlement_day`

Validation:
- both must be non-negative
- holding threshold should not exceed the first meaningful tier lower bound unless intentionally desired

Risk level:
- High

---

## 9.4 `tier_rules`

### Key: `tier_definitions`

Purpose:
- define tier names, holding-value thresholds, direct rates, and team eligibility flags

Schema:

```json
{
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
}
```

Recommended `apply_scope`:
- `next_settlement_day`

Validation:
- no overlapping intervals
- exactly one open-ended upper tier at most
- all `direct_rate` values between `0` and `1`
- tier order must be strictly ascending by `holding_min`
- `tier_code` must be unique

Risk level:
- Very high

---

## 9.5 `team_reward_rules`

### Key: `effective_depth`

Purpose:
- define the descendant depth range used for effective team performance

Schema:

```json
{
  "effective_level_start": 2,
  "effective_level_end": 7
}
```

Default:
- start = `2`
- end = `7`

Recommended `apply_scope`:
- `next_settlement_day`

Validation:
- both positive integers
- `effective_level_start <= effective_level_end`

### Key: `team_ladders`

Purpose:
- define team rate ladders by qualifying tier

Schema:

```json
{
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
}
```

Recommended `apply_scope`:
- `next_settlement_day`

Validation:
- no overlap within each ladder
- rates between `0` and `1`
- `max_team_rate` consistent with ladder entries
- referenced tier codes must exist in tier definitions

Risk level:
- Very high

---

## 9.6 `equal_level_rules`

### Key: `equal_level_policy`

Purpose:
- define same-level replacement conditions and reward rate

Schema:

```json
{
  "equal_level_rate": "0.03",
  "subordinate_team_performance_threshold": "100000",
  "replacement_enabled": true
}
```

Defaults:
- equal level rate = `0.03`
- threshold = `100000`
- replacement enabled = `true`

Recommended `apply_scope`:
- `next_settlement_day`

Validation:
- rate between `0` and `1`
- threshold >= `0`

Risk level:
- High

---

## 9.7 `burn_rules`

### Key: `burn_policy`

Purpose:
- define burn enable/disable threshold and cap model

Schema:

```json
{
  "burn_disable_threshold": "10000",
  "cap_basis": "holding_value",
  "applies_to": ["team", "equal_level"],
  "excludes": ["direct"]
}
```

Default:
- burn disable threshold = `10000`
- cap basis = `holding_value`
- applies to = team + equal_level

Recommended `apply_scope`:
- `next_settlement_day`

Validation:
- threshold >= `0`
- `cap_basis` limited to supported values
- no unsupported reward types

Risk level:
- Very high

---

## 9.8 `vesting_rules`

### Key: `vesting_policy`

Purpose:
- define parameters for newly created vesting lots

Schema:

```json
{
  "lock_days": 90,
  "release_days": 365,
  "mode": "lot_based"
}
```

Defaults:
- lock_days = `90`
- release_days = `365`
- mode = `lot_based`

Recommended `apply_scope`:
- `new_orders_only`

Validation:
- `lock_days >= 0`
- `release_days > 0`
- mode must be `lot_based` in v1

Risk level:
- High

---

## 9.9 `claim_rules`

### Key: `claim_policy`

Purpose:
- define minimum claim amount and optional claim constraints

Schema:

```json
{
  "min_claim_amount": "10",
  "claim_scope_default": "claim_all",
  "allow_claim_by_type": true,
  "pending_signature_ttl_minutes": 30
}
```

Defaults:
- min claim amount = `10`
- claim scope default = `claim_all`
- allow claim by type = `true`
- pending signature TTL = `30`

Recommended `apply_scope`:
- `next_settlement_day` or `all_users` depending on policy

Validation:
- min claim amount >= `0`
- TTL positive integer

Risk level:
- Medium to high

---

## 9.10 `display_rules`

### Key: `enabled_languages`

Schema:

```json
{
  "languages": ["zh-CN", "zh-TW", "en", "ko"]
}
```

Recommended `apply_scope`:
- `all_users`

### Key: `announcements`

Schema:

```json
{
  "announcement_key": "global_notice",
  "content": {
    "zh-CN": "...",
    "zh-TW": "...",
    "en": "...",
    "ko": "..."
  }
}
```

Recommended `apply_scope`:
- `all_users`

### Key: `theme_options`

Schema:

```json
{
  "themes": ["light", "dark"]
}
```

Risk level:
- Low

---

## 9.11 `sync_rules`

### Key: `chain_sync_policy`

Purpose:
- define confirmation threshold and sync behavior constants

Schema:

```json
{
  "min_confirmations": 12,
  "scan_batch_size": 500,
  "reorg_safety_window": 20
}
```

Recommended `apply_scope`:
- `all_users` or internal operational scope

Validation:
- all positive integers

Risk level:
- High, operationally

---

## 9.12 `system_limits`

### Key: `pagination_defaults`

Schema:

```json
{
  "default_page_size": 20,
  "max_page_size": 100
}
```

### Key: `report_export_limits`

Schema:

```json
{
  "max_export_rows": 100000,
  "retention_days": 7
}
```

Risk level:
- Medium

---

## 10. Config Validation Rules

## 10.1 General Validation

Every config write must be validated for:
- required fields present
- schema shape valid
- numeric strings parse correctly
- positive/range rules satisfied
- unsupported enum values rejected
- `effective_from` present
- `apply_scope` present

## 10.2 Interval Validation

For tier and ladder configs:
- no overlap
- no gaps if business expects continuity
- min <= max where max exists
- only one open-ended interval per sequence

## 10.3 Cross-Config Validation

When creating a config version, backend should verify important dependencies.

Examples:
- ladder tier codes must exist in tier definitions
- max team rate should align with ladder entries
- qualification thresholds should not logically break tier design
- enabled languages should match allowed platform locale set

## 10.4 Unsafe Change Warning Logic

UI and backend should classify certain changes as high risk.

Examples:
- token price change
- tier threshold change
- team ladder change
- burn threshold change
- vesting parameter change

High-risk config writes should display warnings and require explicit confirmation in admin UI.

---

## 11. Config Version Lifecycle

Allowed statuses:
- `draft`
- `active`
- `superseded`
- `disabled`

## 11.1 Draft

Used when:
- config has been prepared but not yet made active for resolution

## 11.2 Active

Used when:
- config is valid and eligible for resolution based on `effective_from` and `apply_scope`

## 11.3 Superseded

Used when:
- config has historical value but a newer config now governs future evaluations

## 11.4 Disabled

Used when:
- config should not be used for future resolution

## 11.5 Recommended Operational Policy

In v1, config can be created directly as `active` if:
- validation passes
- effective time is in the future or intentionally current

Draft support may still be retained for future workflow maturity.

---

## 12. Admin Workflow for Config Changes

## 12.1 Read Current State

Admin must be able to see:
- current effective config
- future scheduled config versions
- historical versions

## 12.2 Create New Version

Admin workflow:
1. choose config group
2. choose config key
3. edit structured config value
4. set `effective_from`
5. set `apply_scope`
6. enter description/note
7. submit for validation
8. on success, store new version and history record

## 12.3 Review History

Admin must be able to compare:
- old value
- new value
- who changed it
- when changed
- when effective
- scope

## 12.4 Disable Version

If version disabling is allowed:
- action should be restricted by role/policy
- disabling must not break historical resolution for past calculations
- disabling should be rare and audited

---

## 13. Role Permissions for Config Center

### Viewer
Can:
- read current config
- read history

Cannot:
- create versions
- disable versions

### Operator
Can:
- create config versions
- read history

Cannot:
- perform super-admin-only exceptional overrides if such policy is introduced later

### Super Admin
Can:
- perform all config actions
- manage exceptional recovery or disable workflows if supported

---

## 14. Config Center UI Requirements

The Admin Config Center should show:
- config group list
- current effective versions
- future scheduled versions
- per-key history
- create new version action
- impact warning for high-risk groups

## 14.1 Required UI Fields for Version Creation

- config group
- config key
- structured value editor
- `effective_from`
- `apply_scope`
- description

## 14.2 UI Helper Requirements

The UI should display:
- current active version summary
- incoming version summary
- whether change affects settlement, new orders, or all users
- UTC label on effective time

## 14.3 Confirmation Requirements

For high-risk config changes, UI should require:
- explicit confirmation modal
- summary of affected module
- warning that historical results are not retroactively rewritten

---

## 15. Audit and History Requirements

Every config change must create:
- a new `config_versions` row
- a `config_change_history` row
- an `admin_logs` entry

Audit must capture:
- config group
- config key
- version number
- old value
- new value
- effective_from
- apply_scope
- actor admin id
- timestamp
- change note

---

## 16. Rollback and Supersession Policy

## 16.1 No In-Place Rollback

Do not mutate an old version to become something else.

## 16.2 Recommended Rollback Method

Rollback should be implemented by creating a new config version that restores previous effective values, with its own:
- version number
- effective time
- scope
- audit trail

## 16.3 Supersession Behavior

Older active versions become historically superseded by newer future-effective versions but must remain available for past resolution.

---

## 17. Historical Calculation Rules

Historical calculations must always use the config version that was valid at the time.

This applies to:
- settlement
- recompute preview
- recompute apply
- burn evaluation
- tier evaluation
- claim policy evaluation where date-sensitive
- purchase/vesting rules for a given purchase

Do not use the latest current config when replaying old business days unless an intentional migration policy explicitly says so.

---

## 18. Frontend Consumption Rules

## 18.1 Public Config Consumption

User frontend may consume a filtered public subset of config via `GET /api/v1/config/public`.

This subset may include:
- token price
- min purchase amount
- quick amount options
- min claim amount
- enabled languages
- announcements
- theme options

## 18.2 Admin Frontend Consumption

Admin frontend should consume config through admin APIs with full metadata, including:
- version number
- effective time
- scope
- status
- history

## 18.3 No Hardcoded Business Constants

Frontend must not hardcode:
- min purchase amount
- claim minimum
- quick amount options
- tier thresholds
- team ladder values
- burn thresholds

---

## 19. Backend Consumption Rules

Backend business logic must consume config through a centralized resolver service.

Direct table reads inside scattered business handlers are discouraged because they increase inconsistency risk.

Recommended service calls:
- `resolvePricingConfig(context)`
- `resolveTierRules(context)`
- `resolveTeamRules(context)`
- `resolveBurnRules(context)`
- `resolveClaimRules(context)`
- `resolveDisplayRules(context)`

---

## 20. Missing or Invalid Config Handling

## 20.1 Missing Required Config

If required config is missing:
- backend should fail safely for affected operation
- error should be logged
- health signal should be raised
- admin UI should surface broken config state

## 20.2 Invalid Config Found in Runtime

If an invalid config version somehow exists:
- backend should not silently use it for critical financial calculations
- operation should fail fast with operational alert
- admin should correct through a new valid version or disable path

---

## 21. High-Risk Config Groups

The following groups should be treated as high risk:
- pricing
- qualification_rules
- tier_rules
- team_reward_rules
- equal_level_rules
- burn_rules
- vesting_rules
- claim_rules (if affecting financial behavior)
- sync_rules

UI should surface high-risk badge and stronger confirmation for these groups.

---

## 22. Recommended Config Defaults Summary

```json
{
  "pricing.token_price": {"token_price": "0.0618", "currency": "USDT"},
  "purchase_rules.minimum_purchase_amount": {"minimum_purchase_amount": "1000", "currency": "USDT"},
  "purchase_rules.quick_amount_options": {"options": ["1000", "5000", "10000", "50000"]},
  "qualification_rules.reward_minimums": {"reward_min_deposit_threshold": "1000", "reward_min_holding_threshold": "1000"},
  "team_reward_rules.effective_depth": {"effective_level_start": 2, "effective_level_end": 7},
  "equal_level_rules.equal_level_policy": {"equal_level_rate": "0.03", "subordinate_team_performance_threshold": "100000", "replacement_enabled": true},
  "burn_rules.burn_policy": {"burn_disable_threshold": "10000", "cap_basis": "holding_value", "applies_to": ["team", "equal_level"], "excludes": ["direct"]},
  "vesting_rules.vesting_policy": {"lock_days": 90, "release_days": 365, "mode": "lot_based"},
  "claim_rules.claim_policy": {"min_claim_amount": "10", "claim_scope_default": "claim_all", "allow_claim_by_type": true, "pending_signature_ttl_minutes": 30},
  "display_rules.enabled_languages": {"languages": ["zh-CN", "zh-TW", "en", "ko"]},
  "display_rules.theme_options": {"themes": ["light", "dark"]},
  "sync_rules.chain_sync_policy": {"min_confirmations": 12, "scan_batch_size": 500, "reorg_safety_window": 20},
  "system_limits.pagination_defaults": {"default_page_size": 20, "max_page_size": 100}
}
```

---

## 23. QA Checklist for Config Center

QA must verify at minimum:

1. config version cannot be created without `effective_from`
2. config version cannot be created without `apply_scope`
3. overlapping intervals are rejected for ladders and tiers
4. invalid numeric/rate values are rejected
5. history records are written for every config change
6. admin logs are created for every config mutation
7. public config endpoint returns only intended public subset
8. future-effective config does not affect current day logic prematurely
9. historical recompute resolves correct historical config version
10. rollback through new version works without mutating past rows

---

## 24. Acceptance Criteria

This document is correctly implemented when all are true:

1. all mutable business rules are represented as versioned config, not hardcoded runtime assumptions
2. every config version has `effective_from` and `apply_scope`
3. backend resolves config centrally and historically correctly
4. admin can read current config, future config, and history clearly
5. invalid config payloads are rejected before activation
6. high-risk config groups are clearly flagged
7. frontend uses public config instead of hardcoded business constants
8. config changes are fully auditable
9. rollback happens through new version creation, not destructive overwrite
10. settlement and recompute remain historically consistent under config changes

---

## 25. Next Documents

The next implementation documents should be:
- `10_I18N_And_Content_Spec.md`
- `11_Reporting_And_Metrics_Definition.md`
- `12_Test_Cases.md`

These define translation/content behavior, metric formulas, and test coverage on top of the config model.

