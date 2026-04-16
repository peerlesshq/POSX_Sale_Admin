# POSX Token Sale System — Reporting and Metrics Definition

## 1. Document Control

- Document Name: `11_Reporting_And_Metrics_Definition.md`
- System Name: POSX Token Sale System
- Purpose: Define the official business metrics, reporting formulas, aggregation rules, UTC date logic, dashboard KPIs, ranking semantics, export definitions, and interpretation rules for the POSX system
- Audience: Backend engineers, frontend engineers, operations, finance, product, QA, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `06_Admin_Panel_PRD.md`
  - `09_Config_Center_Spec.md`

---

## 2. Purpose and Scope

This document defines the official metric semantics for all reporting surfaces in the system.

It exists to ensure that:
- dashboard numbers are consistent everywhere
- exports use the same formulas as in-app reports
- “today”, “daily”, “settled”, and “claimable” all have precise meanings
- engineering, product, and operations interpret the same metric the same way
- AI-generated code does not invent conflicting formulas

This document covers:
- reporting principles
- date and time rules
- counting rules
- revenue and reward metrics
- burn metrics
- user growth metrics
- team and ranking metrics
- settlement job metrics
- export definitions
- metric naming conventions

---

## 3. Reporting Principles

1. All business-day reporting uses UTC unless explicitly stated otherwise.
2. Financial reports must use exact source-of-truth tables, not frontend-derived calculations.
3. Metrics must clearly distinguish raw amounts from actual payable amounts.
4. Historical metrics must respect reversals and adjustments according to business policy.
5. Dashboard totals and export totals must reconcile to the same definitions.
6. A metric name must always map to one formula only.
7. “Pending confirmation” is not the same as “claimable”.
8. “Claimed” is not the same as “generated”.
9. Reporting summaries may be materialized, but must be rebuildable from facts.
10. When ambiguity exists, use more explicit metric names rather than overloaded labels.

---

## 4. Time and Date Rules

## 4.1 Business Day

A reporting business day is one UTC day:
- start: `00:00:00 UTC`
- end: `23:59:59 UTC`

## 4.2 Date Attribution Rules

### Purchases
Purchase date is the confirmed purchase timestamp date in UTC.

### Direct Rewards
Direct reward date is the direct reward fact timestamp date in UTC.

### Team Rewards
Team reward date is the `settle_date` on the daily snapshot.

### Equal-Level Rewards
Equal-level reward date is the `settle_date` on the daily snapshot.

### Burns
Burn date is the `settle_date` associated with the burn record.

### Claims
Claim date is the confirmed claim record timestamp date in UTC.

### New Users
New user date should be defined consistently across reporting surfaces.

Recommended v1 definition:
- user creation date = `users.created_at` date in UTC

### New Buyers
New buyer date = first confirmed purchase date in UTC.

---

## 5. Core Metric Families

Primary reporting families:
- user metrics
- purchase/deposit metrics
- reward metrics
- burn metrics
- claim metrics
- team metrics
- vesting metrics
- settlement/job metrics
- ranking metrics

---

## 6. User Metrics Definitions

## 6.1 Total Users

Definition:
- count of all user identity rows in `users`

Formula:
- `COUNT(users.wallet_address)`

Notes:
- includes users who authenticated but never purchased
- excludes no one unless deleted users exist and policy excludes them

## 6.2 New Users

Definition:
- number of users with `users.created_at` inside the selected UTC date range

Formula:
- count of users where `created_at` falls in range

## 6.3 Total Buyers

Definition:
- count of distinct wallet addresses with at least one confirmed, non-reversed purchase

Formula:
- distinct `purchases.wallet_address` where `is_reversed = false` on at least one row

## 6.4 New Buyers

Definition:
- count of users whose first confirmed, non-reversed purchase date falls inside the selected UTC date range

Formula:
- compute each wallet’s earliest valid purchase date, then count those in range

## 6.5 Active Referral Participants

Definition:
- count of users who have at least one direct referral or at least one bound referrer depending on report context

This metric should be named more explicitly if used.

Recommended explicit variants:
- `users_with_referrer_count`
- `users_with_direct_referrals_count`

---

## 7. Purchase and Deposit Metrics Definitions

## 7.1 Purchase Count

Definition:
- count of confirmed purchase facts in selected date range

Formula:
- `COUNT(purchases.id)` where purchase date in range and `is_reversed = false`

## 7.2 Deposit Total

Definition:
- sum of confirmed, non-reversed purchase USDT amounts in selected date range

Formula:
- `SUM(purchases.usdt_amount)` where purchase date in range and `is_reversed = false`

This is the primary definition for:
- daily deposit
- weekly deposit
- monthly deposit
- platform total deposit over range

## 7.3 Lifetime Deposit Total

Definition:
- sum of all confirmed, non-reversed purchase USDT amounts historically

## 7.4 Average Purchase Size

Definition:
- deposit total divided by purchase count for selected range

Formula:
- `deposit_total / purchase_count`

Use only when purchase_count > 0.

## 7.5 Buyer Conversion Metrics

If later needed:
- authenticated user to buyer conversion
- referred user to buyer conversion

These should be explicitly named and not inferred from raw counts.

---

## 8. Reward Metrics Definitions

## 8.1 Direct Reward Total

Definition:
- total direct reward fact amount in selected range

Formula:
- `SUM(direct_rewards.reward_amount)` where `rewarded_at` in range

Notes:
- direct rewards are on-chain facts
- direct rewards are not burned

## 8.2 Team Reward Raw Total

Definition:
- total raw team differential reward generated in selected settlement date range before burn

Formula:
- `SUM(team_rewards_daily.raw_total)` where `settle_date` in range

## 8.3 Team Reward Actual Total

Definition:
- total actual payable team reward generated in selected settlement date range after burn

Formula:
- `SUM(team_rewards_daily.actual_total)` where `settle_date` in range

## 8.4 Equal-Level Reward Raw Total

Definition:
- total raw equal-level reward generated in selected settlement date range before burn

Formula:
- `SUM(equal_level_rewards_daily.raw_amount)` where `settle_date` in range

## 8.5 Equal-Level Reward Actual Total

Definition:
- total actual payable equal-level reward generated in selected settlement date range after burn

Formula:
- `SUM(equal_level_rewards_daily.actual_amount)` where `settle_date` in range

## 8.6 Reward Issued Total

This metric name must be precise.

Recommended official meaning:
- sum of actual payable off-chain reward snapshots generated in selected settlement date range

Formula:
- `team_reward_actual_total + equal_level_reward_actual_total`

If direct rewards are included, label explicitly:
- `total_rewards_generated_including_direct`

Recommended dashboard split:
- direct reward total
- team reward total
- equal-level reward total

---

## 9. Burn Metrics Definitions

## 9.1 Burn Total

Definition:
- total burned amount from burn records in selected settlement date range

Formula:
- `SUM(burn_records.burned_amount)` where `settle_date` in range

## 9.2 Burn by Reward Type

Definition:
- total burned amount segmented by reward type

Formula:
- aggregate `burn_records.burned_amount` grouped by `reward_type`

## 9.3 Burn Rate

If displayed, it must be explicitly defined.

Recommended formula:
- `burn_total / (team_reward_raw_total + equal_level_reward_raw_total)`

Only compute when denominator > 0.

---

## 10. Claim Metrics Definitions

## 10.1 Claim Total

Definition:
- total successfully claimed payout amount in selected confirmed claim date range

Formula:
- `SUM(claim_records.amount)` where `status = 'confirmed'` and claim record date in range

## 10.2 Claim Count

Definition:
- number of confirmed claim records in selected range

Formula:
- count of confirmed claim records in range

## 10.3 Average Claim Size

Definition:
- total claimed amount divided by claim count in selected range

## 10.4 Outstanding Claimable Total

Definition:
- current sum of claimable off-chain reward balances across users at query time

Recommended source:
- `SUM(user_reward_summary.claimable_total)` or equivalent rebuildable read model

This is a point-in-time metric, not a date-range metric.

---

## 11. Team Metrics Definitions

## 11.1 Team Total Performance (per user)

Definition:
- cumulative deposit total of all descendants of a user across all levels, excluding the user, using non-reversed purchase facts

## 11.2 Effective Performance (per user/day)

Definition:
- descendant performance contribution within configured effective depth range for the relevant settlement day

## 11.3 Team Rate (per user/day)

Definition:
- team level rate resolved from the user’s team total performance, current tier, and active team ladder config for the relevant settlement day

## 11.4 Team Ranking Metric

Recommended official team ranking metric:
- `team_total_performance`

Ranking ties may be resolved by:
1. higher team rate
2. earlier user creation date
3. stable wallet sort as final deterministic tiebreaker

Use one explicit policy and keep it consistent.

Recommended v1 tie-break policy:
1. higher `team_total_performance`
2. higher `team_rate`
3. earlier `wallet_address` lexical order for deterministic output if needed

---

## 12. Vesting Metrics Definitions

## 12.1 Total Locked POSX

Definition:
- total currently locked quantity from user or global vesting summaries

At user level:
- `user_vesting_summary.total_locked`

At platform level:
- sum of active/completed lots’ relevant locked amounts as defined by summary logic

## 12.2 Total Released POSX

Definition:
- total amount that has entered released state according to vesting computation

## 12.3 Total Withdrawable POSX

Definition:
- total amount currently eligible to withdraw but not yet withdrawn

## 12.4 Total Withdrawn POSX

Definition:
- total amount already withdrawn from vesting

---

## 13. Settlement and Operational Metrics Definitions

## 13.1 Settlement Job Count

Definition:
- number of settlement jobs in selected range, optionally grouped by job type or status

## 13.2 Settlement Success Count

Definition:
- number of settlement jobs with `status = completed`

## 13.3 Settlement Failure Count

Definition:
- number of settlement jobs with `status = failed`

## 13.4 Settlement Partial Count

Definition:
- number of settlement jobs with `status = partial`

## 13.5 Processed User Count

Definition:
- total or per-job processed user count recorded on `settlement_jobs`

This is an operational metric, not a business financial metric.

## 13.6 Created Adjustment Count

Definition:
- number of adjustment rows created by recompute/apply jobs

---

## 14. Dashboard KPI Definitions

These KPI definitions should be used consistently in admin dashboard.

## 14.1 Platform Total Deposit

Definition:
- lifetime sum of confirmed, non-reversed purchase amounts

## 14.2 Today Deposit

Definition:
- deposit total where confirmed purchase date is today in UTC

## 14.3 Total Users

Definition:
- total users count

## 14.4 Today New Users

Definition:
- users created today in UTC

## 14.5 Total Locked POSX

Definition:
- current point-in-time total locked POSX across all users

## 14.6 Total Released POSX

Definition:
- current point-in-time total released POSX across all users

## 14.7 Reward 24h — Direct

Definition:
- direct reward total where direct reward date is within the last completed or rolling 24h window depending on dashboard policy

Recommended v1 dashboard policy:
- use current UTC day rather than rolling 24h for consistency
- if label says “24h”, change to “Today (UTC)” unless truly rolling

Recommended naming:
- `today_direct_reward_total`
- `today_team_reward_total`
- `today_equal_level_reward_total`

## 14.8 Burn Total

Definition:
- current selected date range burn total

Dashboard default range should be clearly shown.

---

## 15. Range Semantics

## 15.1 Today

Today means current UTC day.

## 15.2 Yesterday

Yesterday means previous UTC day.

## 15.3 Last 7 Days

Recommended meaning:
- last 7 UTC dates including today, or excluding today if business prefers completed days only

Pick one policy and use it consistently.

Recommended v1:
- include today for dashboard quick ranges
- label clearly if partial current day included

## 15.4 Custom Range

Custom range should be interpreted as inclusive by day for UI filters, then translated to timestamp bounds in UTC.

---

## 16. Report Definitions by Page

## 16.1 Admin Dashboard Summary

Must show:
- platform total deposit
- today deposit
- total users
- today new users
- total locked POSX
- total released POSX
- today direct reward total
- today team reward actual total
- today equal-level reward actual total
- selected-range burn total

## 16.2 Reports Page Totals

Must show for selected range:
- deposit total
- direct reward total
- team reward actual total
- equal-level reward actual total
- burn total
- claim total

## 16.3 Team Ranking Report

Must rank by:
- team total performance

Columns:
- rank
- wallet address
- team total performance
- current tier
- current team rate

## 16.4 Reward Issuance Report

If exported, define whether it is:
- raw reward issuance
- actual reward issuance
- claim payout history

Recommended separate report types:
- `reward_generation_actual`
- `reward_generation_raw`
- `claim_payout_history`

Do not collapse them into one ambiguous export.

---

## 17. Point-in-Time Metrics vs Period Metrics

## 17.1 Point-in-Time Metrics

These are evaluated at query time:
- total users
- outstanding claimable total
- total locked POSX
- total released POSX
- current tier distribution

## 17.2 Period Metrics

These are evaluated over a date range:
- deposit total
- direct reward total
- team reward total
- equal-level reward total
- burn total
- claim total
- new users
- new buyers

UI and API should not mix these without clear labels.

---

## 18. Metric Naming Conventions

Recommended naming style:
- `*_total` for summed amounts
- `*_count` for counts
- `*_rate` for ratio/percentage metrics
- `*_raw_total` for pre-burn or pre-adjustment values
- `*_actual_total` for post-burn payable generation values
- `*_claimable_total` for current outstanding payable values

Examples:
- `deposit_total`
- `team_reward_raw_total`
- `team_reward_actual_total`
- `burn_total`
- `claim_total`
- `new_users_count`
- `new_buyers_count`

---

## 19. Adjustment Treatment in Reporting

Adjustments require explicit handling.

## 19.1 Reward Generation Metrics

Reward generation metrics should reflect generation snapshots, not later correction overlays, unless a report explicitly says “net after adjustments”.

## 19.2 Claimable Balance Metrics

Current claimable balance must incorporate active credit/debit adjustments.

## 19.3 Adjustment Report (Optional)

If exposed later, define separately:
- adjustment credit total
- adjustment debit total
- outstanding debit remaining total

Do not silently bury adjustment effects inside unrelated labels.

---

## 20. Reversal Treatment in Reporting

Confirmed purchase reversals affect future and historical reporting as follows:

## 20.1 Purchase Metrics

Reversed purchases must be excluded from deposit totals and buyer calculations if the official business rule says they should not count.

Recommended v1:
- exclude reversed purchases from active financial deposit reporting

## 20.2 Historical Fact Visibility

Operational/audit reports may still show the original purchase and reversal records separately.

Therefore two reporting views may coexist:
- business totals excluding reversals
- audit trail showing original facts plus reversal entries

---

## 21. Suggested Materialized Summary Tables and Their Meaning

## 21.1 `dashboard_daily_summary`

Meaning:
- pre-aggregated daily operational metrics by UTC date

Suggested columns and official meanings:
- `new_users_count`
- `new_buyers_count`
- `purchase_count`
- `deposit_total`
- `direct_reward_total`
- `team_reward_total` meaning actual payable team reward total
- `equal_level_reward_total` meaning actual payable equal-level reward total
- `burn_total`
- `claim_total`

## 21.2 `user_reward_summary`

Meaning:
- current point-in-time user reward overview

Suggested meanings:
- `direct_total` = lifetime direct reward fact total
- `team_total` = lifetime actual team reward total
- `equal_level_total` = lifetime actual equal-level reward total
- `adjustment_credit_total` = active or historical credit summary depending on implementation; must be labeled clearly in code
- `adjustment_debit_remaining` = outstanding debit not yet offset
- `claimable_total` = current claimable balance after adjustment effects
- `burned_total` = lifetime burned amount

## 21.3 `team_performance_snapshot`

Meaning:
- per-user daily snapshot of team totals and effective performance for operational and reporting use

---

## 22. Export Definitions

## 22.1 Deposit Report Export

Recommended columns:
- purchase id
- wallet address
- usdt amount
- posx amount
- token price at purchase
- tx hash
- purchase at
- is reversed

## 22.2 Reward Generation Export

Recommended variants:

### Team Reward Export
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

### Equal-Level Reward Export
- equal level reward id
- wallet address
- line root wallet
- settle date
- equal level rate
- line effective performance
- raw amount
- burned amount
- actual amount
- status

### Direct Reward Export
- direct reward id
- from wallet
- to wallet
- purchase amount
- reward rate
- reward amount
- tx hash
- rewarded at

## 22.3 Burn Export

Columns:
- burn record id
- wallet address
- reward type
- settle date
- raw amount
- burned amount
- actual amount
- burn cap
- used burn capacity before
- holding value at snapshot
- reason

## 22.4 Claim History Export

Columns:
- claim record id
- claim order id
- wallet address
- amount
- tx hash
- status
- recorded at

---

## 23. Chart and Visualization Rules

## 23.1 Trend Charts

Trend charts should use period metrics only.

Examples:
- daily deposit total
- daily team reward actual total
- daily equal-level reward actual total
- daily burn total

## 23.2 Distribution Charts

Examples:
- current tier distribution
- user status distribution if desired later

Distribution charts should be clearly labeled as point-in-time.

## 23.3 Mixed Metric Avoidance

Do not plot point-in-time and period totals on the same chart without very clear labeling.

---

## 24. Admin UI Labeling Guidance

Because ambiguity causes operational mistakes, labels should be explicit.

Recommended labels:
- “Deposit Total (UTC Range)”
- “Team Reward Generated (Actual)”
- “Equal-Level Reward Generated (Actual)”
- “Burn Total”
- “Claim Total (Confirmed Payouts)”
- “Outstanding Claimable Balance”
- “Current Tier Distribution”

Avoid vague labels like:
- “Rewards”
- “Income”
- “Team Bonus” without context

---

## 25. QA Checklist for Reporting

QA must verify at minimum:

1. “today” metrics use UTC boundaries correctly
2. deposit totals exclude reversed purchases in business reporting
3. team reward actual totals use post-burn actual values, not raw totals
4. burn total equals sum of burn records in selected range
5. claim total equals sum of confirmed claim records in selected range
6. new buyers count is based on first confirmed non-reversed purchase date
7. dashboard and reports page use the same formulas for shared metrics
8. ranking order is stable and deterministic
9. point-in-time metrics and date-range metrics are not mislabeled
10. exports reconcile to in-app report totals for the same range

---

## 26. Acceptance Criteria

This document is correctly implemented when all are true:

1. every KPI and report metric has one explicit formula
2. all business-day reporting uses UTC consistently
3. raw reward and actual reward metrics are clearly separated
4. burn and claim metrics are clearly defined and reproducible
5. reversed purchases are handled consistently in business reports
6. dashboard totals reconcile to report totals for the same date range and metric definition
7. team ranking logic is explicit and deterministic
8. point-in-time metrics are not confused with period metrics
9. exports use the same semantics as UI reports
10. engineering, product, and operations can point to one canonical metric definition for every surfaced number

---

## 27. Next Documents

The next implementation documents should be:
- `12_Test_Cases.md`
- `13_Seed_Data_And_Mock_Data.md`
- `14_Deployment_And_Env_Spec.md`

These will define test coverage, mock datasets, and deployment/runtime setup using the metric definitions above.

