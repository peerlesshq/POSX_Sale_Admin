# POSX Token Sale System — Database Schema Spec

## 1. Document Control

- Document Name: `03_Database_Schema_Spec.md`
- System Name: POSX Token Sale System
- Purpose: Define the PostgreSQL / Supabase schema, source-of-truth boundaries, indexes, constraints, enum strategy, summary tables, and migration guidance for code generation
- Audience: Backend engineers, Cursor, Claude Code, QA, DevOps
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
- Must Be Used Together With:
  - `04_API_Spec.md`
  - `07_State_Machines_And_Exception_Flows.md`

---

## 2. Schema Design Principles

1. Confirmed chain-backed facts must be stored separately from orchestration records.
2. Source-of-truth tables must not be casually overwritten.
3. Derived summary tables must be rebuildable.
4. Every critical mutable business rule must be versioned.
5. Financial correction must use adjustment records rather than destructive edits.
6. Every major lifecycle object must have an explicit status field.
7. Large operational reads should rely on summary tables where possible.
8. Tables that can grow quickly must have proper indexes from day one.
9. All timestamps should use `timestamptz` and all business-day logic should use UTC.
10. Wallet addresses should be normalized to lowercase before persistence.

---

## 3. Schema Overview

The database is organized into the following groups:

### 3.1 Identity and Access
- `users`
- `user_sessions`
- `auth_nonces`
- `admin_users`
- `admin_sessions`

### 3.2 Referral and Team Topology
- `referral_bindings`
- `referral_closure`
- `referral_pending_captures`

### 3.3 Purchase and Chain Facts
- `purchase_orders`
- `purchases`
- `purchase_recoveries`
- `purchase_reversals`
- `chain_events`
- `chain_sync_state`

### 3.4 Rewards and Settlement
- `direct_rewards`
- `team_rewards_daily`
- `team_reward_line_details`
- `equal_level_rewards_daily`
- `burn_records`
- `claim_orders`
- `claim_order_items`
- `claim_records`
- `adjustment_records`
- `settlement_jobs`

### 3.5 Vesting
- `vesting_lots`
- `user_vesting_summary`

### 3.6 Configuration and Content
- `config_versions`
- `config_change_history`
- `content_entries`

### 3.7 Reporting and Summaries
- `user_reward_summary`
- `team_performance_snapshot`
- `team_level_aggregate_daily`
- `dashboard_daily_summary`
- `report_export_jobs`

### 3.8 Operations and Audit
- `admin_logs`
- `job_runs`
- `system_health_checks`
- `error_events`

---

## 4. Enum Strategy

Prefer PostgreSQL enums only for very stable values. For values likely to change, use constrained text columns plus check constraints.

Recommended enum-like fields as constrained text:
- user status
- order status
- claim status
- event status
- reward type
- config apply scope
- adjustment direction
- admin role
- job status

This is friendlier for migrations than hard PostgreSQL enums in fast-moving product logic.

---

## 5. Normalization Rules

### 5.1 Wallet Address
- store as lowercase text
- validate format in application layer
- index heavily

### 5.2 Amount Fields
- use `numeric(38, 18)` for token quantities and monetary values
- never use floating point for financial values

### 5.3 Timestamps
- use `timestamptz`
- include `created_at`
- include `updated_at` for mutable tables
- include business-specific timestamps where needed

### 5.4 JSONB Usage
Use `jsonb` only when structure is semi-flexible or audit-oriented, such as:
- raw chain event payload
- config value objects
- diff previews
- admin log detail
- multilingual content blob

Do not use `jsonb` to replace obviously relational structures like claim items or reward line details.

---

## 6. Source of Truth vs Derived Tables

## 6.1 Source-of-Truth Tables
These are authoritative and must not be overwritten casually:

- `users` for user identity only, not computed finance truth
- `referral_bindings`
- `referral_closure`
- `purchase_orders`
- `purchases`
- `purchase_recoveries`
- `purchase_reversals`
- `chain_events`
- `chain_sync_state`
- `direct_rewards`
- `team_rewards_daily`
- `team_reward_line_details`
- `equal_level_rewards_daily`
- `burn_records`
- `claim_orders`
- `claim_order_items`
- `claim_records`
- `adjustment_records`
- `vesting_lots`
- `config_versions`
- `config_change_history`
- `settlement_jobs`
- `admin_logs`
- `job_runs`

## 6.2 Derived / Rebuildable Tables
These can be recomputed from source-of-truth data:

- `user_vesting_summary`
- `user_reward_summary`
- `team_performance_snapshot`
- `team_level_aggregate_daily`
- `dashboard_daily_summary`
- `system_health_checks`

---

## 7. Identity and Access Tables

## 7.1 `users`

Purpose:
- canonical wallet-based user identity row
- current operational status
- immutable identity-level metadata

Columns:
- `wallet_address text primary key`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `first_seen_at timestamptz`
- `first_authenticated_at timestamptz`
- `first_purchase_at timestamptz`
- `last_login_at timestamptz`
- `last_active_at timestamptz`
- `status_changed_at timestamptz`
- `status_reason text`
- `status_note text`

Constraints:
- `status in ('active','restricted_purchase','restricted_claim','suspended','blacklisted')`

Indexes:
- index on `status`
- index on `created_at desc`
- index on `first_purchase_at desc`

Notes:
- Do not put financial source-of-truth aggregates here.
- Optional current snapshot columns may be added later, but if so, they must be clearly marked as derived cache.

---

## 7.2 `auth_nonces`

Purpose:
- one-time wallet login nonce store

Columns:
- `id bigserial primary key`
- `wallet_address text not null`
- `nonce text not null`
- `expires_at timestamptz not null`
- `used_at timestamptz`
- `created_at timestamptz not null default now()`

Indexes:
- index on `wallet_address`
- unique index on `nonce`
- index on `expires_at`

Recommended cleanup:
- periodic delete of expired rows older than retention window

---

## 7.3 `user_sessions`

Purpose:
- user wallet session records

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `session_token_hash text not null`
- `issued_at timestamptz not null`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `ip_address text`
- `user_agent text`
- `created_at timestamptz not null default now()`

Indexes:
- index on `wallet_address`
- unique index on `session_token_hash`
- index on `expires_at`

---

## 7.4 `admin_users`

Purpose:
- admin identity store

Columns:
- `id uuid primary key`
- `email text not null unique`
- `password_hash text not null`
- `role text not null`
- `name text not null`
- `status text not null default 'active'`
- `last_login_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `role in ('super_admin','operator','viewer')`
- `status in ('active','disabled')`

Indexes:
- index on `role`
- index on `status`

---

## 7.5 `admin_sessions`

Purpose:
- admin session state

Columns:
- `id uuid primary key`
- `admin_user_id uuid not null references admin_users(id)`
- `session_token_hash text not null unique`
- `issued_at timestamptz not null`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `ip_address text`
- `user_agent text`
- `created_at timestamptz not null default now()`

Indexes:
- index on `admin_user_id`
- index on `expires_at`

---

## 8. Referral and Team Topology Tables

## 8.1 `referral_pending_captures`

Purpose:
- optional backend-side storage for referral candidates before first successful purchase
- useful if frontend referral code must be persisted server-side

Columns:
- `id uuid primary key`
- `wallet_address text not null`
- `candidate_referrer_address text not null`
- `capture_source text not null default 'referral_link'`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`

Constraints:
- `capture_source in ('referral_link','manual_seed','import')`

Indexes:
- index on `wallet_address`
- index on `candidate_referrer_address`
- index on `expires_at`

Recommended uniqueness:
- partial unique index on `wallet_address` where not expired can be enforced in application logic or using a cleanup strategy

---

## 8.2 `referral_bindings`

Purpose:
- immutable parent-child referral relationship

Columns:
- `child_wallet_address text primary key references users(wallet_address)`
- `parent_wallet_address text not null references users(wallet_address)`
- `binding_source text not null`
- `binding_tx_hash text`
- `bound_at timestamptz not null`
- `is_locked boolean not null default true`
- `created_at timestamptz not null default now()`

Constraints:
- `binding_source in ('referral_link','admin_import','manual_correction')`
- application-level validation required to prevent self-referral

Indexes:
- index on `parent_wallet_address`
- index on `bound_at desc`

Notes:
- child is unique: one child can have only one parent
- parent can have many children

---

## 8.3 `referral_closure`

Purpose:
- closure table for fast team depth queries

Columns:
- `ancestor_wallet_address text not null references users(wallet_address)`
- `descendant_wallet_address text not null references users(wallet_address)`
- `depth integer not null`
- `created_at timestamptz not null default now()`

Primary Key:
- `(ancestor_wallet_address, descendant_wallet_address)`

Constraints:
- `depth >= 1`
- no self rows in this table for this use case

Indexes:
- index on `descendant_wallet_address`
- index on `(ancestor_wallet_address, depth)`
- index on `(ancestor_wallet_address, created_at desc)`

Usage:
- direct subordinates = `depth = 1`
- team performance depth filtering = `depth between X and Y`

---

## 9. Purchase and Chain Tables

## 9.1 `purchase_orders`

Purpose:
- off-chain orchestration record for purchase flow

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `client_order_id text not null`
- `status text not null`
- `usdt_amount numeric(38,18) not null`
- `expected_posx_amount numeric(38,18)`
- `token_price_snapshot numeric(38,18)`
- `approval_tx_hash text`
- `purchase_tx_hash text`
- `chain_id bigint`
- `contract_address text`
- `failure_reason text`
- `risk_flag text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `confirmed_at timestamptz`

Constraints:
- `status in ('created','approval_pending','approval_done','purchase_pending','confirmed','failed','reversed','cancelled')`

Indexes:
- unique index on `(wallet_address, client_order_id)`
- unique index on `purchase_tx_hash` where `purchase_tx_hash is not null`
- index on `wallet_address`
- index on `status`
- index on `created_at desc`

---

## 9.2 `purchases`

Purpose:
- confirmed purchase facts

Columns:
- `id uuid primary key`
- `purchase_order_id uuid references purchase_orders(id)`
- `wallet_address text not null references users(wallet_address)`
- `chain_id bigint not null`
- `contract_address text not null`
- `tx_hash text not null`
- `block_number bigint not null`
- `log_index integer`
- `usdt_amount numeric(38,18) not null`
- `posx_amount numeric(38,18) not null`
- `token_price_at_purchase numeric(38,18) not null`
- `purchase_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `is_reversed boolean not null default false`

Constraints:
- unique `(chain_id, tx_hash, coalesce(log_index, -1))` should be enforced via expression or application layer if `log_index` is nullable

Recommended simpler uniqueness:
- unique `(chain_id, tx_hash)` if one purchase event per tx is guaranteed

Indexes:
- index on `wallet_address`
- index on `purchase_at desc`
- index on `(wallet_address, purchase_at desc)`
- index on `is_reversed`

Notes:
- this table defines cumulative deposit inputs unless reversed

---

## 9.3 `purchase_recoveries`

Purpose:
- audit recovery attempts when chain success exists but backend missed initial linkage

Columns:
- `id uuid primary key`
- `purchase_order_id uuid references purchase_orders(id)`
- `wallet_address text not null references users(wallet_address)`
- `tx_hash text not null`
- `status text not null`
- `resolved_purchase_id uuid references purchases(id)`
- `failure_reason text`
- `requested_at timestamptz not null default now()`
- `resolved_at timestamptz`

Constraints:
- `status in ('requested','resolved','failed','duplicate')`

Indexes:
- index on `wallet_address`
- index on `tx_hash`
- index on `status`

---

## 9.4 `purchase_reversals`

Purpose:
- record approved exceptional reversal or financial exclusion of a confirmed purchase

Columns:
- `id uuid primary key`
- `purchase_id uuid not null references purchases(id)`
- `reversal_reason text not null`
- `reversal_type text not null`
- `reversed_by_admin_id uuid references admin_users(id)`
- `approved_by_admin_id uuid references admin_users(id)`
- `created_at timestamptz not null default now()`
- `effective_at timestamptz not null`
- `notes text`

Constraints:
- `reversal_type in ('duplicate_payment','system_error','compliance','manual_exception')`

Indexes:
- unique index on `purchase_id`
- index on `effective_at`

Notes:
- `purchases.is_reversed` should be updated consistently when this row is created

---

## 9.5 `chain_events`

Purpose:
- raw synchronized on-chain event ledger

Columns:
- `id uuid primary key`
- `chain_id bigint not null`
- `contract_address text not null`
- `event_name text not null`
- `tx_hash text not null`
- `log_index integer not null`
- `block_number bigint not null`
- `block_hash text`
- `status text not null`
- `confirmations integer not null default 0`
- `payload jsonb not null`
- `observed_at timestamptz not null default now()`
- `confirmed_at timestamptz`
- `processed_at timestamptz`
- `failed_at timestamptz`
- `failure_reason text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `status in ('observed','confirmed','processed','reverted','failed_processing')`

Indexes:
- unique index on `(chain_id, tx_hash, log_index)`
- index on `(chain_id, contract_address, block_number)`
- index on `status`
- index on `event_name`
- index on `confirmed_at`
- gin index on `payload` optional if needed later

---

## 9.6 `chain_sync_state`

Purpose:
- track last scanned and finalized chain progress per source

Columns:
- `id uuid primary key`
- `chain_id bigint not null`
- `contract_address text not null`
- `sync_key text not null`
- `last_scanned_block bigint not null default 0`
- `last_confirmed_block bigint not null default 0`
- `last_scanned_at timestamptz`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `(chain_id, contract_address, sync_key)`

---

## 10. Reward and Settlement Tables

## 10.1 `direct_rewards`

Purpose:
- chain-backed direct reward facts

Columns:
- `id uuid primary key`
- `from_wallet_address text not null references users(wallet_address)`
- `to_wallet_address text not null references users(wallet_address)`
- `purchase_id uuid references purchases(id)`
- `chain_id bigint not null`
- `tx_hash text not null`
- `block_number bigint not null`
- `reward_rate numeric(10,8)`
- `purchase_amount numeric(38,18) not null`
- `reward_amount numeric(38,18) not null`
- `rewarded_at timestamptz not null`
- `created_at timestamptz not null default now()`

Indexes:
- unique index on `(chain_id, tx_hash, to_wallet_address, purchase_id)` if valid per business semantics
- index on `to_wallet_address`
- index on `from_wallet_address`
- index on `rewarded_at desc`

Notes:
- direct rewards are never burned

---

## 10.2 `settlement_jobs`

Purpose:
- each settlement or recompute run metadata

Columns:
- `id uuid primary key`
- `job_type text not null`
- `settlement_date date not null`
- `mode text not null`
- `status text not null`
- `config_version_snapshot jsonb not null`
- `started_at timestamptz not null`
- `finished_at timestamptz`
- `triggered_by_admin_id uuid references admin_users(id)`
- `reason text`
- `processed_user_count integer not null default 0`
- `created_snapshot_count integer not null default 0`
- `created_adjustment_count integer not null default 0`
- `error_count integer not null default 0`
- `error_sample jsonb`
- `created_at timestamptz not null default now()`

Constraints:
- `job_type in ('daily_settlement','recompute','backfill')`
- `mode in ('official','backfill','recompute_preview','recompute_apply_adjustment')`
- `status in ('running','completed','failed','partial','cancelled')`

Indexes:
- index on `(settlement_date desc, job_type)`
- index on `status`
- index on `created_at desc`

---

## 10.3 `team_rewards_daily`

Purpose:
- daily per-user official team reward snapshot

Columns:
- `id uuid primary key`
- `settlement_job_id uuid not null references settlement_jobs(id)`
- `wallet_address text not null references users(wallet_address)`
- `settle_date date not null`
- `qualification_tier text not null`
- `user_team_rate numeric(10,8) not null`
- `team_total_performance numeric(38,18) not null default 0`
- `effective_performance numeric(38,18) not null default 0`
- `raw_total numeric(38,18) not null default 0`
- `burned_amount numeric(38,18) not null default 0`
- `actual_total numeric(38,18) not null default 0`
- `status text not null`
- `claim_tx_hash text`
- `claim_order_id uuid references claim_orders(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `status in ('claimable','claimed','offset','voided')`

Indexes:
- unique index on `(wallet_address, settle_date, settlement_job_id)`
- index on `(wallet_address, settle_date desc)`
- index on `status`
- index on `claim_order_id`

Notes:
- keep one row per user per settlement job/date for team differential total
- do not store equal-level totals here

---

## 10.4 `team_reward_line_details`

Purpose:
- normalized per-line detail for team reward calculation auditability

Columns:
- `id uuid primary key`
- `team_reward_daily_id uuid not null references team_rewards_daily(id) on delete cascade`
- `line_root_wallet_address text not null references users(wallet_address)`
- `line_effective_performance numeric(38,18) not null default 0`
- `subordinate_team_rate numeric(10,8) not null default 0`
- `differential_rate numeric(10,8) not null default 0`
- `raw_reward_amount numeric(38,18) not null default 0`
- `equal_level_replaced boolean not null default false`
- `created_at timestamptz not null default now()`

Indexes:
- index on `team_reward_daily_id`
- index on `line_root_wallet_address`

Notes:
- if `equal_level_replaced = true`, raw_reward_amount for differential should generally be zero

---

## 10.5 `equal_level_rewards_daily`

Purpose:
- daily per-line equal-level reward snapshots

Columns:
- `id uuid primary key`
- `settlement_job_id uuid not null references settlement_jobs(id)`
- `wallet_address text not null references users(wallet_address)`
- `line_root_wallet_address text not null references users(wallet_address)`
- `settle_date date not null`
- `equal_level_rate numeric(10,8) not null`
- `subordinate_team_total_performance numeric(38,18) not null default 0`
- `line_effective_performance numeric(38,18) not null default 0`
- `raw_amount numeric(38,18) not null default 0`
- `burned_amount numeric(38,18) not null default 0`
- `actual_amount numeric(38,18) not null default 0`
- `status text not null`
- `claim_order_id uuid references claim_orders(id)`
- `claim_tx_hash text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `status in ('claimable','claimed','offset','voided')`

Indexes:
- unique index on `(wallet_address, line_root_wallet_address, settle_date, settlement_job_id)`
- index on `(wallet_address, settle_date desc)`
- index on `line_root_wallet_address`
- index on `status`
- index on `claim_order_id`

---

## 10.6 `burn_records`

Purpose:
- normalized burn ledger for team/equal-level rewards

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `reward_type text not null`
- `source_snapshot_id uuid not null`
- `source_table text not null`
- `settle_date date not null`
- `holding_value_at_snapshot numeric(38,18) not null`
- `used_burn_capacity_before numeric(38,18) not null`
- `burn_cap numeric(38,18) not null`
- `raw_amount numeric(38,18) not null`
- `burned_amount numeric(38,18) not null`
- `actual_amount numeric(38,18) not null`
- `reason text not null`
- `created_at timestamptz not null default now()`

Constraints:
- `reward_type in ('team','equal_level')`
- `source_table in ('team_rewards_daily','equal_level_rewards_daily')`

Indexes:
- index on `wallet_address`
- index on `settle_date desc`
- index on `reward_type`
- index on `(source_table, source_snapshot_id)`

---

## 10.7 `claim_orders`

Purpose:
- orchestrate reward payout claims

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `client_request_id text not null`
- `status text not null`
- `claim_scope text not null default 'claim_all'`
- `requested_total_amount numeric(38,18) not null default 0`
- `signed_message text`
- `signed_at timestamptz`
- `queued_at timestamptz`
- `broadcast_tx_hash text`
- `broadcasted_at timestamptz`
- `confirmed_at timestamptz`
- `failed_at timestamptz`
- `failure_reason text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `status in ('pending_signature','queued','broadcasted','confirmed','failed','cancelled')`
- `claim_scope in ('claim_all','claim_by_type')`

Indexes:
- unique index on `(wallet_address, client_request_id)`
- unique index on `broadcast_tx_hash` where `broadcast_tx_hash is not null`
- index on `wallet_address`
- index on `status`
- index on `created_at desc`

---

## 10.8 `claim_order_items`

Purpose:
- lock specific reward snapshots to a claim order

Columns:
- `id uuid primary key`
- `claim_order_id uuid not null references claim_orders(id) on delete cascade`
- `reward_type text not null`
- `source_table text not null`
- `source_snapshot_id uuid not null`
- `amount numeric(38,18) not null`
- `created_at timestamptz not null default now()`

Constraints:
- `reward_type in ('team','equal_level','adjustment_credit')`
- `source_table in ('team_rewards_daily','equal_level_rewards_daily','adjustment_records')`

Indexes:
- index on `claim_order_id`
- unique index on `(source_table, source_snapshot_id)` where source snapshot is in a non-terminal claim state should be partially enforced via application logic or with auxiliary lock state columns on source tables

Recommended operational rule:
- source snapshot tables should carry `claim_order_id` when locked/claimed to simplify enforcement

---

## 10.9 `claim_records`

Purpose:
- immutable payout history ledger after successful or failed payout attempts

Columns:
- `id uuid primary key`
- `claim_order_id uuid not null references claim_orders(id)`
- `wallet_address text not null references users(wallet_address)`
- `amount numeric(38,18) not null`
- `tx_hash text`
- `status text not null`
- `recorded_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints:
- `status in ('confirmed','failed')`

Indexes:
- index on `wallet_address`
- index on `claim_order_id`
- index on `recorded_at desc`

---

## 10.10 `adjustment_records`

Purpose:
- financial correction ledger without destructive rewrite

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `settlement_job_id uuid references settlement_jobs(id)`
- `adjustment_type text not null`
- `direction text not null`
- `amount numeric(38,18) not null`
- `remaining_amount numeric(38,18) not null`
- `settle_date date`
- `source_table text`
- `source_snapshot_id uuid`
- `reason text not null`
- `status text not null`
- `created_by_admin_id uuid references admin_users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `adjustment_type in ('recompute_diff','purchase_reversal_offset','manual_financial_correction')`
- `direction in ('credit','debit')`
- `status in ('active','fully_offset','voided')`

Indexes:
- index on `wallet_address`
- index on `status`
- index on `created_at desc`
- index on `(source_table, source_snapshot_id)`

Rules:
- `remaining_amount` tracks how much of a credit or debit is still outstanding

---

## 11. Vesting Tables

## 11.1 `vesting_lots`

Purpose:
- source-of-truth vesting per successful purchase

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `purchase_id uuid not null unique references purchases(id)`
- `total_locked numeric(38,18) not null`
- `start_time timestamptz not null`
- `lock_days integer not null`
- `release_days integer not null`
- `released_amount numeric(38,18) not null default 0`
- `withdrawable_amount numeric(38,18) not null default 0`
- `withdrawn_amount numeric(38,18) not null default 0`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `lock_days >= 0`
- `release_days > 0`
- `status in ('active','completed','voided')`

Indexes:
- index on `wallet_address`
- index on `start_time`
- index on `status`

---

## 11.2 `user_vesting_summary`

Purpose:
- rebuildable summary for user-facing vesting dashboard

Columns:
- `wallet_address text primary key references users(wallet_address)`
- `total_locked numeric(38,18) not null default 0`
- `total_released numeric(38,18) not null default 0`
- `total_withdrawable numeric(38,18) not null default 0`
- `total_withdrawn numeric(38,18) not null default 0`
- `updated_at timestamptz not null default now()`

---

## 12. Configuration and Content Tables

## 12.1 `config_versions`

Purpose:
- versioned business and display config store

Columns:
- `id uuid primary key`
- `config_group text not null`
- `config_key text not null`
- `version_no integer not null`
- `config_value jsonb not null`
- `effective_from timestamptz not null`
- `apply_scope text not null`
- `status text not null default 'active'`
- `description text`
- `created_by_admin_id uuid references admin_users(id)`
- `created_at timestamptz not null default now()`

Constraints:
- `apply_scope in ('all_users','new_users_only','new_orders_only','next_settlement_day')`
- `status in ('draft','active','superseded','disabled')`

Indexes:
- unique index on `(config_group, config_key, version_no)`
- index on `(config_group, config_key, effective_from desc)`
- index on `apply_scope`
- index on `status`

Notes:
- `config_value` schema depends on group/key and must be validated in application layer

---

## 12.2 `config_change_history`

Purpose:
- audit record for config changes

Columns:
- `id uuid primary key`
- `config_version_id uuid not null references config_versions(id)`
- `config_group text not null`
- `config_key text not null`
- `old_value jsonb`
- `new_value jsonb not null`
- `effective_from timestamptz not null`
- `apply_scope text not null`
- `changed_by_admin_id uuid references admin_users(id)`
- `changed_at timestamptz not null default now()`
- `change_note text`

Indexes:
- index on `(config_group, config_key, changed_at desc)`
- index on `changed_by_admin_id`

---

## 12.3 `content_entries`

Purpose:
- dynamic multilingual content such as announcements

Columns:
- `id uuid primary key`
- `content_group text not null`
- `content_key text not null`
- `content_value jsonb not null`
- `status text not null default 'active'`
- `effective_from timestamptz`
- `created_by_admin_id uuid references admin_users(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `status in ('draft','active','disabled')`

Indexes:
- unique index on `(content_group, content_key)`
- index on `status`

Example `content_value`:
```json
{
  "zh-CN": "...",
  "zh-TW": "...",
  "en": "...",
  "ko": "..."
}
```

---

## 13. Reporting and Summary Tables

## 13.1 `user_reward_summary`

Purpose:
- user-level fast read for frontend reward overview

Columns:
- `wallet_address text primary key references users(wallet_address)`
- `direct_total numeric(38,18) not null default 0`
- `team_total numeric(38,18) not null default 0`
- `equal_level_total numeric(38,18) not null default 0`
- `adjustment_credit_total numeric(38,18) not null default 0`
- `adjustment_debit_remaining numeric(38,18) not null default 0`
- `claimable_total numeric(38,18) not null default 0`
- `burned_total numeric(38,18) not null default 0`
- `updated_at timestamptz not null default now()`

Indexes:
- index on `claimable_total desc`

---

## 13.2 `team_performance_snapshot`

Purpose:
- daily snapshot of team totals for faster reads and audit

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `snapshot_date date not null`
- `team_total_performance numeric(38,18) not null default 0`
- `effective_performance numeric(38,18) not null default 0`
- `team_rate numeric(10,8) not null default 0`
- `tier text not null`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `(wallet_address, snapshot_date)`
- index on `snapshot_date desc`
- index on `(wallet_address, snapshot_date desc)`

---

## 13.3 `team_level_aggregate_daily`

Purpose:
- aggregated team metrics by user and depth level for frontend/admin performance

Columns:
- `id uuid primary key`
- `wallet_address text not null references users(wallet_address)`
- `snapshot_date date not null`
- `level integer not null`
- `member_count integer not null default 0`
- `active_count integer not null default 0`
- `new_performance numeric(38,18) not null default 0`
- `cumulative_performance numeric(38,18) not null default 0`
- `updated_at timestamptz not null default now()`

Indexes:
- unique index on `(wallet_address, snapshot_date, level)`
- index on `(wallet_address, snapshot_date desc)`

---

## 13.4 `dashboard_daily_summary`

Purpose:
- admin dashboard daily materialization

Columns:
- `summary_date date primary key`
- `new_users_count integer not null default 0`
- `new_buyers_count integer not null default 0`
- `purchase_count integer not null default 0`
- `deposit_total numeric(38,18) not null default 0`
- `direct_reward_total numeric(38,18) not null default 0`
- `team_reward_total numeric(38,18) not null default 0`
- `equal_level_reward_total numeric(38,18) not null default 0`
- `burn_total numeric(38,18) not null default 0`
- `claim_total numeric(38,18) not null default 0`
- `updated_at timestamptz not null default now()`

---

## 13.5 `report_export_jobs`

Purpose:
- async report export tracking

Columns:
- `id uuid primary key`
- `requested_by_admin_id uuid references admin_users(id)`
- `report_type text not null`
- `status text not null`
- `filters jsonb`
- `file_path text`
- `error_message text`
- `created_at timestamptz not null default now()`
- `finished_at timestamptz`

Constraints:
- `status in ('queued','running','completed','failed')`

Indexes:
- index on `requested_by_admin_id`
- index on `status`
- index on `created_at desc`

---

## 14. Operations and Audit Tables

## 14.1 `admin_logs`

Purpose:
- audit admin actions

Columns:
- `id uuid primary key`
- `admin_user_id uuid references admin_users(id)`
- `action text not null`
- `target_type text not null`
- `target_id text`
- `detail jsonb`
- `ip_address text`
- `created_at timestamptz not null default now()`

Indexes:
- index on `admin_user_id`
- index on `(action, created_at desc)`
- index on `(target_type, target_id)`

---

## 14.2 `job_runs`

Purpose:
- job execution log for scheduled/background tasks

Columns:
- `id uuid primary key`
- `job_name text not null`
- `job_key text`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz`
- `rows_scanned integer not null default 0`
- `rows_processed integer not null default 0`
- `rows_failed integer not null default 0`
- `detail jsonb`
- `error_message text`
- `created_at timestamptz not null default now()`

Constraints:
- `status in ('running','completed','failed','partial','cancelled')`

Indexes:
- index on `(job_name, created_at desc)`
- index on `status`

---

## 14.3 `system_health_checks`

Purpose:
- current health status summary

Columns:
- `health_key text primary key`
- `status text not null`
- `detail jsonb`
- `checked_at timestamptz not null`

Constraints:
- `status in ('ok','warn','error')`

---

## 14.4 `error_events`

Purpose:
- normalized application/runtime error tracking

Columns:
- `id uuid primary key`
- `source text not null`
- `severity text not null`
- `error_code text`
- `message text not null`
- `detail jsonb`
- `created_at timestamptz not null default now()`

Constraints:
- `severity in ('info','warn','error','critical')`

Indexes:
- index on `source`
- index on `severity`
- index on `created_at desc`

---

## 15. Column Design Conventions

## 15.1 Financial Amount Naming
Use clear suffixes:
- `_amount`
- `_total`
- `_cap`
- `_rate`
- `_performance`

## 15.2 IDs
Use UUID primary keys for most business tables except where natural key is more suitable:
- `users.wallet_address` as natural PK
- `dashboard_daily_summary.summary_date` as natural PK

## 15.3 Mutable Snapshot Fields
If a table stores both source and mutable status fields, keep the fact immutable and status explicit.
Example:
- reward amount fields immutable
- `status` mutable
- `claim_order_id` mutable linkage

---

## 16. Index Strategy Summary

High-priority indexes by access pattern:

### 16.1 User-centric reads
- `purchases(wallet_address, purchase_at desc)`
- `direct_rewards(to_wallet_address, rewarded_at desc)`
- `team_rewards_daily(wallet_address, settle_date desc)`
- `equal_level_rewards_daily(wallet_address, settle_date desc)`
- `vesting_lots(wallet_address)`
- `user_reward_summary(wallet_address)`
- `user_vesting_summary(wallet_address)`

### 16.2 Admin list reads
- `users(status)`
- `purchase_orders(status, created_at desc)`
- `chain_events(status, block_number)`
- `settlement_jobs(settlement_date desc)`
- `job_runs(job_name, created_at desc)`
- `admin_logs(action, created_at desc)`

### 16.3 Referral/team queries
- `referral_bindings(parent_wallet_address)`
- `referral_closure(ancestor_wallet_address, depth)`
- `referral_closure(descendant_wallet_address)`
- `team_level_aggregate_daily(wallet_address, snapshot_date desc)`

### 16.4 Claim safety
- `claim_orders(wallet_address, created_at desc)`
- unique idempotency index on `(wallet_address, client_request_id)`
- linkage indexes on `claim_order_id` in snapshot tables

---

## 17. Recommended Constraints and Validation Rules

## 17.1 Positive Amount Rules
For tables containing real monetary amounts, enforce:
- `amount >= 0`
- `raw_total >= 0`
- `burned_amount >= 0`
- `actual_total >= 0`

## 17.2 Burn Consistency
Application and/or DB check logic should ensure:
- `raw_total = burned_amount + actual_total` where applicable
- similarly for equal-level rows and burn records

## 17.3 Adjustment Consistency
- `amount >= 0`
- `remaining_amount >= 0`

## 17.4 Referral Self-Loop Prevention
Prevent `child_wallet_address = parent_wallet_address` in `referral_bindings` using check constraint if desired:
- `child_wallet_address <> parent_wallet_address`

Cycle prevention beyond self-loop must be application/service enforced.

---

## 18. RLS and Access Control Guidance

Because this system uses Supabase, RLS planning matters.

### 18.1 User-Facing Tables
User-side direct table access should be minimized. Prefer Edge Functions.

If RLS is used directly:
- user can only access rows matching authenticated wallet address
- never expose admin-only tables directly

### 18.2 Admin Tables
Admin operations should go through privileged backend access patterns, not open table access.

### 18.3 Recommended Approach
For v1:
- sensitive reads/writes should mostly go through Edge Functions using service-role access
- RLS may still protect accidental misuse, but API mediation should remain primary

---

## 19. Migration Order

Recommended migration sequence:

1. identity/access tables
2. referral topology tables
3. purchase and chain tables
4. config tables
5. reward and settlement tables
6. vesting tables
7. summary/reporting tables
8. operations/audit tables
9. indexes and helper views
10. seed minimal admin and config data

---

## 20. Seed Data Requirements

Initial seed should include:
- one super admin user
- baseline config groups and versions
- default content entries if needed
- one chain sync state row per contract source
- optional test users and referral tree for staging only

---

## 21. Rebuild Strategy for Derived Tables

Derived tables should have rebuild jobs or SQL procedures.

### 21.1 `user_vesting_summary`
Rebuild from `vesting_lots`.

### 21.2 `user_reward_summary`
Rebuild from:
- `direct_rewards`
- `team_rewards_daily`
- `equal_level_rewards_daily`
- `adjustment_records`
- `burn_records`

### 21.3 `team_performance_snapshot`
Rebuild from:
- `referral_closure`
- `purchases`
- reversed purchase exclusions
- effective config depth rules

### 21.4 `dashboard_daily_summary`
Rebuild from source-of-truth event and fact tables by date.

---

## 22. Views and Helper Read Models

Optional helper SQL views can be added later, but should not replace canonical tables.

Recommended optional views:
- `vw_active_purchase_facts`
- `vw_user_claimable_reward_items`
- `vw_user_team_direct_subordinates`
- `vw_daily_reward_totals`

Keep view logic thin and understandable.

---

## 23. Retention and Cleanup Guidance

### 23.1 Keep Long-Term
Do not purge:
- purchases
- rewards
- claim records
- config versions
- admin logs
- adjustment records

### 23.2 Eligible for Cleanup / Archival
Can be cleaned or archived with policy:
- expired auth nonces
- revoked/expired sessions older than retention threshold
- stale pending captures
- noisy error events after archival

---

## 24. Consistency Rules Across Tables

1. A `purchase_reversal` should mark corresponding purchase excluded from future cumulative deposit logic.
2. A `claim_order` in confirmed state should imply all linked `claim_order_items` source snapshots are in final claimed or offseted state as applicable.
3. `burn_records` should exist only when actual burn occurred or, if stored for all rows, must clearly distinguish zero-burn rows.
4. `adjustment_records.remaining_amount` must be updated transactionally when offsets occur.
5. `team_rewards_daily.claim_order_id` and `equal_level_rewards_daily.claim_order_id` must only point to one live claim order.

---

## 25. Suggested SQL Type Helpers

Recommended shared helper domains or conventions in SQL/migrations:
- reusable trigger for `updated_at`
- helper function to normalize wallet addresses to lowercase on write
- helper function for UUID default generation
- helper function to enforce nonnegative numeric values where practical

---

## 26. Acceptance Checklist

The schema is acceptable when all are true:

1. identity, purchase, reward, claim, config, and audit concerns are separated cleanly
2. source-of-truth tables are distinguishable from summary tables
3. all major lifecycle objects have status fields and indexes
4. claim flow supports locking and idempotency
5. settlement supports official runs and correction flows
6. referral hierarchy supports both direct-child and depth-based queries
7. financial amounts use safe numeric precision
8. config versions include effective date and apply scope
9. admin actions and jobs are auditable
10. summary tables can be rebuilt from facts

---

## 27. Next Document

The next implementation document should be:

- `04_API_Spec.md`

That document should map these tables into concrete request/response contracts and endpoint behavior.

