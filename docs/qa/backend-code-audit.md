# Backend Code Audit

**Scope**: `supabase/functions/_shared/src/` + `supabase/functions/api/` (router, dispatcher, context).
**Out of scope**: `packages/domain-rules`, `packages/shared-*`, `packages/config`, SQL migrations.

**Total findings**: 94 (S0: 24, S1: 53, S2: 17)

---

## Section 1 — Auth & Session

### BE-01 · S0 · auth · Wallet signature verified against rebuilt-with-NOW message, not the message the client signed

**File**: `supabase/functions/_shared/src/auth/wallet-verify-service.ts:79-91`

```ts
const message = buildAuthMessage({
  walletAddress: input.walletAddress,
  nonce: input.nonce,
  issuedAt: this.clock.nowIso(),
});
const signatureOk = verifyWalletSignature({
  message,
  signature: input.signature,
  expectedWalletAddress: input.walletAddress,
});
```

**Symptom**: `consumeNonce` returns the wallet address but does not return the nonce row's `created_at` / `expires_at`. The verifier rebuilds the message with `this.clock.nowIso()` instead of the timestamp the client signed. Today this works only because `buildAuthMessage` silently does not bind `issuedAt` into the canonical body — if that ever changes, every wallet auth attempt will fail in production with `INVALID_SIGNATURE`.

**Why it matters**: Two layers are held together by a comment, not by code. Prototypical "passes review, breaks on Wednesday."

**Confidence**: high

### BE-02 · S0 · auth · `findAuthNonceByValue` does not bind to wallet, enabling nonce-burn DoS

**File**: `supabase/functions/_shared/src/repos/auth-nonces.ts:41-49`

```ts
export async function findAuthNonceByValue(
  db: DbClient,
  nonce: string,
): Promise<AuthNonceRow | null> {
  return db.queryOne<AuthNonceRow>(
    `select * from auth_nonces where nonce = $1`,
    [nonce],
  );
}
```

**Symptom**: Lookup is purely by nonce. Wallet-binding is enforced after the row returns. The `consumeNonce` call marks the row used *before* the wallet check, so an attacker who observes any valid nonce can submit a verify call with the wrong wallet → `consumeNonce` marks it used → wallet check throws → legitimate user's nonce is burned.

**Why it matters**: Cheap DoS. Not credential compromise, but an attacker can keep forcing nonce reissuance for any wallet whose nonces they see.

**Confidence**: high

### BE-03 · S1 · auth · Nonce expiry uses ISO string `<=` compare

**File**: `supabase/functions/_shared/src/auth/nonce-service.ts:85-88`

```ts
const nowIso = this.clock.nowIso() as IsoTimestamp;
if (row.expires_at <= nowIso) {
  throw new AppError('NONCE_EXPIRED', 'nonce expired');
}
```

**Symptom**: Lexical ISO compare only works if both strings are the same precision / timezone. Any clock format drift creates off-by-one windows on expiry.

**Confidence**: medium

### BE-04 · S1 · auth · No visible unique constraint on nonces + no `for update` on `markAuthNonceUsed`

**File**: `supabase/functions/_shared/src/repos/auth-nonces.ts:29-63`

**Symptom**: `markAuthNonceUsed` relies on `where used_at is null` for atomicity — depends on DB constraint being present. Two concurrent verify calls with the same nonce could both succeed without `select ... for update` or a unique constraint.

**Confidence**: medium

### BE-05 · S1 · auth · 7-day bearer tokens, no rotation, no idle-timeout, no admin audit on login/logout

**Files**: `_shared/src/auth/admin-auth-service.ts:73-91`, `_shared/src/auth/wallet-verify-service.ts:103-119`

**Symptom**: Admin session TTL is 168 hours. There is no `rotate()`, no idle timeout, no rolling expiry. Stolen admin tokens grant 7 days of `super_admin` access. No admin login is ever audit-logged (see BE-25).

**Confidence**: high

### BE-06 · S2 · auth · Session token SHA-256 hash is fine at-rest; no peppering / rotation story

**File**: `_shared/src/auth/admin-auth-service.ts:94-95`

**Confidence**: medium (not a defect, style note)

### BE-07 · S0 · auth · Zero rate limiting anywhere

**Files**: `_shared/src/auth/*`, `supabase/functions/api/router.ts`

**Evidence**: No rate limit code anywhere. `RATE_LIMITED` error code exists in `errors/app-error.ts:69` but is never thrown.

**Symptom**: Unlimited brute-force on admin login (BE-08), nonce issue, wallet verify, and everything else.

**Why it matters**: Combined with bcrypt-12 (~100ms/attempt), an attacker can pin a connection and try thousands of admin emails per minute.

**Confidence**: high

### BE-08 · S0 · auth · No password lockout after failed admin login attempts

**File**: `_shared/src/auth/admin-auth-service.ts:55-91`

```ts
const passwordOk = compareSync(input.password, admin.password_hash);
if (!passwordOk) {
  throw new AppError('UNAUTHORIZED', 'invalid credentials');
}
```

**Symptom**: Failures aren't counted, throttled, or logged. `admin_users` has no `failed_login_attempts` column referenced anywhere. Credential stuffing is unmitigated.

**Confidence**: high

### BE-09 · S2 · auth · `compareSync` blocks event loop, bcrypt cost not env-driven

**Files**: `_shared/src/auth/admin-auth-service.ts:7,68`, `_shared/src/handlers/admin.ts:893`

**Symptom**: One slow login request blocks all other requests on the same worker.

**Confidence**: medium

### BE-10 · S1 · auth · `revokeAdminSession` silently no-ops when session doesn't exist

**File**: `_shared/src/repos/admin-sessions.ts:60-71`

```ts
await db.query(
  `update admin_sessions
      set revoked_at = $2
    where session_token_hash = $1 and revoked_at is null`,
  [tokenHash, revokedAt],
);
```

**Symptom**: Update with zero rows affected still returns void. `handleAdminLogout` returns `{ logged_out: true }` regardless. Caller is told they're logged out when nothing happened.

**Confidence**: high

### BE-11 · S1 · auth · `assertUserOwnsResource` is dead code

**File**: `_shared/src/auth/guards.ts:79-86`

**Symptom**: Exported but never imported. Ownership checks are open-coded inside individual handlers (claim.ts:84, 139, purchase.ts via service). New handlers will skip the check because the helper is invisible.

**Confidence**: high

---

## Section 2 — Admin Handlers

### BE-12 · S0 · admin · `handleAdminDashboard` ships `trend: []` + empty `tier_distribution` (SQL `where 1=0`)

**File**: `_shared/src/handlers/admin.ts:113-137`

```ts
const tiers = await ctx.db.query<{ tier: string; count: number }>(
  `select coalesce(current_tier::text,'none') as tier, count(*)::int as count
     from (
       select null::text as current_tier from users where 1=0
     ) t group by tier`,
);
...
return success(ctx, {
  ...
  trend: [],
  tier_distribution: tiers,
});
```

**Symptom**: Known stub shipping a 200 OK envelope with placeholder values. Admins making decisions on "trend is empty" or "no users in any tier" are operating on lies.

**Confidence**: high

### BE-13 · S1 · admin · `handleListAdminUsers` hardcodes `current_tier: null`, ignores `opts.tier` filter

**File**: `_shared/src/handlers/admin.ts:142-200`

```ts
items: rows.map((r) => ({
  ...
  current_tier: null,
```

**Symptom**: `opts.tier` accepted but never used in the `where` clause. Holding value is just deposit. Tier filter is an advertised no-op.

**Confidence**: high

### BE-14 · S1 · admin · `handleListAdminUsers` runs N+5 correlated subqueries per row + `count(*)` ignores filters

**File**: `_shared/src/handlers/admin.ts:158-185`

**Symptom**: 4 correlated subqueries per row × 50 rows = 250 subqueries per page. `count(*) from users` in the pagination block ignores `search`/`status` filters → phantom pages.

**Confidence**: high

### BE-15 · S0 · admin · `handleGetAdminUserDetail` hardcodes `team_total_performance: '0'`, `reward_qualified: false`, `team_reward_qualified: false`, `current_tier: null`

**File**: `_shared/src/handlers/admin.ts:259-281`

```ts
financial: {
  cumulative_deposit: row.deposit,
  holding_posx_amount: row.deposit,
  holding_value_usdt: row.deposit,
  current_tier: null,
  reward_qualified: false,
  team_reward_qualified: false,
  team_total_performance: '0',
},
```

**Symptom**: Fields an operator uses to decide suspension / status change are always zero / false / null. Investigating a user shows team_total_performance = 0 even when the user has a multi-thousand-USDT downline.

**Confidence**: high

### BE-16 · S1 · admin · `handleGetAdminUserDetail` runs 9 correlated subqueries against the same summary views

**File**: `_shared/src/handlers/admin.ts:226-243`

**Symptom**: 9 correlated subqueries against `user_reward_summary` / `user_vesting_summary` per call. A single `LEFT JOIN` would do this in one shot.

**Confidence**: high

### BE-17 · S1 · admin · No role enforcement on read endpoints (viewer sees everything)

**File**: `_shared/src/handlers/admin.ts` (every read handler)

**Symptom**: `requireAdminSession` is the only gate. Viewer/operator/super_admin see identical data: every wallet, full referral tree, admin IPs, job error messages. The role hierarchy is defined but unused for reads.

**Confidence**: high

### BE-18 · S1 · admin · Read handlers never write `writeAuditLog`

**File**: `_shared/src/handlers/admin.ts` (all read endpoints)

**Symptom**: Only mutation handlers audit. Operators can harvest every user's full profile via `handleGetAdminUserDetail` with no trail. Compliance gap (SOX/GDPR/CCPA require access logging for PII reads).

**Confidence**: high

### BE-19 · S0 · admin · `handleRecomputeApply` accepts empty diffs, audits as success, writes nothing

**File**: `_shared/src/handlers/admin.ts:700-726`

```ts
const summary = await ctx.services.recompute.applyAdjustment({
  settlementDate: input.settlement_date,
  reason: input.reason,
  triggeredByAdminId: actor.admin.id,
  diffs: [],
});
```

**Symptom**: `diffs: []` hardcoded. Writes a `settlement_jobs` row, transitions it to `completed`, audits as `recompute_apply`, creates zero adjustments. Audit trail says the operator did a recompute. DB says nothing happened. Operator can use this to *appear* to act on a discrepancy and silence the alarm.

**Confidence**: high

### BE-20 · S2 · admin · `handleRecomputePreview` always returns `difference_count: 0`

**File**: `_shared/src/services/recompute-service.ts:53-88`

**Symptom**: Stub returns all zeros. No banner in the response indicating "placeholder". Admin debugging a settlement discrepancy will see "nothing wrong" and draw the wrong conclusion.

**Confidence**: high

### BE-21 · S1 · admin · `handleUpdateUserStatus` does TOCTOU read + transition outside any transaction

**File**: `_shared/src/handlers/admin.ts:284-315`

**Symptom**: `oldRow` read happens outside any tx; `transitionUserStatus` does its own `findUserByWallet` then `updateUserStatus` then `writeAuditLog` also without a transaction. Two concurrent admins can race, one write wins silently. See BE-22 for the audit-gap aspect.

**Confidence**: high

### BE-22 · S0 · transitions · `transitionUserStatus` has no transaction around status update + audit log

**File**: `_shared/src/transitions/user-status.ts:51-72`

```ts
const updated = await updateUserStatus(db, {
  wallet_address: input.wallet,
  status: input.toStatus,
  ...
});

await writeAuditLog(db, {
  adminUserId: input.actorAdminId,
  action: 'update_user_status',
  ...
});

return updated;
```

**Symptom**: Two separate DB calls. If audit write raises, the user is suspended but no admin_log row exists. Compliance auditors flag this as "action without audit trail."

**Confidence**: high

### BE-23 · S1 · transitions · `transitionClaimOrder`, `transitionPurchaseOrder`, `transitionSettlementJob` take `db`, not `tx`

**Files**: `_shared/src/transitions/*.ts`

**Symptom**: `claim-signing-service.ts:55-91` passes `this.db` not a transaction handle, so the three sequential state transitions (`pending_signature → queued → broadcasted`) + broadcaster call are not atomic. Crash between broadcast and second transition → order stuck in `queued` even though broadcaster submitted.

**Confidence**: high

### BE-24 · S2 · transitions · No-op idempotent path papers over caller bugs

**File**: `_shared/src/transitions/purchase-order.ts:38-41`

**Confidence**: medium

### BE-25 · S1 · admin · `handleAdminLogin` and `handleAdminLogout` never audit

**File**: `_shared/src/handlers/admin.ts:55-80`

**Symptom**: No `writeAuditLog` call on admin login or logout. Failed admin logins also unlogged. Combined with BE-07 + BE-08, attacker can credential-stuff completely silently.

**Confidence**: high

### BE-26 · S2 · admin · New admin accounts have no "must change password on first login"

**File**: `_shared/src/handlers/admin.ts:884-913`

**Confidence**: medium

### BE-27 · S1 · admin · `handleUpdateAdminAccount` has no self-protect rules

**File**: `_shared/src/handlers/admin.ts:915-951`

**Symptom**: A super_admin can demote themselves to viewer → lock themselves out. No "must have ≥ 1 super_admin" check. No "cannot change your own role".

**Confidence**: high

### BE-28 · S1 · admin · `handleGetAdminUserTree` accepts `max_depth` from caller with no upper bound

**File**: `_shared/src/handlers/admin.ts:317-354`

**Symptom**: Caller can pass `max_depth=99999`. Query returns entire downstream subtree with 5 subqueries per row. No `limit` clause. DoS by query bloat.

**Confidence**: high

### BE-29 · S1 · admin · `handleListAdminLogs` exposes IP, target_id, detail to every admin including viewer

**File**: `_shared/src/handlers/admin.ts:799-860`

**Symptom**: No role gate. Viewer admin sees every other admin's IP address + full detail blob. PII leak between admins. No meta-audit on reads of the audit log itself.

**Confidence**: high

---

## Section 3 — User Handlers

### BE-30 · S1 · handlers · `handleGetUserProfile` throws `Error` instead of `AppError`

**File**: `_shared/src/handlers/user.ts:44-45`

```ts
const user = await findUserByWallet(ctx.db, wallet);
if (!user) throw new Error('user not found');
```

**Symptom**: `toAppError` remaps to `INTERNAL_ERROR` 500. Should be 404.

**Confidence**: high

### BE-31 · S1 · handlers · `handleGetUserProfile` returns 5 hardcoded fields

**File**: `_shared/src/handlers/user.ts:54-69`

```ts
return success(ctx, {
  ...
  current_tier: null,
  reward_qualified: false,
  team_reward_qualified: false,
  direct_rate: null,
  team_rate: null,
  ...
});
```

**Symptom**: "Phase 4.5 stub — Tier + rates are derived in Phase 5" — but returned as live data. User dashboards show "tier: none" / "qualified: no" for everyone regardless of actual state.

**Confidence**: high

### BE-32 · S1 · handlers · `handleGetUserDashboard.burn_status` hardcodes `burn_enabled: false`

**File**: `_shared/src/handlers/user.ts:114-120`

**Symptom**: Real `handleGetBurnStatus` exists but dashboard short-circuits to `burn_enabled: false`. Dashboard and rewards page disagree about burn state.

**Confidence**: high

### BE-33 · S2 · handlers · `handleGetUserDashboard` fetches all purchases then slices to 5 in JS

**File**: `_shared/src/handlers/user.ts:80`

```ts
const recentPurchases = (await listPurchasesByWallet(ctx.db, wallet)).slice(0, 5);
```

**Confidence**: high

### BE-34 · S1 · handlers · `handleGetVesting` fetches all lots then pages in JS

**File**: `_shared/src/handlers/vesting.ts:21-22`

**Confidence**: high

### BE-35 · S0 · handlers · `handleSignClaimOrder` re-derives signed message from a NULL placeholder column

**File**: `_shared/src/handlers/claim.ts:74-95` + `router.ts:346-369`

```ts
const row = await ctx.db.queryOne<{
  id: string;
  wallet_address: string;
  signed_message: string | null;
  requested_total_amount: string;
}>(`select * from claim_orders where id = $1`, [params['id']!]);
const derivedMessage = row?.signed_message ?? '';
```

**Symptom**: `signed_message` is NULL until *after* signing. First sign call passes `''` to the verifier. Either all claim signing fails, or the verifier accepts empty-message signatures → forgery possible. The most dangerous bug in the audit.

**Confidence**: high

### BE-36 · S0 · services · `ClaimPreparationService.prepare` builds `messageToSign` then discards it

**File**: `_shared/src/services/claim-preparation-service.ts:148-163`

```ts
const messageToSign = buildClaimMessage({
  walletAddress: input.wallet,
  claimOrderId: order.id,
  amount: total,
  nonce: generateAuthNonce().slice(0, 16),
});

return {
  order,
  items: ...,
  messageToSign,
};
```

**Symptom**: Fresh nonce inside prepare, returned to caller, never persisted. Proximate cause of BE-35. `signed_message` column never written on order creation.

**Confidence**: high

### BE-37 · S1 · handlers · `handleListInviteReferrals` exposes L1 deposit amounts

**File**: `_shared/src/handlers/invite.ts:54-95`

**Symptom**: Wallet addresses are masked, deposits are not. Inviter can triangulate which referral made which deposit. Privacy rule 01 §19.2 says deeper levels must be aggregated only — same rule should apply to L1 deposits.

**Confidence**: medium

### BE-38 · S1 · handlers · `handleListInviteReferrals` returns `current_tier: null`

**File**: `_shared/src/handlers/invite.ts:86-92`

**Confidence**: high

### BE-39 · S1 · handlers · `handleGetTeamOverview` returns 5 hardcoded stub fields

**File**: `_shared/src/handlers/team.ts:33-43`

```ts
return success(ctx, {
  team_total_performance: row?.team_total ?? '0',
  today_effective_performance: '0',
  claimable_amount: row?.claimable ?? '0',
  pending_confirmation_amount: '0',
  total_received: row?.received ?? '0',
  total_claimed: row?.claimed ?? '0',
  current_team_rate: '0',
  current_tier: null,
  next_rate_target: null,
});
```

**Confidence**: high

### BE-40 · S1 · handlers · `handleListTeamMembers` hardcodes `level: 1`, ignores `opts.level` filter

**File**: `_shared/src/handlers/team.ts:46-114`

**Confidence**: high

### BE-41 · S1 · handlers · `handleListTeamDailyDetails` runs correlated subquery per row

**File**: `_shared/src/handlers/team.ts:135-152`

**Confidence**: high

### BE-42 · S1 · handlers · `handleGetInvite` derives referral code from last 8 hex chars of wallet → collisions + guessable

**File**: `_shared/src/handlers/invite.ts:38-44`

```ts
const referralCode = wallet.slice(-8);
return success(ctx, {
  ...
  invite_link: `https://posx.example/?r=${referralCode}`,
});
```

**Symptom**: 8 hex chars = 32 bits. Birthday-collision risk > 50% at 100k users. Anyone with a wallet address can guess the referral link. The domain `https://posx.example/` is a literal placeholder.

**Confidence**: high

### BE-43 · S2 · handlers · `handleGetUserProfile` does 6 serialized DB roundtrips

**File**: `_shared/src/handlers/user.ts:43-69`

**Confidence**: high

### BE-44 · S2 · handlers · `handleGetPublicConfig` hardcodes `announcements: null`

**File**: `_shared/src/handlers/public-config.ts:120-122`

**Confidence**: high

---

## Section 4 — Money precision

### BE-45 · S2 · money · `Number()` on router limit query param with no validation

**File**: `supabase/functions/api/router.ts:539`

```ts
limit: query['limit'] ? Number(query['limit']) : undefined,
```

**Symptom**: `Number("abc")` is `NaN`, `Number("1e308")` is Infinity. Downstream `Math.min(NaN, 500)` is `NaN`. Should use a zod schema.

**Confidence**: medium

### BE-46 · S2 · money · `Number()` on count fields in rebuilders

**Files**: `_shared/src/rebuilders/dashboard-daily-summary.ts:79-81`, `team-level-aggregate-daily.ts:79-80`

**Symptom**: Postgres returns bigints as strings; `Number()` is OK for counts < 2^53 but silently rounds above. Defensive lapse.

**Confidence**: medium

### **Money precision verdict**

Money columns (usdt_amount, reward_amount, etc.) are kept as decimal strings throughout. Audited handlers do **not** call `Number()` / `parseFloat` / `parseInt` / `toFixed` on any money column. This is a genuine strength. The only `Number()` calls in scope are on count fields and the router limit parameter.

---

## Section 5 — State machine transitions

See BE-22, BE-23, BE-24 above.

### BE-47 · S1 · transitions · `claim-signing-service.ts` passes `this.db` (not `tx`) to three sequential transitions

**File**: `_shared/src/services/claim-signing-service.ts:55-91`

**Symptom**: `pending_signature → queued → broadcaster.submit → broadcasted` with no transaction. Crash mid-way leaves order in `queued` forever while broadcaster submitted. No recovery loop.

**Confidence**: high

### BE-48 · S1 · transitions · `ClaimFinalizationService.finalize` does broadcaster check outside transaction

**File**: `_shared/src/services/claim-finalization-service.ts:38-99`

**Confidence**: medium

### BE-49 · S0 · services · `SettlementOrchestrator.run` has no per-user transaction

**File**: `_shared/src/services/settlement-orchestrator.ts:151-168`

**Symptom**: `settleOneUser` does multiple inserts (`team_rewards_daily`, `team_reward_line_details`, `equal_level_rewards_daily`, `burn_records`) without any transaction. Mid-user crash → partial snapshot exists with some line details and missing `burn_records`. Reconciliation trusts the snapshot's `actual_total` and over/under-pays.

**Confidence**: high

### BE-50 · S0 · services · `SettlementOrchestrator.settleOneUser` runs N queries inside per-line loop

**File**: `_shared/src/services/settlement-orchestrator.ts:342-410`

**Symptom**: For each subordinate line: deposit subquery + holding subquery + tier resolution + team rate resolution. With 1000 subordinates → 2000 queries per user per day. Perf collapse at real scale.

**Confidence**: high

### BE-51 · S0 · services · No idempotency key on `SettlementOrchestrator.run`

**File**: `_shared/src/services/settlement-orchestrator.ts:119-196`

**Symptom**: No `INSERT ... ON CONFLICT` and no check for existing job for same `(date, mode)`. Calling twice creates two complete sets of rewards, doubling everyone's claimable amount. Double-clicking the trigger button → double payout.

**Confidence**: high

### BE-52 · S1 · services · No lock to prevent concurrent daily-settlement runs

**File**: `_shared/src/jobs/runner.ts:32-73`

**Symptom**: No advisory lock, no `select ... for update`, no `pg_try_advisory_lock`. Two cron schedulers race → money double-write per BE-51.

**Confidence**: high

### BE-53 · S1 · services · `JobRunner.run` swallows exceptions into return value that callers ignore

**File**: `_shared/src/jobs/runner.ts:42-72`

**Confidence**: high

### BE-54 · S1 · services · `runDailySettlementJob` and `runSummaryRebuildJob` return void, discarding errors

**Files**: `_shared/src/jobs/daily-settlement.ts:25-48`, `summary-rebuild.ts:30-57`

**Symptom**: Failed settlement job returns successfully to cron. No retry. Silently fails for days.

**Confidence**: high

### BE-55 · S2 · services · No retry / backoff in jobs

**Confidence**: high

---

## Section 6 — Services (additional)

### BE-56 · S1 · services · Production claim broadcaster is a SHA-256 stub

**File**: `_shared/src/services/claim-broadcast/staging-broadcaster.ts:25-47`

```ts
async submit(input: BroadcastInput): Promise<BroadcastOutcome> {
  const hash = createHash('sha256')
    .update(`staging:${input.claimOrderId}|${input.wallet}|${input.amount}`)
    .digest('hex')
    .padEnd(64, '0')
    .slice(0, 64);
  return { kind: 'submitted', txHash: `0x${hash}` as TxHash };
}
```

**And**: `context.ts:54-61` — "Staging + production both use the staging broadcaster until a real on-chain payout adapter lands."

**Symptom**: Production claim payouts do not hit a real chain. There is NO real on-chain broadcaster in the entire codebase.

**Why it matters**: The single most important integration in a money system — "do payouts actually happen?" — is a SHA-256 of the order id.

**Confidence**: high

### BE-57 · S1 · services · `StagingClaimBroadcaster.seen` is in-memory only

**File**: `_shared/src/services/claim-broadcast/staging-broadcaster.ts:29`

**Symptom**: Worker restart wipes the set. Every previously-broadcast tx is "first poll" again → forever unconfirmed.

**Confidence**: high

### BE-58 · S1 · services · `ClaimFinalizationService.finalize` is never called from any scheduled job

**Evidence**: Grep for `claimFinalization.finalize` / `ClaimFinalizationService.finalize` in `_shared/src` returns only the service's own file. No cron job, no router endpoint, no scheduler.

**Symptom**: Orders broadcast via `claim-signing-service.ts` sit in `broadcasted` forever.

**Confidence**: high

### BE-59 · S1 · services · `lockTeamRewardToClaimOrder` returns void, silently fails lock contention

**File**: `_shared/src/repos/team-rewards.ts:104-117`

**Symptom**: The `where status = 'claimable' and claim_order_id is null` can miss rows if contention happens inside the same transaction. Silent failure → the claim order references items that aren't locked → second claim can reference same items → double-claim.

**Confidence**: high

### BE-60 · S1 · services · `PurchaseOrderService.attachTx` splits tx_hash update + transition across two writes

**File**: `_shared/src/services/purchase-order-service.ts:103-115`

**Confidence**: high

### BE-61 · S1 · services · `PurchaseRecoveryService.request` allows recovering any tx hash without on-chain attribution

**File**: `_shared/src/services/purchase-recovery-service.ts:34-51`

**Symptom**: Anyone can submit a recovery for any tx hash. No signature verification, no on-chain lookup at submission time. Attribution depends on downstream resolver which is unclear from this file.

**Confidence**: medium

### BE-62 · S1 · services · String-money compare against literal `'0'`

**File**: `_shared/src/services/purchase-reversal-service.ts:83`

```ts
if (input.debitOffsetAmount !== '0') {
```

**Symptom**: `'0.00'`, `'0.0'`, `'00'` all bypass this check and write a zero-value adjustment row.

**Confidence**: medium

### BE-63 · S1 · services · `ChainEventProcessor.processPending` catch block asserts wrong-direction transition, aborts batch

**File**: `_shared/src/services/chain-event-processor.ts:50-69`

**Confidence**: high

### BE-64 · S1 · services · `ChainEventProcessor.handle` casts payload without validation

**File**: `_shared/src/services/chain-event-processor.ts:73-129`

**Confidence**: high

### BE-65 · S2 · services · `RecomputeService.applyAdjustment` has no transaction around settlement_jobs insert + adjustment loop

**File**: `_shared/src/services/recompute-service.ts:90-156`

**Confidence**: high

### BE-66 · S0 · services · `ReportExportWorkerService.createAndRun` runs synchronously in request thread

**File**: `_shared/src/services/report-export-worker.ts:118-308`

**Symptom**: `limit 10000` SQL + CSV string concatenation inside the request handler. Hundreds of MB per request, blocks worker for seconds. Combined with BE-07 (no rate limit), an admin can DoS the whole API by hammering export.

**Confidence**: high

### BE-67 · S0 · services · `InMemoryBlobStore` — exports lost on every restart, broken on multi-replica

**File**: `_shared/src/services/report-export-worker.ts:55-74`

```ts
export class InMemoryBlobStore implements BlobStore {
  private readonly cache = new Map<string, ExportBlob>();
}

export const defaultBlobStore = new InMemoryBlobStore();
```

**Symptom**: Export blob lives in process memory. Multi-replica deployment: download request hits a different replica → 404. Single-replica: restart wipes everything.

**Confidence**: high

### BE-68 · S2 · services · `DbConfigResolver` cache TTL 60s with no invalidation hook on config writes

**File**: `_shared/src/services/config-resolver-db.ts:67-115`

**Symptom**: Operator creates new config version, immediately triggers settlement → settlement may use the cached (old) config. Settlement is money-touching. See also BE-94 (per-request resolver instance defeats the cache entirely).

**Confidence**: high

### BE-69 · S1 · services · `VestingDerivedHoldingService.getHoldingsAtTime` is a "simple loop"

**File**: `_shared/src/services/holding-service.ts:68-78`

```ts
async getHoldingsAtTime(queries: ReadonlyArray<HoldingQuery>) {
  // Simple loop — batch sizes here are small ... Tune when profiling shows it matters.
  const out: WalletHoldingSnapshot[] = [];
  for (const q of queries) {
    out.push(await this.getHoldingAtTime(q));
  }
  return out;
}
```

**Symptom**: O(n) DB calls. The comment is the N+1 marker.

**Confidence**: high

### BE-70 · S1 · services · `AdminActionGuardService.assertCanCreateConfigVersion` makes `reason` optional

**File**: `_shared/src/services/admin-action-guard.ts:53-61`

**Symptom**: Money-touching config change can be created with no reason. Audit log has no `change_note`.

**Confidence**: high

### BE-71 · S2 · services · `UserAccessPolicyService.resolveForWallet` throws `NOT_FOUND` for unknown wallets

**File**: `_shared/src/services/user-access-policy.ts:29-41`

**Symptom**: Wrong status code (should be 401 / 403).

**Confidence**: medium

---

## Section 7 — Repos

### BE-72 · S1 · repos · `listVestingLotsByWallet` and `listPurchasesByWallet` have no `limit`

**Files**: `_shared/src/repos/vesting-lots.ts:79-89`, `purchases.ts:168-178`

**Confidence**: high

### BE-73 · S1 · repos · `listConfigVersionsForKey` returns all versions ever

**File**: `_shared/src/repos/config-versions.ts:74-85`

**Confidence**: high

### BE-74 · S0 · repos · `releaseTeamRewardLock` keyed by `claim_order_id` only

**File**: `_shared/src/repos/team-rewards.ts:119-130`

**Symptom**: Status-filter `where ... and status = 'claimable'` is correct for the happy path, but a buggy retry on a `confirmed` order can still reach here, and the filter on `claimable` would block the clear — except an explicit precondition-failure path in the caller would silently ignore the no-op. Combined with BE-75 (no `claim_order_id` double-check on mark-claimed), this is a money-double-pay surface.

**Confidence**: medium

### BE-75 · S1 · repos · `markTeamRewardClaimed` does not check the `claim_order_id` matches

**File**: `_shared/src/repos/team-rewards.ts:132-144`

**Symptom**: Any caller with an item id can mark it claimed. Defensive check missing.

**Confidence**: high

### BE-76 · S2 · repos · `findAuthNonceByValue` query plan not aligned with wallet partition

**Confidence**: low

### BE-77 · S2 · repos · No array-binding helper; future IN-clauses risk string concat

**Confidence**: low

### BE-78 · Positive · repos · No raw SQL string concatenation found in audited repos

**Confidence**: high

---

## Section 8 — Observability

### BE-79 · S0 · obs · `writeAuditLog` failure is uncaught — audit gap on partial failure

**File**: `_shared/src/observability/audit-log.ts:22-34`

**Symptom**: No outbox, no retry, no fail-loud-and-rollback. Audit log insert failure + successful business action = "action with no trail."

**Confidence**: high

### BE-80 · S1 · obs · Logger does not scrub secrets/PII from `context` blob

**File**: `_shared/src/observability/logger.ts:46-75`

```ts
const record = {
  ts: new Date().toISOString(),
  level: l,
  message,
  ...bindings,
  ...(context ?? {}),
};
write(l, JSON.stringify(record));
```

**Symptom**: Anything passed in context (passwords, tokens, signed messages, signatures) is JSON-stringified to stdout. No allow-list, no scrubber.

**Confidence**: high

### BE-81 · S2 · obs · `generateRequestId` uses biased `byte % 36` alphabet mapping

**File**: `_shared/src/observability/request-id.ts:6-17`

**Confidence**: medium

### BE-82 · S2 · obs · No correlation between log request_id and DB audit rows

**Confidence**: high

---

## Section 9 — Router / dispatch

### BE-83 · S0 · router · No request body size limit

**File**: `supabase/functions/api/serve.ts:38-60`

```ts
if (request.method !== 'GET' && request.method !== 'HEAD') {
  const text = await request.text();
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
```

**Symptom**: 1 GB POST body buffers into memory. Memory DoS.

**Confidence**: high

### BE-84 · S0 · router · No CORS headers, no OPTIONS preflight

**File**: `supabase/functions/api/serve.ts:13-15, 38-97`

**Symptom**: `JSON_HEADERS = { 'content-type': 'application/json' }` — no `access-control-allow-*`. Browser cross-origin requests rejected. Preflight falls to `NOT_FOUND`.

**Confidence**: high

### BE-85 · S0 · router · No rate limiting (duplicate of BE-07, router perspective)

**Confidence**: high

### BE-86 · S1 · router · Error handler leaks Postgres error messages verbatim

**Files**: `router.ts:744-748`, `_shared/src/errors/app-error.ts:103-108`

```ts
export function toAppError(err: unknown, fallbackMessage: string): AppError {
  if (err instanceof AppError) return err;
  const message =
    err instanceof Error && err.message ? err.message : fallbackMessage;
  return new AppError('INTERNAL_ERROR', message);
}
```

**Symptom**: Postgres `duplicate key value violates unique constraint "purchase_orders_client_order_id_key"` becomes the user-facing envelope message. Schema info disclosure.

**Confidence**: high

### BE-87 · S2 · router · Route table linear scan per request (~60 entries)

**Confidence**: medium

### BE-88 · S0 · router · Inline burn-status SQL + per-request `new DbConfigResolver()`

**File**: `supabase/functions/api/router.ts:303-324`

```ts
dispatch: async (ctx, _req, _params, session) => {
  const wallet = asUser(session).wallet as WalletAddress;
  const { DbConfigResolver } = await import('@posx/backend-core');
  const configResolver = new DbConfigResolver(ctx.db);
  const depositRow = await ctx.db.queryOne<{ total: string }>(
    `select coalesce(sum(usdt_amount),0)::text as total
       from purchases where wallet_address = $1 and is_reversed = false`,
    [wallet],
  );
  return handleGetBurnStatus(ctx, wallet, configResolver, depositRow?.total ?? '0');
},
```

**Symptom**: (a) Dynamic `await import` in request hot path. (b) Fresh `DbConfigResolver` per request → 60-second cache is useless. (c) Inline SQL duplicates `sumConfirmedDeposit` repo function → two code paths compute the same number, will drift.

**Confidence**: high

### BE-89 · S0 · router · Claim sign re-derive — duplicate of BE-35

**Confidence**: high

### BE-90 · S1 · router · URL params `:wallet` / `:id` cast to typed IDs without validation

**File**: `router.ts:227-244, 447-475`

**Confidence**: high

### BE-91 · S1 · router · `inferErrorStatus` in serve.ts duplicates switch from `AppError.defaultStatus`

**Files**: `serve.ts:99-134`, `app-error.ts:32-79`

**Symptom**: Two switch statements for error-code → HTTP status. They overlap but are not identical. Drift on new error codes.

**Confidence**: high

### BE-92 · S1 · router · `dispatchRoute` does not log unmatched routes

**File**: `router.ts:744`

**Symptom**: Can't distinguish "broken client" from "attacker probing" without log line on 404.

**Confidence**: high

### BE-93 · S2 · context · Module-level `cachedClient` never reset on cold restart, no health check

**File**: `supabase/functions/api/context.ts:40-52`

**Confidence**: medium

### BE-94 · S2 · context · Services constructed per-request — stateful cache (DbConfigResolver) is theater

**File**: `supabase/functions/api/context.ts:68-149`

**Symptom**: `buildHandlerContext` creates a new `DbConfigResolver` per request → the 60-second cache never spans requests. Settlement runs get cold cache every time.

**Confidence**: high

---

## Top 10 worst backend items

1. **BE-35 + BE-36 + BE-89** — Claim signing empty-message. Money path broken by construction.
2. **BE-49 + BE-51 + BE-52** — Settlement has no transaction / idempotency / lock. Double-trigger = double payout.
3. **BE-56 + BE-58** — No real broadcaster, no finalization cron. No real on-chain payouts.
4. **BE-12 + BE-15 + BE-31 + BE-32 + BE-39** — Multiple handlers ship placeholder data as truth.
5. **BE-22 + BE-79** — Audit log + business action not atomic.
6. **BE-07 + BE-08 + BE-25** — Zero rate limit / lockout / admin-auth audit.
7. **BE-66 + BE-67** — Report export sync in-request, in-memory blob store.
8. **BE-83 + BE-84 + BE-86** — No body size limit, no CORS, error messages leak Postgres details.
9. **BE-50 + BE-69 + BE-94** — Settlement perf O(users × lines) with dead config cache.
10. **BE-19 + BE-20** — Recompute apply takes empty diffs, audits as success, writes nothing.
