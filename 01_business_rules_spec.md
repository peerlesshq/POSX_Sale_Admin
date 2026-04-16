# POSX Token Sale System — Business Rules Spec

## 1. Document Control

- Document Name: `01_Business_Rules_Spec.md`
- Purpose: Define the authoritative business rules for eligibility, referral binding, reward calculation, burn, vesting, claim, settlement, configuration effectiveness, user restrictions, and exception handling.
- Audience: Product, backend engineering, frontend engineering, admin panel engineering, QA, operations
- Priority: This document overrides ambiguous language in the master PRD.

---

## 2. Authoritative Principles

1. All reward settlement dates use **UTC**.
2. **Direct rewards are on-chain facts and are not subject to burn.**
3. **Team rewards and equal-level rewards are off-chain daily settled and can be subject to burn.**
4. Referral binding occurs on **first successful purchase**, not on wallet connect.
5. Config changes are versioned and, unless explicitly specified otherwise, take effect on the **next UTC day**.
6. Historical confirmed facts must never be silently overwritten.
7. If a correction is required after a reward has been claimed, the correction must be handled through **adjustment records**, not destructive edits.

---

## 3. Core Definitions

### 3.1 Cumulative Deposit

The sum of all confirmed, non-reversed purchase amounts in USDT for a wallet.

Includes:
- confirmed purchases

Excludes:
- failed orders
- cancelled orders
- reversed purchases
- duplicate submissions not confirmed as separate purchases

### 3.2 Holding POSX Amount

The current POSX quantity attributed to the user for tier and burn evaluation according to the active business definition. In the first implementation, the system should use the supported holding source consistent with the contract integration and backend aggregation strategy.

### 3.3 Holding Value (USDT)

`holding_posx_amount × evaluation_price`

Where `evaluation_price` is the valid price determined by the applicable config version for the evaluation moment.

### 3.4 Team Total Performance

The total cumulative deposit of all descendants under a user across all levels, excluding the user themself.

### 3.5 Effective Team Performance

The performance amount used as the basis for team differential calculations on a given settlement day.

By default, this uses descendants within configured effective depth bounds:
- `effective_level_start = 2`
- `effective_level_end = 7`

The effective depth bounds are configurable and evaluated from the active config version for the settlement date.

### 3.6 Settlement Day

A settlement day is one UTC day:
- start: `00:00:00 UTC`
- end: `23:59:59 UTC`

### 3.7 Current Tier

The user’s current tier determined by:
- cumulative deposit threshold requirements
- current holding value threshold requirements
- the applicable tier config version

### 3.8 Reward Snapshot

A daily or event-based reward record representing a concrete payable or historical reward fact.

### 3.9 Claimable Balance

The sum of reward snapshots in claimable status, after burn and adjustment logic has been applied.

### 3.10 Burn-Counted Rewards

Rewards that count toward the burn cap usage.

Included:
- team rewards actual payable amount in claimable/claimed states
- equal-level rewards actual payable amount in claimable/claimed states

Excluded:
- direct rewards
- burned amounts
- failed claims
- cancelled claims
- reversed rewards
- uncommitted recompute previews

---

## 4. Qualification and Tier Rules

## 4.1 Reward Qualification

A user is reward-qualified only when both conditions are true:

- `cumulative_deposit >= reward_min_deposit_threshold`
- `holding_value_usdt >= reward_min_holding_threshold`

Default values:
- `reward_min_deposit_threshold = 1000`
- `reward_min_holding_threshold = 1000`

If either condition is false, the user is not reward-qualified for team/equal-level reward generation.

### 4.2 Direct Reward Qualification

Direct reward follows the on-chain contract outcome. The backend records the direct reward fact from synchronized chain events. Direct reward is not blocked by burn logic in this product design.

### 4.3 Team Reward Qualification

A user is team-reward-qualified only when all conditions are true:

- reward-qualified
- current tier is a team-eligible tier

In the default config:
- Basic tier: not team eligible
- Advanced tier: team eligible
- Elite tier: team eligible

### 4.4 Tier Table (Default)

| Tier | Holding Value Condition | Deposit Condition | Direct Rate | Team Eligible |
| --- | --- | --- | --- | --- |
| None | below threshold | any | 0% or contract-defined behavior | No |
| Basic | `>= 1,000` and `< 10,000` | `>= 1,000` | 5% | No |
| Advanced | `>= 10,000` and `< 50,000` | `>= 1,000` | 10% | Yes |
| Elite | `>= 50,000` | `>= 1,000` | 15% | Yes |

If the user does not meet deposit threshold, they cannot be considered Basic/Advanced/Elite for off-chain reward qualification even if holding value is high.

### 4.5 Tier Evaluation Timing

Tier evaluation for daily settlement uses the user snapshot at settlement evaluation time under the applicable config version.

Default rule:
- the system uses the effective config and evaluation price for that settlement day
- config changes default to next-day UTC effectiveness

---

## 5. Direct Referral Reward Rules

### 5.1 Trigger

Direct reward is triggered when a qualifying chain event corresponding to a successful purchase and referral reward emission is confirmed.

### 5.2 Source of Truth

Direct reward is a chain-derived fact.

### 5.3 Burn Applicability

Direct reward is **not subject to burn**.

### 5.4 Settlement Method

Direct reward is treated as real-time on-chain outcome from the contract. Backend behavior:
- synchronize
- persist
- display
- include in historical reward views

### 5.5 Correction Policy

If a purchase is later reversed and the on-chain direct reward cannot be automatically recovered, the system does not mutate the historical direct reward fact. Any operational financial consequence should be handled via admin-level adjustment accounting, not by rewriting chain fact history.

---

## 6. Team Differential Reward Rules

### 6.1 Eligibility

A user may receive team differential reward only if the user is team-reward-qualified on the relevant settlement day.

### 6.2 Team Level Rate

A user’s team level rate is determined by their team total performance and current tier according to the active config version.

#### Default Team Ladder — Advanced Tier

| Team Total Performance | Team Level Rate |
| --- | --- |
| 1 - 100,000 | 1% |
| 100,001 - 500,000 | 3% |
| 500,001 - 1,000,000 | 5% |
| 1,000,001 - 5,000,000 | 10% |
| 5,000,001+ | 15% |

#### Default Team Ladder — Elite Tier

| Team Total Performance | Team Level Rate |
| --- | --- |
| 1 - 100,000 | 2% |
| 100,001 - 500,000 | 3% |
| 500,001 - 1,000,000 | 5% |
| 1,000,001 - 5,000,000 | 10% |
| 5,000,001+ | 15% |

### 6.3 Per-Line Calculation Unit

Each direct subordinate defines one independent business line.

For a user `U`, each direct subordinate `S` forms one line:
- `line_root = S`
- the line’s subordinate team rate is the current team level rate of `S` on the settlement day
- the line’s differential rate is `max(0, U_rate - S_rate)`

### 6.4 Effective Performance Basis

The team reward basis for each line uses the line’s effective performance contribution for the settlement day under the configured depth rules.

### 6.5 Formula

For each direct subordinate line:

`line_reward_raw = line_effective_performance × line_differential_rate`

Then:

`team_reward_raw_total = sum(all line_reward_raw where equal-level replacement does not apply)`

### 6.6 Maximum Team Level Rate

Maximum team level rate is 15% by default.

### 6.7 Same-Level Differential

If user and line root have the same team level rate and the line qualifies for equal-level replacement, the differential reward for that line is zero and equal-level reward rules apply instead.

---

## 7. Equal-Level Reward Rules

### 7.1 Trigger Conditions

For a user `U` and a direct subordinate line root `S`, equal-level reward applies when all conditions are true:

1. `U_rate == S_rate`
2. `S` meets the minimum team performance threshold for equal-level reward
3. `U` is team-reward-qualified
4. the line is active on the settlement day

Default threshold:
- subordinate team cumulative performance `>= 100,000 USDT`

### 7.2 Replacement Rule

Equal-level reward replaces team differential reward on the same line.

When equal-level applies:
- line differential reward for that line becomes `0`
- equal-level reward is computed for that line

### 7.3 Basis

Equal-level reward basis is the line’s effective performance contribution for the settlement day under the superior user’s settlement perspective.

### 7.4 Formula

`equal_level_line_reward_raw = line_effective_performance × equal_level_rate`

Default:
- `equal_level_rate = 3%`

### 7.5 Multiple Same-Level Lines

A user may have multiple direct subordinate lines that independently qualify for equal-level reward. Each line is evaluated separately.

---

## 8. Burn Rules

### 8.1 Applicability

Burn applies only to:
- team rewards
- equal-level rewards

Burn does **not** apply to:
- direct rewards

### 8.2 Burn Threshold Logic

Default burn model:

- If `holding_value_usdt > burn_disable_threshold`, no burn cap applies
- If `holding_value_usdt <= burn_disable_threshold`, burn cap applies

Default:
- `burn_disable_threshold = 10,000 USDT`

### 8.3 Cap Basis

When burn cap applies:

`burn_cap = holding_value_usdt at settlement snapshot time`

### 8.4 Used Burn Capacity

`used_burn_capacity = sum(actual team rewards in claimable/claimed states) + sum(actual equal-level rewards in claimable/claimed states)`

Excludes:
- direct rewards
- burned amounts
- failed claims
- cancelled claims
- reversed rewards
- preview-only recompute outputs

### 8.5 Remaining Capacity

`remaining_burn_capacity = max(0, burn_cap - used_burn_capacity)`

### 8.6 Burned Amount for the Day

For a settlement result:

`actual_payable = min(raw_reward_total, remaining_burn_capacity)`

`burned_amount = max(0, raw_reward_total - actual_payable)`

### 8.7 No Retroactive Recovery

Burned rewards are final.
They are:
- not accumulated for later release
- not deferred
- not reissued if the user later increases holding value

### 8.8 No Claim Timing Exploit

Because burn capacity usage includes claimable and claimed actual rewards, a user cannot avoid burn by simply not claiming.

---

## 9. Vesting Rules

### 9.1 Vesting Model

The system uses **lot-based vesting**.

Each successful purchase corresponds to one vesting lot.

### 9.2 Default Vesting Parameters

- lock period: 90 days
- release period: 365 days linear release

### 9.3 Source of Truth

Each lot is independently tracked as a source-of-truth vesting record.

### 9.4 Summary Values

The frontend may show aggregated values:
- total locked
- total released
- total withdrawable
- total withdrawn

These summary values are derived from vesting lots.

### 9.5 No Weighted Average Rule

The system does not merge multiple purchases into one weighted-average vesting schedule.

---

## 10. Referral Binding Rules

### 10.1 Binding Moment

Referral binding occurs on the user’s **first successful purchase** only.

### 10.2 Non-Binding Events

The following do not create referral binding:
- opening a referral link only
- wallet connection only
- wallet authentication only
- failed purchase attempts

### 10.3 Frontend Referral Capture

When a user opens a valid referral link, the frontend stores the referral code locally with an expiration period.

Default:
- local referral code validity: 30 days

### 10.4 Binding Conditions

On first successful purchase, the system binds the referral if all are true:

1. user has no existing referrer
2. user has no prior successful purchase
3. referral code resolves to a valid referring wallet
4. referring wallet is not the same as buyer wallet
5. the resulting referral relationship does not create a cycle

### 10.5 Immutability

Once bound successfully, referral binding is locked and cannot be changed by the user.

### 10.6 Repeated Referral Link Clicks

If a user already has a referrer, later referral link clicks do not change it.

### 10.7 Legacy Imported Users

If a legacy user has no bound referrer:
- no automatic retroactive binding is performed
- super admin may manually bind once only if no historical reward conflict exists and the user has no prior locked binding
- once any dependent reward history exists, manual rebinding is prohibited

### 10.8 Binding Source Tracking

Binding must record source type, such as:
- referral_link
- admin_import
- manual_correction

---

## 11. Configuration Effectiveness Rules

### 11.1 Versioned Configuration

All mutable business configuration must be stored as versioned config entries.

### 11.2 Required Metadata

Each config version must include:
- `effective_from`
- `apply_scope`
- `changed_by`
- `changed_at`
- old value
- new value

### 11.3 Default Effectiveness Rule

Unless otherwise specified, config changes become effective on the next UTC day.

### 11.4 Apply Scope Values

- `all_users`
- `new_users_only`
- `new_orders_only`
- `next_settlement_day`

### 11.5 Recommended Scope by Config Type

- reward rules, team ladders, equal-level rule, burn rule: `next_settlement_day`
- vesting parameters: `new_orders_only`
- display content: `all_users`
- minimum purchase amount: `new_orders_only`

### 11.6 Historical Calculation Integrity

Any settlement or recomputation must evaluate against the config version that was effective for that original settlement date and scope.

---

## 12. Settlement Rules

### 12.1 Settlement Timezone

All daily settlement uses UTC.

### 12.2 Settlement Schedule

Default operational run time:
- settlement job begins shortly after day rollover, e.g. `00:10 UTC`

### 12.3 Settlement Scope

Each settlement day computes:
- team differential rewards
- equal-level rewards
- burn application
- daily reward snapshot status generation

### 12.4 Inputs to Settlement

Settlement should use:
- confirmed purchase facts
- referral tree facts
- effective config version
- team performance aggregates or reproducible source queries
- current qualification snapshots

### 12.5 Settlement Output Status

Daily reward outputs generally move through:
- pending calculation / preview
- claimable
- claimed
- adjusted / offset where applicable

### 12.6 Confirmed-Only Rule

Only chain events meeting required confirmation rules may participate in settlement calculations.

---

## 13. User Status and Restriction Rules

### 13.1 Status Types

- `active`
- `restricted_purchase`
- `restricted_claim`
- `suspended`
- `blacklisted`

### 13.2 Active

User may:
- purchase
- claim
- invite
- bind referral on first successful purchase if eligible
- receive future off-chain rewards if qualified

### 13.3 Restricted Purchase

User may not:
- create new purchases
- create new referral binding through future first purchase

User may:
- log in
- view account
- claim already claimable rewards

### 13.4 Restricted Claim

User may:
- purchase
- continue normal account activity
- continue future reward generation if otherwise eligible

User may not:
- submit claim requests

### 13.5 Suspended

User may not:
- purchase
- claim
- invite
- create referral binding

By default, from the effective suspension time forward:
- no new off-chain team/equal-level rewards should be generated
- existing unclaimed balances remain frozen until admin action

### 13.6 Blacklisted

User is fully restricted from all normal operations.

By default:
- no purchases
- no claims
- no new off-chain rewards
- no invite actions
- no new referral binding
- balances remain frozen until admin resolution

### 13.7 Status Change Requirements

Any status change must record:
- target status
- operator
- reason
- effective time
- optional note

---

## 14. Claim Rules

### 14.1 Eligible Reward Types for Claim

Claimable reward types in v1:
- team rewards
- equal-level rewards
- direct rewards if business implementation chooses to include claim aggregation display, though direct rewards are chain facts and may not require the same claim mechanism depending on contract design

For the first implementation, claim orchestration should focus on the off-chain claimable reward snapshots.

### 14.2 Claim Trigger

A user initiates claim from frontend.

### 14.3 Signature Requirement

User must sign with TP Wallet to confirm claim intent.

### 14.4 Claim All

The primary user flow is **one-click claim all** for all currently claimable reward snapshots.

### 14.5 Optional Partial Claim

Partial claim by reward type may be supported as a secondary flow, but the primary business requirement is claim all.

### 14.6 Claim Locking Rule

When a claim order is created, all selected claimable snapshots are locked to that claim order and cannot be claimed by another order simultaneously.

### 14.7 Idempotency Rule

Repeated claim submission with the same client request identity must return the original in-flight claim order rather than creating duplicates.

### 14.8 Completion Rule

A claim is complete only after:
- payout transaction has been broadcast
- sufficient confirmation / success criteria are met
- linked snapshots are marked claimed

### 14.9 Failure Rule

If broadcast or confirmation fails:
- claim order should transition to failure status
- snapshots should remain safely recoverable and must not be double-paid

### 14.10 Minimum Claim Amount

Default recommendation:
- `min_claim_amount = 10 USDT`

This should be configurable.

---

## 15. Recompute and Adjustment Rules

### 15.1 Modes

Supported operational modes:
- backfill
- recompute preview
- recompute apply adjustment

### 15.2 Backfill

Used when a historical day has not yet been settled. Produces formal settlement outputs.

### 15.3 Recompute Preview

Re-runs the calculation without changing persisted official records. Used for inspection and validation.

### 15.4 Recompute Apply Adjustment

Used when official records already exist and correction is required.

### 15.5 Claimed Reward Protection

If a daily reward snapshot has already been claimed, it must not be destructively overwritten.

### 15.6 Positive Difference

If recompute shows the user should have received more, create a positive adjustment record that increases future claimable amount.

### 15.7 Negative Difference

If recompute shows the user should have received less:
- if unclaimed, offset against unclaimed balances where possible
- if already claimed, create a negative adjustment to be offset from future payable rewards

### 15.8 Version Integrity

Recompute must use the config version that was effective for the original settlement day unless a special documented migration policy explicitly states otherwise.

### 15.9 Permission

Applying corrections that change financial balances is a high-risk action and should be limited to super admin.

---

## 16. Chain Event Validity Rules

### 16.1 Event Confirmation Threshold

Chain events only become financially effective after reaching the configured minimum confirmations.

Default recommendation:
- `min_confirmations = 12`

### 16.2 Event Uniqueness

Each chain event must be uniquely identified by:
- chain id
- tx hash
- log index

### 16.3 Reorg Handling

If a chain reorganization invalidates a previously observed but not yet final event, that event must not remain treated as confirmed financial fact.

### 16.4 Settlement Dependency

Only confirmed, non-reverted chain events may participate in purchase facts and reward settlement inputs.

---

## 17. Purchase Exception Rules

### 17.1 Approval Success, Purchase Failure

If token approval succeeds but purchase transaction fails:
- the purchase order is failed
- no purchase fact is created
- no cumulative deposit increase occurs
- no reward generation occurs

### 17.2 Chain Success, Backend Sync Missed

If on-chain purchase succeeds but backend initially misses sync:
- the system must support order recovery by tx hash or scheduled rescan
- once recovered and validated, the purchase fact is created normally

### 17.3 Duplicate Submission

Duplicate purchase requests must not create duplicate business facts.

### 17.4 Reversal

If a confirmed purchase must be reversed due to approved exceptional circumstances:
- original purchase fact remains historically linked
- reversal record is added
- cumulative deposit and downstream future calculations must exclude reversed effect
- downstream correction should be handled through adjustment logic where necessary

---

## 18. Pending Confirmation Display Rules

### 18.1 Pending Confirmation Meaning

“Pending confirmation” on user-facing UI means estimated team/equal-level reward value for the current UTC day based on already synced and sufficiently confirmed business inputs, but before the end-of-day official settlement finalization.

### 18.2 Characteristics

Pending confirmation:
- is not final
- cannot be claimed
- may change during the day
- should be clearly labeled as estimated

---

## 19. Team Data Visibility Rules

### 19.1 User-Side Privacy

User-side team pages should not expose full sensitive details across unlimited depth.

### 19.2 Default Exposure

Recommended default user-side exposure:
- full detail for direct subordinates only
- aggregated statistics for deeper levels
- masked wallet addresses for user-side views

### 19.3 Admin Visibility

Admin users may view full relationship tree and operationally necessary details according to role permissions.

---

## 20. Reporting Rules (Business Semantics)

### 20.1 Daily Deposit

Daily deposit for a UTC day is the sum of confirmed, non-reversed purchase amounts whose financial date falls in that UTC day.

### 20.2 Reward Issued

Reward issued refers to actual payable reward snapshots generated for that period, not raw reward before burn unless a report specifically says “raw reward”.

### 20.3 Burn Amount

Burn amount is the amount removed from raw team/equal-level rewards due to burn rules.

### 20.4 User Growth

New users should be defined by first successful authenticated user creation or first wallet-auth user record creation according to the final auth spec, but deposit conversion metrics should be based on first successful purchase.

---

## 21. Rule Precedence Summary

If rule conflicts arise, apply precedence in this order:

1. Chain-confirmed immutable financial fact
2. This business rules document
3. Effective config version for the relevant date and scope
4. State machine spec
5. API spec
6. UI behavior

---

## 22. Business Rule Acceptance Checklist

The implementation satisfies this document when all are true:

- referral binding happens only on first successful purchase
- direct rewards are never burned
- team/equal-level rewards are burned only according to defined cap rules
- burn usage includes claimable and claimed off-chain rewards
- tier evaluation is consistent with effective config version
- equal-level reward replaces differential reward on eligible same-level lines
- vesting uses independent lots, not weighted average merge
- config changes are versioned with effective date and scope
- settlement runs on UTC day boundary
- claim uses wallet signature and snapshot locking
- claimed history is protected from destructive recompute overwrite
- negative and positive corrections use adjustment records

---

## 23. Next Documents

The following documents should implement this business rules spec concretely:

- `02_Backend_Architecture_Spec.md`
- `03_Database_Schema_Spec.md`
- `04_API_Spec.md`
- `05_User_Frontend_PRD.md`
- `06_Admin_Panel_PRD.md`
- `07_State_Machines_And_Exception_Flows.md`

