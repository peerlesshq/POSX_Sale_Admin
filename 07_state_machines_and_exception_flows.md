# POSX Token Sale System — State Machines and Exception Flows

## 1. Document Control

- Document Name: `07_State_Machines_And_Exception_Flows.md`
- System Name: POSX Token Sale System
- Purpose: Define all critical lifecycle states, legal transitions, terminal states, retry behavior, exception handling, and correction flows across backend, user frontend, and admin operations
- Audience: Backend engineers, frontend engineers, QA, operations, Cursor, Claude Code
- Depends On:
  - `00_Master_PRD.md`
  - `01_Business_Rules_Spec.md`
  - `02_Backend_Architecture_Spec.md`
  - `03_Database_Schema_Spec.md`
  - `04_API_Spec.md`
  - `05_User_Frontend_PRD.md`
  - `06_Admin_Panel_PRD.md`

---

## 2. Purpose and Scope

This document defines the authoritative lifecycle behavior for all core runtime objects in the system.

It covers:
- user status state machine
- wallet auth nonce/session lifecycle
- purchase order lifecycle
- purchase recovery lifecycle
- chain event lifecycle
- vesting lot lifecycle
- reward snapshot lifecycle
- claim order lifecycle
- claim record lifecycle
- settlement job lifecycle
- recompute / adjustment lifecycle
- report export lifecycle
- admin session lifecycle
- exception and retry flows

This document exists to prevent ambiguous implementation across:
- backend handlers
- cron jobs
- admin actions
- frontend state rendering
- QA test scenarios

---

## 3. State Machine Design Principles

1. Every major mutable object must have one explicit status field.
2. State transitions must be one-way unless a defined rollback path exists.
3. Terminal states must be clearly identified.
4. Retriable states must be distinguishable from irrecoverable failure states.
5. A transition must occur only when its business preconditions are satisfied.
6. State changes that affect money or eligibility must be auditable.
7. Frontend display state should map directly from backend state, not infer hidden transitions.
8. Claimed financial history must not be silently rewritten.

---

## 4. Global State Terminology

### 4.1 Active State
A non-terminal state in which the object can continue progressing.

### 4.2 Terminal State
A state in which no further normal progression is expected.

### 4.3 Retriable Failure
A failure state where the object may be retried safely without creating duplicate financial side effects.

### 4.4 Irrecoverable Failure
A failure state requiring human intervention or creation of a new object rather than in-place retry.

### 4.5 Locked State
A state or field-level condition where an object is temporarily reserved by another workflow, such as reward snapshots locked by a claim order.

---

## 5. User Status State Machine

Object:
- `users.status`

Allowed states:
- `active`
- `restricted_purchase`
- `restricted_claim`
- `suspended`
- `blacklisted`

## 5.1 Semantics

### active
User may:
- authenticate
- create purchases
- create claim orders
- bind referral on first successful purchase if otherwise eligible
- accrue future off-chain rewards

### restricted_purchase
User may:
- authenticate
- view data
- create claim orders if claim is otherwise allowed

User may not:
- create new purchase orders
- complete new purchases
- create new referral binding through first purchase while restricted

### restricted_claim
User may:
- authenticate
- purchase
- continue to accrue future off-chain rewards if otherwise eligible

User may not:
- create claim orders

### suspended
User may:
- authenticate if product policy allows read-only access
- view existing account information

User may not:
- purchase
- claim
- invite or benefit from new first-purchase referral binding during suspension

Business effect:
- from effective suspension time forward, no new off-chain team/equal-level rewards should be generated
- existing unclaimed balances remain frozen unless later released by admin action

### blacklisted
User is fully restricted.

User may not:
- purchase
- claim
- invite
- accrue new off-chain rewards
- create new referral binding

Business effect:
- existing balances remain frozen pending admin resolution

## 5.2 Allowed Transitions

- `active -> restricted_purchase`
- `active -> restricted_claim`
- `active -> suspended`
- `active -> blacklisted`
- `restricted_purchase -> active`
- `restricted_purchase -> suspended`
- `restricted_purchase -> blacklisted`
- `restricted_claim -> active`
- `restricted_claim -> suspended`
- `restricted_claim -> blacklisted`
- `suspended -> active`
- `suspended -> restricted_purchase`
- `suspended -> restricted_claim`
- `suspended -> blacklisted`
- `blacklisted -> active` only by super-admin exceptional action if policy allows
- `blacklisted -> suspended` only by super-admin exceptional action if policy allows

## 5.3 Forbidden Transitions

- any implicit status change without admin action
- any automatic transition from `blacklisted` to other states
- any status change without audit log and reason

## 5.4 Trigger Sources

Allowed triggers:
- admin status update action
- approved internal compliance/risk process

Not allowed:
- frontend-only toggles
- background jobs changing user status without explicit policy and audit trail

## 5.5 Frontend Mapping

The user frontend should not derive capability from guesswork. It must use backend-provided status plus capability checks.

---

## 6. Auth Nonce State Machine

Object:
- `auth_nonces`

Implicit states derived from timestamps/fields:
- `active`
- `used`
- `expired`

## 6.1 State Definitions

### active
- `used_at is null`
- current time < `expires_at`

### used
- `used_at is not null`

### expired
- current time >= `expires_at` and `used_at is null`

## 6.2 Allowed Transitions

- `active -> used`
- `active -> expired`

## 6.3 Forbidden Transitions

- `used -> active`
- `expired -> active`
- reuse of a used nonce

## 6.4 Failure Cases

- wrong signature with valid nonce: no state change unless policy wants attempt tracking
- expired nonce used: reject with `NONCE_EXPIRED`
- already used nonce reused: reject with `NONCE_ALREADY_USED`

---

## 7. User Session Lifecycle

Object:
- `user_sessions`

States:
- `active`
- `expired`
- `revoked`

## 7.1 State Definitions

### active
- `revoked_at is null`
- current time < `expires_at`

### expired
- current time >= `expires_at`
- `revoked_at is null`

### revoked
- `revoked_at is not null`

## 7.2 Allowed Transitions

- `active -> revoked`
- `active -> expired`

## 7.3 Triggers

- logout => revoke
- session TTL elapsed => expired
- admin/session invalidation if implemented => revoked

---

## 8. Admin Session Lifecycle

Object:
- `admin_sessions`

States:
- `active`
- `expired`
- `revoked`

Rules mirror user session lifecycle, with admin auth as trigger source.

---

## 9. Purchase Order State Machine

Object:
- `purchase_orders.status`

Allowed states:
- `created`
- `approval_pending`
- `approval_done`
- `purchase_pending`
- `confirmed`
- `failed`
- `reversed`
- `cancelled`

## 9.1 State Definitions

### created
Backend order exists. No approval or tx linkage has been confirmed yet.

### approval_pending
Optional intermediate state if frontend/backend explicitly tracks user being asked to approve USDT allowance.

### approval_done
Approval tx exists or approval not required due to sufficient allowance.

### purchase_pending
Purchase tx hash attached or purchase believed submitted, awaiting confirmation pipeline.

### confirmed
Purchase fact has been created from confirmed chain data.

### failed
Purchase attempt did not lead to a valid purchase fact.
This includes:
- purchase tx reverted
- invalid tx linkage
- user-submitted purchase flow failed

### reversed
A confirmed purchase was later reversed through approved exception handling.

### cancelled
Order abandoned or administratively cancelled before becoming confirmed.

## 9.2 Recommended Transition Paths

### Standard Path A
- `created -> approval_pending -> approval_done -> purchase_pending -> confirmed`

### Standard Path B (approval already sufficient)
- `created -> purchase_pending -> confirmed`

### Failure Paths
- `created -> failed`
- `approval_pending -> failed`
- `approval_done -> failed`
- `purchase_pending -> failed`

### Cancellation Paths
- `created -> cancelled`
- `approval_pending -> cancelled`
- `approval_done -> cancelled`
- `purchase_pending -> cancelled` only if purchase never truly existed on chain and product policy allows local cancellation

### Post-confirmation Exception Path
- `confirmed -> reversed`

## 9.3 Terminal States

- `confirmed`
- `failed`
- `reversed`
- `cancelled`

## 9.4 Forbidden Transitions

- `failed -> confirmed` directly, unless recovery creates or links a real purchase fact and the implementation explicitly allows updating the original order from failed to confirmed via validated recovery flow
- `cancelled -> confirmed` without validated recovery logic
- `reversed -> confirmed`

## 9.5 Recovery Semantics

If recovery by tx hash validates a previously missed confirmed purchase, implementation may:
- either update original order to `confirmed`
- or leave original order failed/cancelled and create a linkage via recovery record to the confirmed purchase fact

Recommended behavior:
- if order identity is trustworthy and clearly matches the recovered tx, move order to `confirmed`
- otherwise keep historical order as-is and create an explicit recovery linkage

## 9.6 Frontend Mapping

Suggested UI buckets:
- initial: `created`
- approval step: `approval_pending`
- approved: `approval_done`
- waiting confirmation: `purchase_pending`
- success: `confirmed`
- failure: `failed`
- cancelled: `cancelled`
- reversed: admin-only or special status display

---

## 10. Purchase Recovery State Machine

Object:
- `purchase_recoveries.status`

Allowed states:
- `requested`
- `resolved`
- `failed`
- `duplicate`

## 10.1 State Definitions

### requested
Recovery request created, awaiting backend validation or background processing.

### resolved
Recovery successfully linked to a valid confirmed purchase fact.

### failed
Recovery could not validate or could not be completed.

### duplicate
Recovery request referenced a purchase already linked or already recovered.

## 10.2 Allowed Transitions

- `requested -> resolved`
- `requested -> failed`
- `requested -> duplicate`

## 10.3 Terminal States

- `resolved`
- `failed`
- `duplicate`

---

## 11. Chain Event State Machine

Object:
- `chain_events.status`

Allowed states:
- `observed`
- `confirmed`
- `processed`
- `reverted`
- `failed_processing`

## 11.1 State Definitions

### observed
Raw event has been seen on chain and stored, but has not met confirmation threshold.

### confirmed
Event has reached confirmation threshold and is eligible for business processing.

### processed
Business side effects have been committed successfully.

### reverted
Event was invalidated due to chain reorg or equivalent reversal before final business treatment.

### failed_processing
Event reached confirmed state but business processing failed.

## 11.2 Allowed Transitions

- `observed -> confirmed`
- `observed -> reverted`
- `confirmed -> processed`
- `confirmed -> failed_processing`
- `failed_processing -> processed` after safe retry
- `failed_processing -> reverted` only if later chain invalidation proves event unusable and business effects were not finalized

## 11.3 Terminal States

- `processed`
- `reverted`

`failed_processing` is non-terminal if retry is allowed.

## 11.4 Retry Rules

A `failed_processing` event may be retried only if:
- processing is idempotent
- prior partial side effects can be safely detected
- unique constraints and transactions prevent duplicate business facts

## 11.5 Exception Flow: Reorg

### Case A: Reorg before confirmation threshold
- keep event `observed`
- if no longer present or block hash mismatch invalidates it, mark `reverted`

### Case B: Reorg after confirmation but before processing finalization
- if processing not committed, mark `reverted`

### Case C: Reorg after processed business fact exists
- do not silently delete business history
- create downstream reversal/adjustment flow according to business policy
- raw chain event may be marked or linked for anomaly review, but financial corrections must be explicit

---

## 12. Referral Binding Lifecycle

Object:
- `referral_bindings`

This is mostly immutable rather than status-driven.

Implicit states:
- `candidate_captured` via pending capture store
- `bound`
- `manually_corrected`

## 12.1 Candidate Capture
A pending referral candidate exists before first successful purchase.

## 12.2 Bound
On first successful purchase, valid referral binding is inserted.

## 12.3 Manual Correction
Only allowed under explicit admin policy and only when dependent history constraints permit it.

## 12.4 Prohibited Changes
Once bound and locked, user-driven rebinding is forbidden.

---

## 13. Vesting Lot State Machine

Object:
- `vesting_lots.status`

Allowed states:
- `active`
- `completed`
- `voided`

## 13.1 State Definitions

### active
Lot exists and is part of normal vesting lifecycle.
It may be:
- fully locked
- partially released
- partially withdrawn
- fully released but not yet fully withdrawn

### completed
Lot is fully processed and economically exhausted.
Recommended completion condition:
- `withdrawn_amount >= total_locked`
or equivalent business-specific completion condition

### voided
Lot should no longer count due to approved exceptional correction, such as linked purchase reversal.

## 13.2 Allowed Transitions

- `active -> completed`
- `active -> voided`

## 13.3 Terminal States

- `completed`
- `voided`

## 13.4 Notes

Do not create complex intermediate statuses unless contract sync truly requires them. Most vesting display state can be derived from amounts rather than status inflation.

---

## 14. Team Reward Snapshot State Machine

Object:
- `team_rewards_daily.status`

Allowed states:
- `claimable`
- `claimed`
- `offset`
- `voided`

## 14.1 State Definitions

### claimable
Official daily snapshot exists and is available to be included in a claim order unless currently locked by one.

### claimed
Snapshot has been successfully paid through a confirmed claim order.

### offset
Snapshot amount has been reduced or fully consumed by negative adjustment/debit logic before or during claimability lifecycle.

### voided
Snapshot is no longer valid due to an approved exceptional correction path. Use sparingly.

## 14.2 Allowed Transitions

- `claimable -> claimed`
- `claimable -> offset`
- `claimable -> voided`
- `offset -> claimed` only if partially offset and remaining payable amount later gets claimed, depending on implementation detail

Recommended simpler rule:
- if offset is partial, keep status `claimable` with reduced remaining payable amount
- if fully offset, use `offset`

## 14.3 Terminal States

- `claimed`
- `offset` if fully exhausted
- `voided`

## 14.4 Lock Semantics

Snapshot lock is represented by `claim_order_id`, not by a separate status.
A snapshot may be:
- `claimable` and unlocked
- `claimable` and temporarily locked by in-flight claim order

## 14.5 Failure Handling

If a claim order fails before completion:
- release lock
- return snapshot to claimable/unlocked state

---

## 15. Equal-Level Reward Snapshot State Machine

Object:
- `equal_level_rewards_daily.status`

Allowed states mirror `team_rewards_daily`:
- `claimable`
- `claimed`
- `offset`
- `voided`

Behavior matches team reward snapshot rules.

---

## 16. Burn Record Lifecycle

Object:
- `burn_records`

Burn records are immutable financial explanations, not a rich state machine.

Implicit lifecycle:
- created at settlement time
- never mutated except for rare administrative annotation if permitted

Rules:
- no separate active/closed status required in v1
- treat as immutable ledger rows

---

## 17. Claim Order State Machine

Object:
- `claim_orders.status`

Allowed states:
- `pending_signature`
- `queued`
- `broadcasted`
- `confirmed`
- `failed`
- `cancelled`

## 17.1 State Definitions

### pending_signature
Claim order created, claimable snapshots locked, waiting for wallet signature.

### queued
Signature verified, order accepted for payout broadcasting.

### broadcasted
Payout tx submitted or payout execution initiated, awaiting confirmation.

### confirmed
Payout confirmed. Linked snapshots finalized as claimed where applicable.

### failed
Claim could not complete successfully.
This may happen after:
- signature validation issue
- broadcast failure
- confirmation failure
- internal payout orchestration error

### cancelled
Claim order intentionally abandoned before payout execution.
Most often from:
- user closes/abandons before signing and system times out
- admin/system invalidates stale pending signature order

## 17.2 Allowed Transitions

- `pending_signature -> queued`
- `pending_signature -> cancelled`
- `pending_signature -> failed` only if signature validation process explicitly records failure terminally
- `queued -> broadcasted`
- `queued -> failed`
- `broadcasted -> confirmed`
- `broadcasted -> failed`

## 17.3 Terminal States

- `confirmed`
- `failed`
- `cancelled`

## 17.4 Locking Rules

When claim order enters `pending_signature`:
- linked claimable snapshots are locked to this claim order

If claim order reaches:
- `confirmed`: snapshots finalized as claimed
- `failed` or `cancelled`: snapshot locks released and snapshot eligibility restored according to business logic

## 17.5 Retry Rules

### pending_signature timeout
If not signed within configured TTL:
- auto-cancel or manual cleanup to `cancelled`
- release locks

### queued retry
If not yet broadcast and broadcaster fails transiently:
- safe retry allowed

### broadcasted retry
Do not rebroadcast blindly if tx hash exists and on-chain outcome is uncertain.
Need transaction outcome inspection first.

## 17.6 Frontend Mapping

- pending_signature => “Ready to Sign”
- queued => “Queued”
- broadcasted => “Broadcasted / Waiting Confirmation”
- confirmed => “Claim Successful”
- failed => “Claim Failed”
- cancelled => “Claim Cancelled”

---

## 18. Claim Record Lifecycle

Object:
- `claim_records.status`

Allowed states:
- `confirmed`
- `failed`

This is an immutable payout history ledger.

Rules:
- create `confirmed` record when payout is final
- create `failed` record if product wants durable history of failed payout attempts
- no transitions after creation in v1

---

## 19. Adjustment Record State Machine

Object:
- `adjustment_records.status`

Allowed states:
- `active`
- `fully_offset`
- `voided`

## 19.1 State Definitions

### active
Adjustment still has financial effect remaining.
For credits:
- some or all credit remains available

For debits:
- some or all debit remains to be offset against future payable rewards

### fully_offset
Adjustment remaining amount has reached zero.
No further financial effect remains.

### voided
Adjustment invalidated by approved correction of the correction itself.
Use sparingly and audit heavily.

## 19.2 Allowed Transitions

- `active -> fully_offset`
- `active -> voided`

## 19.3 Terminal States

- `fully_offset`
- `voided`

## 19.4 Balance Behavior

Each offset event should reduce `remaining_amount` transactionally.
Status becomes `fully_offset` when `remaining_amount = 0`.

---

## 20. Settlement Job State Machine

Object:
- `settlement_jobs.status`

Allowed states:
- `running`
- `completed`
- `failed`
- `partial`
- `cancelled`

## 20.1 State Definitions

### running
Job created and currently executing.

### completed
Job finished successfully and all intended outputs committed.

### failed
Job failed before acceptable completion.
Outputs may be absent or incomplete and must be handled according to transactional design.

### partial
Job produced some outputs but not enough to be considered fully successful.
Requires operational review.

### cancelled
Job was manually or systemically aborted before completion.

## 20.2 Allowed Transitions

- `running -> completed`
- `running -> failed`
- `running -> partial`
- `running -> cancelled`

## 20.3 Terminal States

- `completed`
- `failed`
- `partial`
- `cancelled`

## 20.4 Modes

Settlement job mode is separate from status.
Modes:
- `official`
- `backfill`
- `recompute_preview`
- `recompute_apply_adjustment`

## 20.5 Failure Semantics

### Full failure
- no official outputs committed, or job cannot be trusted

### Partial
- some outputs exist but require review
- system should expose counts and error sample
- further rerun strategy depends on job type and idempotency

---

## 21. Recompute Lifecycle

Recompute is represented through `settlement_jobs` with recompute modes plus resulting adjustment rows.

## 21.1 Preview Flow

1. create settlement job in `running`
2. compute differences
3. persist diff summary / output artifacts as needed
4. mark job `completed` or `failed`/`partial`
5. no official financial balances mutated

## 21.2 Apply Flow

1. create settlement job in `running`
2. recompute differences
3. create `adjustment_records`
4. update related summaries if needed
5. mark job `completed` or `failed`/`partial`

## 21.3 Apply Preconditions

- super-admin permission
- required reason
- business-safe date/context

## 21.4 Prohibited Behavior

- destructive overwrite of already claimed reward snapshots
- silent recalculation of history without adjustment ledger

---

## 22. Config Version Lifecycle

Object:
- `config_versions.status`

Allowed states:
- `draft`
- `active`
- `superseded`
- `disabled`

## 22.1 State Definitions

### draft
Version created but not yet active for resolution.

### active
Version eligible to be resolved according to `effective_from` and `apply_scope`.
There may be multiple active historical versions across time, but resolution selects the right one by date/scope.

### superseded
Version no longer the newest relevant active version for future dates, but remains historically important.

### disabled
Version should not be used for future evaluation.
Use carefully because historical calculations may still reference prior effective versions.

## 22.2 Allowed Transitions

- `draft -> active`
- `active -> superseded`
- `draft -> disabled`
- `active -> disabled` only with careful policy

## 22.3 Notes

In many implementations, “superseded” may be logical rather than manually set. The system can keep old rows active historically and derive supersession. Still, explicit status helps admin UX.

---

## 23. Report Export Job State Machine

Object:
- `report_export_jobs.status`

Allowed states:
- `queued`
- `running`
- `completed`
- `failed`

## 23.1 Allowed Transitions

- `queued -> running`
- `running -> completed`
- `running -> failed`

## 23.2 Terminal States

- `completed`
- `failed`

---

## 24. Job Run State Machine

Object:
- `job_runs.status`

Allowed states:
- `running`
- `completed`
- `failed`
- `partial`
- `cancelled`

This mirrors settlement job behavior but applies to all operational jobs.

---

## 25. Exception Flow: Approval Success, Purchase Failure

Scenario:
- allowance approval completed successfully
- purchase tx fails or never completes

Expected behavior:
1. purchase order remains or moves to `approval_done`
2. if purchase attempt definitively fails, move to `failed`
3. no purchase fact created
4. no cumulative deposit update
5. no referral binding triggered
6. no rewards generated

Frontend guidance:
- show that approval succeeded but purchase did not
- allow retry by creating a fresh purchase flow or continuing depending on UX design

---

## 26. Exception Flow: Purchase Tx Submitted, Confirmation Delayed

Scenario:
- purchase tx hash attached
- chain confirmation delayed or sync lag exists

Expected behavior:
1. purchase order stays `purchase_pending`
2. chain event remains `observed` until threshold met
3. user frontend shows waiting/pending state
4. if delay becomes abnormal, expose help text and recovery option

No financial effects should be treated as final before chain confirmation threshold.

---

## 27. Exception Flow: Chain Success, Backend Missed Sync

Scenario:
- user submitted valid chain purchase
- normal sync/linking missed it

Expected behavior:
1. user submits recovery request
2. purchase recovery row enters `requested`
3. backend validates tx hash
4. if valid and not yet linked, create purchase fact and update related order linkage if possible
5. recovery moves to `resolved`
6. downstream processes proceed normally (vesting, referral binding if applicable, summaries)

If tx hash already linked:
- recovery moves to `duplicate`

If invalid:
- recovery moves to `failed`

---

## 28. Exception Flow: Duplicate Purchase Submission

Scenario:
- same client_order_id submitted twice
- or same tx hash attached multiple times

Expected behavior:
- API returns original order when idempotency match is valid
- no duplicate purchase order business effect
- unique constraints prevent duplicate purchase fact or chain event processing

---

## 29. Exception Flow: Referral Candidate Exists but Binding Invalid

Scenario examples:
- self-referral
- referral cycle
- candidate referrer wallet invalid
- user already bound
- user already purchased before

Expected behavior:
- purchase may still confirm if contract/business allows purchase independent of referral validity
- referral binding is skipped
- audit/log event may be written
- user remains unbound if no valid alternative exists

No retroactive re-binding should occur automatically later.

---

## 30. Exception Flow: Claim Created but User Never Signs

Scenario:
- claim order created
- snapshots locked
- user abandons before signing

Expected behavior:
1. claim order remains `pending_signature` until TTL expires
2. cleanup job or explicit cancellation sets order to `cancelled`
3. linked snapshots unlock and return to claimable state
4. no payout broadcast occurs

Frontend should show expired/cancelled state on refresh.

---

## 31. Exception Flow: Claim Broadcast Failure

Scenario:
- claim signed and queued
- payout broadcaster fails before or during broadcast

Expected behavior:

### Case A: No tx submitted
- claim order may move `queued -> failed`
- snapshots unlock and return to claimable state
- safe retry allowed by creating new claim order

### Case B: Tx may have been submitted but status uncertain
- do not unlock immediately without transaction inspection
- keep `broadcasted` if tx hash exists and confirmation uncertain
- only mark `failed` once backend concludes payout did not succeed or is irrecoverably failed

Financial safety is higher priority than quick UX resolution.

---

## 32. Exception Flow: Claim Confirmation Delayed

Scenario:
- claim order broadcasted
- chain confirmation delayed

Expected behavior:
- remain `broadcasted`
- linked snapshots remain locked
- frontend shows waiting state
- confirmation poller eventually transitions to `confirmed` or `failed`

No new claim order may be created using locked snapshots during this period.

---

## 33. Exception Flow: Settlement Partial Failure

Scenario:
- daily settlement starts
- some users processed, some fail

Expected behavior:
1. settlement job marked `partial`
2. error counts and samples stored
3. outputs already created remain traceable via settlement job id
4. operator reviews whether rerun/backfill/adjustment needed

Recommended implementation strategy:
- process user-level settlement atomically per user or per chunk
- avoid leaving half-written rows within one user’s reward set

---

## 34. Exception Flow: Recompute Preview Finds Differences

Scenario:
- preview detects discrepancies

Expected behavior:
- no official reward snapshot mutation
- no adjustment creation
- preview result visible to admin
- optional next step: super-admin apply

Frontend/admin should clearly label preview as non-financial and non-mutating.

---

## 35. Exception Flow: Recompute Apply on Claimed History

Scenario:
- recompute finds that claimed history differs from corrected result

Expected behavior:
- no overwrite of claimed snapshots
- generate adjustment records
- positive difference => credit adjustment
- negative difference => debit adjustment
- future claimable calculations incorporate adjustments

This is a central safety rule and must never be bypassed.

---

## 36. Exception Flow: Purchase Reversal After Rewards Already Exist

Scenario:
- confirmed purchase later reversed
- direct reward or team/equal-level downstream effects may already exist

Expected behavior:
1. create `purchase_reversal`
2. mark purchase excluded from future cumulative deposit / team performance logic
3. if future settlement runs reference reversed purchase, they must exclude it
4. if prior off-chain rewards were overpaid because of the purchase, correction happens through adjustments
5. chain-backed direct reward fact is not rewritten; operational recovery is handled by separate accounting/adjustment policy

---

## 37. Exception Flow: Burn Applies During Settlement

Scenario:
- user is below or equal to burn disable threshold
- raw team/equal-level reward exceeds remaining burn capacity

Expected behavior:
1. calculate raw reward
2. compute used burn capacity
3. compute remaining burn capacity
4. actual payable = min(raw, remaining)
5. burned amount = raw - actual payable
6. create reward snapshot with actual payable amount
7. create burn record

Burn never moves a reward snapshot into a special “burned” status. Burn is represented numerically and through burn ledger rows.

---

## 38. Exception Flow: User Status Changes During In-Flight Actions

## 38.1 Purchase Flow
If user becomes `restricted_purchase`, `suspended`, or `blacklisted` during purchase flow:
- new purchase creation must stop immediately
- in-flight chain-submitted purchase should be handled according to actual chain fact
- already-confirmed purchase fact should not be silently discarded
- future eligibility and referral binding logic should honor business policy at processing time

Recommended behavior:
- if purchase truly confirmed on chain, record purchase fact
- apply user status restrictions to future actions, not by pretending confirmed chain fact never happened

## 38.2 Claim Flow
If user becomes `restricted_claim`, `suspended`, or `blacklisted` before claim order creation:
- reject claim creation

If status changes after claim order has already reached `broadcasted`:
- do not blindly cancel if payout is already in flight
- let payout finalize according to transaction outcome, then apply restrictions to future claims

If status changes while `pending_signature`:
- pending order may be cancelled and locks released based on policy

---

## 39. Exception Flow: Admin Config Changes with Future Effective Date

Scenario:
- admin creates new config version effective next UTC day

Expected behavior:
- current reads for existing effective window remain unchanged
- future settlement/order resolution uses new version only when `effective_from` and `apply_scope` rules match
- config status/history visible immediately in admin panel even before effective date

---

## 40. Capability Matrix by Object State

## 40.1 Purchase Order Capability Summary

| State | Can Attach Tx | Can Recover | Can Become Confirmed | Terminal |
| --- | --- | --- | --- | --- |
| created | Yes | Yes | Yes | No |
| approval_pending | Yes | Yes | Yes | No |
| approval_done | Yes | Yes | Yes | No |
| purchase_pending | No or limited | Yes | Yes | No |
| confirmed | No | No | Already yes | Yes |
| failed | No | Yes, via recovery rules | Possibly via recovery linkage | Yes-ish |
| cancelled | No | Possibly | Possibly via validated recovery linkage | Yes-ish |
| reversed | No | No | No | Yes |

## 40.2 Claim Order Capability Summary

| State | Snapshots Locked | Can Sign | Can Broadcast | Can Retry | Terminal |
| --- | --- | --- | --- | --- | --- |
| pending_signature | Yes | Yes | No | N/A | No |
| queued | Yes | No | Yes | Yes | No |
| broadcasted | Yes | No | Already attempted | Inspect first | No |
| confirmed | Finalized | No | No | No | Yes |
| failed | Released or inspected | No | New claim required | Maybe via new order | Yes |
| cancelled | Released | No | No | New claim required | Yes |

---

## 41. QA-Oriented Transition Checklist

Critical transition cases QA must verify:

1. `active -> restricted_purchase` blocks purchase but not dashboard access
2. valid nonce cannot be used twice
3. purchase order reaches `confirmed` only after chain confirmation threshold and fact creation
4. failed chain event processing retries do not create duplicate purchases
5. first successful purchase binds referral only once
6. pending claim locks snapshots against second claim creation
7. cancelled pending-signature claim releases locks
8. broadcasted claim does not duplicate payout on retry confusion
9. settlement partial failure is visible and auditable
10. recompute apply creates adjustments, not overwrites
11. purchase reversal excludes future calculations and triggers correction path
12. burn reduces payable amount without affecting direct rewards

---

## 42. Recommended Implementation Notes

1. Prefer transition helper functions over raw status mutation in handlers.
2. Validate current state before every transition.
3. Use transaction boundaries around transitions that also create dependent records.
4. Log who/what/when for admin-triggered transitions.
5. Use terminal-state guards to prevent accidental re-entry.
6. For in-flight locks, use both status and foreign-key linkage where appropriate.

Example helper pattern:
- `assertPurchaseOrderCanAttachTx(currentStatus)`
- `transitionClaimOrderToQueued(order, signatureMetadata)`
- `finalizeSettlementJobAsPartial(jobId, metrics)`

---

## 43. Acceptance Criteria

This document is correctly implemented when all are true:

1. every major mutable business object has explicit valid states
2. terminal states are enforced consistently
3. illegal transitions are rejected server-side
4. snapshot locking during claim prevents double claim
5. chain event processing remains idempotent under retries
6. in-flight and failed purchase scenarios resolve predictably
7. settlement, recompute, and adjustment flows are separable and auditable
8. user restrictions affect actions consistently across API and UI
9. purchase reversal and correction scenarios do not silently rewrite immutable financial history
10. QA can derive complete test scenarios from this document

---

## 44. Next Documents

The next documents to implement are:
- `08_Auth_And_Permissions_Spec.md`
- `09_Config_Center_Spec.md`
- `10_I18N_And_Content_Spec.md`
- `11_Reporting_And_Metrics_Definition.md`

These will define permission detail, config semantics, content behavior, and metric formulas that operate on top of these state machines.

