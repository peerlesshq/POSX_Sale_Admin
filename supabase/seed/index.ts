/**
 * Seed runner — minimal end-to-end business dataset.
 *
 * The goal of Phase 3 seed (constraint 4) is to get ONE complete
 * happy-path dataset through every object type in the schema:
 *
 *   admin accounts → config versions → chain sync state → users →
 *   referral bindings + closure → purchase orders + purchases →
 *   vesting lots → direct rewards → settlement job → team reward
 *   snapshots (incl. line details) → equal-level snapshot → claim
 *   order + items + record → user_reward_summary rebuilt →
 *   admin logs + job runs
 *
 * Broader fixture coverage (burn scenarios, restricted users, pending
 * purchase states, failed claims, multiple settlement days, etc.)
 * belongs in Phase 6.
 *
 * RULE (from constraint 7): derived summaries are NEVER hand-seeded.
 * `user_reward_summary` is populated at the end of this script via
 * `rebuildUserRewardSummaryAll` — the same function Phase 4 settlement
 * will invoke.
 */
import { randomUUID } from 'node:crypto';

import { hashSync } from 'bcrypt';

import {
  InMemoryConfigResolver,
  buildDefaultConfigRows,
  loadServerEnv,
  normalizeEqualLevelPolicy,
} from '@posx/config';
import { computeLineDifferential, evaluateEqualLevel } from '@posx/domain-rules';
import {
  AdminRole,
  type ApplyScope,
  BindingSource,
  ClaimItemRewardType,
  ClaimItemSourceTable,
  ClaimOrderScope,
  ClaimOrderStatus,
  ClaimRecordStatus,
  ConfigGroup,
  JobRunStatus,
  PurchaseOrderStatus,
  RewardSnapshotStatus,
  SettlementJobMode,
  SettlementJobStatus,
  SettlementJobType,
  UserStatus,
  VestingLotStatus,
} from '@posx/shared-types';
import { addAmount, divAmount } from '@posx/shared-utils';
import {
  type DbClient,
  finalizeSettlementJob,
  insertAdminLog,
  insertAdminUser,
  insertClaimOrder,
  insertClaimOrderItem,
  insertClaimRecord,
  insertConfigVersion,
  insertDirectReward,
  insertEqualLevelReward,
  insertJobRun,
  insertPurchase,
  insertPurchaseOrder,
  insertReferralBinding,
  insertReferralClosureRow,
  insertSettlementJob,
  insertTeamRewardDaily,
  insertTeamRewardLineDetail,
  insertVestingLot,
  lockTeamRewardToClaimOrder,
  markTeamRewardClaimed,
  rebuildUserRewardSummaryAll,
  updateClaimOrderStatus,
  upsertUser,
} from '@posx/backend-core';

import {
  CHAIN_ID,
  CONTRACT_ADDRESS_MAIN,
  SEED_USERS,
  SETTLEMENT_DATE,
  SETTLEMENT_FINISHED_AT,
  SETTLEMENT_STARTED_AT,
  TOKEN_PRICE,
} from './data/fixtures';
import { SEED_WALLETS } from './data/wallets';
import { seedBurnFixture, seedReversalFixture } from './fixtures-extended';
import { isProductionLike, seedPersonaFixtures } from './persona-fixture';

// ---------- small helpers ----------

function nowIsoStepper(start: string): () => string {
  let ms = new Date(start).getTime();
  return () => {
    ms += 1000;
    return new Date(ms).toISOString();
  };
}

function posxForUsdt(usdt: string, price: string): string {
  return divAmount(usdt, price);
}

// ---------- individual seed steps ----------

async function seedAdmins(
  db: DbClient,
): Promise<{ superId: string; operatorId: string; viewerId: string }> {
  // Passwords MUST match the dev-login shortcuts in
  // `apps/admin-web/src/pages/LoginPage.tsx`. All three exceed the
  // 12-char minimum enforced by admin-action-guard.
  const superHash = hashSync('posx-local-super-admin-12', 12);
  const opHash = hashSync('posx-local-operator-12', 12);
  const viewerHash = hashSync('posx-local-viewer-12', 12);

  const sup = await insertAdminUser(db, {
    email: 'superadmin@posx.local',
    password_hash: superHash,
    role: AdminRole.SuperAdmin,
    name: 'Seed Super Admin',
    status: 'active',
  });
  const op = await insertAdminUser(db, {
    email: 'operator@posx.local',
    password_hash: opHash,
    role: AdminRole.Operator,
    name: 'Seed Operator',
    status: 'active',
  });
  const viewer = await insertAdminUser(db, {
    email: 'viewer@posx.local',
    password_hash: viewerHash,
    role: AdminRole.Viewer,
    name: 'Seed Viewer',
    status: 'active',
  });

  await insertAdminLog(db, {
    admin_user_id: sup.id,
    action: 'seed_bootstrap',
    target_type: 'system',
    detail: {
      note: 'created super_admin + operator + viewer seed accounts',
      emails: ['superadmin@posx.local', 'operator@posx.local', 'viewer@posx.local'],
    },
    ip_address: '127.0.0.1',
  });

  return { superId: sup.id, operatorId: op.id, viewerId: viewer.id };
}

async function seedConfigVersions(
  db: DbClient,
  createdByAdminId: string,
): Promise<void> {
  const defaults = buildDefaultConfigRows({
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    idFactory: () => randomUUID(),
  });
  for (const row of defaults) {
    await insertConfigVersion(db, {
      id: row.id,
      config_group: row.config_group,
      config_key: row.config_key,
      version_no: row.version_no,
      config_value: row.config_value as Record<string, unknown>,
      effective_from: row.effective_from,
      apply_scope: row.apply_scope as ApplyScope,
      status: row.status,
      description: row.description,
      created_by_admin_id: createdByAdminId,
    });
  }
}

async function seedUsersAndPurchases(db: DbClient): Promise<void> {
  for (const fixture of SEED_USERS) {
    await upsertUser(db, {
      wallet_address: fixture.wallet,
      status: UserStatus.Active,
      first_seen_at: fixture.purchase_at,
      first_authenticated_at: fixture.purchase_at,
      first_purchase_at: fixture.purchase_at,
    });
  }

  for (const fixture of SEED_USERS) {
    const order = await insertPurchaseOrder(db, {
      wallet_address: fixture.wallet,
      client_order_id: `seed_${fixture.wallet.slice(-4)}`,
      usdt_amount: fixture.cumulative_deposit,
      status: PurchaseOrderStatus.Confirmed,
      expected_posx_amount: posxForUsdt(fixture.cumulative_deposit, TOKEN_PRICE),
      token_price_snapshot: TOKEN_PRICE,
      chain_id: CHAIN_ID,
      contract_address: CONTRACT_ADDRESS_MAIN,
    });

    const fact = await insertPurchase(db, {
      purchase_order_id: order.id,
      wallet_address: fixture.wallet,
      chain_id: CHAIN_ID,
      contract_address: CONTRACT_ADDRESS_MAIN,
      tx_hash: fixture.purchase_tx_hash,
      block_number: fixture.block_number,
      log_index: 0,
      usdt_amount: fixture.cumulative_deposit,
      posx_amount: posxForUsdt(fixture.cumulative_deposit, TOKEN_PRICE),
      token_price_at_purchase: TOKEN_PRICE,
      purchase_at: fixture.purchase_at,
    });

    // Vesting lot: lot-based model, 90-day lock + 365-day linear
    // release. We seed the "just locked" state — no withdrawals.
    await insertVestingLot(db, {
      wallet_address: fixture.wallet,
      purchase_id: fact.id,
      total_locked: posxForUsdt(fixture.cumulative_deposit, TOKEN_PRICE),
      start_time: fixture.purchase_at,
      lock_days: 90,
      release_days: 365,
      status: VestingLotStatus.Active,
    });
  }
}

async function seedReferralTree(db: DbClient): Promise<void> {
  const parentOf = new Map<string, string>();
  for (const fixture of SEED_USERS) {
    if (fixture.parent_wallet === null) continue;

    await insertReferralBinding(db, {
      child_wallet_address: fixture.wallet,
      parent_wallet_address: fixture.parent_wallet,
      binding_source: BindingSource.ReferralLink,
      bound_at: fixture.purchase_at,
      is_locked: true,
    });
    parentOf.set(fixture.wallet, fixture.parent_wallet);
  }

  // Closure: for each descendant, walk up to the root emitting
  // `(ancestor, descendant, depth)` rows.
  for (const fixture of SEED_USERS) {
    let cursor = parentOf.get(fixture.wallet);
    let depth = 1;
    while (cursor) {
      await insertReferralClosureRow(db, {
        ancestor_wallet_address: cursor,
        descendant_wallet_address: fixture.wallet,
        depth,
      });
      cursor = parentOf.get(cursor);
      depth += 1;
    }
  }
}

async function seedDirectRewards(db: DbClient): Promise<void> {
  // See the dataset comment in `./data/fixtures.ts` for the numbers.
  const entries = [
    {
      from: SEED_WALLETS.W_A,
      to: SEED_WALLETS.W_ROOT,
      amount: '22500',
      rate: '0.15',
      tx: '0xcccc000000000000000000000000000000000000000000000000000000000001',
      block: 20_000_011,
      purchaseIndex: 1,
      at: '2026-03-20T10:05:00.000Z',
    },
    {
      from: SEED_WALLETS.W_B,
      to: SEED_WALLETS.W_A,
      amount: '22500',
      rate: '0.15',
      tx: '0xcccc000000000000000000000000000000000000000000000000000000000002',
      block: 20_000_021,
      purchaseIndex: 2,
      at: '2026-03-25T10:05:00.000Z',
    },
    {
      from: SEED_WALLETS.W_C,
      to: SEED_WALLETS.W_A,
      amount: '3000',
      rate: '0.15',
      tx: '0xcccc000000000000000000000000000000000000000000000000000000000003',
      block: 20_000_031,
      purchaseIndex: 3,
      at: '2026-03-27T10:05:00.000Z',
    },
    {
      from: SEED_WALLETS.W_D,
      to: SEED_WALLETS.W_C,
      amount: '500',
      rate: '0.10',
      tx: '0xcccc000000000000000000000000000000000000000000000000000000000004',
      block: 20_000_041,
      purchaseIndex: 4,
      at: '2026-03-30T10:05:00.000Z',
    },
  ] as const;

  for (const e of entries) {
    const sourceFixture = SEED_USERS[e.purchaseIndex];
    if (!sourceFixture) continue;
    await insertDirectReward(db, {
      from_wallet_address: e.from,
      to_wallet_address: e.to,
      chain_id: CHAIN_ID,
      tx_hash: e.tx,
      block_number: e.block,
      reward_rate: e.rate,
      purchase_amount: sourceFixture.cumulative_deposit,
      reward_amount: e.amount,
      rewarded_at: e.at,
    });
  }
}

/**
 * Runs settlement for the minimal dataset, using domain-rules to
 * compute the reward amounts. Returns the team-reward id used by
 * the seed claim step.
 */
async function seedSettlement(
  db: DbClient,
  operatorId: string,
): Promise<{ claimableTeamRewardIdForA: string }> {
  const defaultRows = buildDefaultConfigRows();
  const resolver = new InMemoryConfigResolver(defaultRows);
  const equalLevelRow = await resolver.resolve({
    group: ConfigGroup.EqualLevelRules,
    key: 'equal_level_policy',
    context: {
      evaluationTime: SETTLEMENT_STARTED_AT,
      settlementDate: SETTLEMENT_DATE,
    },
  });
  if (!equalLevelRow) {
    throw new Error('seed: could not resolve equal_level_policy');
  }
  const equalLevelPolicy = normalizeEqualLevelPolicy(equalLevelRow.config_value);

  const configSnapshot = Object.fromEntries(
    defaultRows.map((r) => [`${r.config_group}.${r.config_key}`, r.version_no]),
  );

  const job = await insertSettlementJob(db, {
    job_type: SettlementJobType.DailySettlement,
    settlement_date: SETTLEMENT_DATE,
    mode: SettlementJobMode.Official,
    status: SettlementJobStatus.Running,
    config_version_snapshot: configSnapshot,
    started_at: SETTLEMENT_STARTED_AT,
    triggered_by_admin_id: operatorId,
    reason: 'seed minimal end-to-end dataset',
  });

  // ---- W_ROOT settlement ----
  // Line W_A: effective performance 175 000. Equal-level fires
  // because rates match (0.03 == 0.03) and subordinate team perf
  // 175 000 ≥ 100 000 threshold.
  const rootEqualLevel = evaluateEqualLevel({
    user_team_rate: '0.03',
    subordinate_team_rate: '0.03',
    subordinate_team_total_performance: '175000',
    user_team_reward_qualified: true,
    line_active: true,
    line_effective_performance: '175000',
    policy: equalLevelPolicy,
  });

  const rootTeamRow = await insertTeamRewardDaily(db, {
    settlement_job_id: job.id,
    wallet_address: SEED_WALLETS.W_ROOT,
    settle_date: SETTLEMENT_DATE,
    qualification_tier: 'elite',
    user_team_rate: '0.03',
    team_total_performance: '325000',
    effective_performance: '175000',
    raw_total: '0',
    burned_amount: '0',
    actual_total: '0',
    status: RewardSnapshotStatus.Claimable,
  });
  await insertTeamRewardLineDetail(db, {
    team_reward_daily_id: rootTeamRow.id,
    line_root_wallet_address: SEED_WALLETS.W_A,
    line_effective_performance: '175000',
    subordinate_team_rate: '0.03',
    differential_rate: '0',
    raw_reward_amount: '0',
    equal_level_replaced: true,
  });
  await insertEqualLevelReward(db, {
    settlement_job_id: job.id,
    wallet_address: SEED_WALLETS.W_ROOT,
    line_root_wallet_address: SEED_WALLETS.W_A,
    settle_date: SETTLEMENT_DATE,
    equal_level_rate: equalLevelPolicy.equal_level_rate,
    subordinate_team_total_performance: '175000',
    line_effective_performance: '175000',
    raw_amount: rootEqualLevel.raw_reward_amount,
    burned_amount: '0',
    actual_amount: rootEqualLevel.raw_reward_amount,
    status: RewardSnapshotStatus.Claimable,
  });

  // ---- W_A settlement ----
  // Two lines: W_B (raw 0) and W_C (raw 100).
  const lineA_B = computeLineDifferential({
    user_team_rate: '0.03',
    max_team_rate: '0.15',
    line: {
      line_root_wallet_address: SEED_WALLETS.W_B,
      line_effective_performance: '0',
      subordinate_team_rate: '0',
    },
  });
  const lineA_C = computeLineDifferential({
    user_team_rate: '0.03',
    max_team_rate: '0.15',
    line: {
      line_root_wallet_address: SEED_WALLETS.W_C,
      line_effective_performance: '5000',
      subordinate_team_rate: '0.01',
    },
  });
  const aRawTotal = addAmount(lineA_B.raw_reward_amount, lineA_C.raw_reward_amount);

  const aTeamRow = await insertTeamRewardDaily(db, {
    settlement_job_id: job.id,
    wallet_address: SEED_WALLETS.W_A,
    settle_date: SETTLEMENT_DATE,
    qualification_tier: 'elite',
    user_team_rate: '0.03',
    team_total_performance: '175000',
    effective_performance: '5000',
    raw_total: aRawTotal,
    burned_amount: '0',
    actual_total: aRawTotal,
    status: RewardSnapshotStatus.Claimable,
  });
  await insertTeamRewardLineDetail(db, {
    team_reward_daily_id: aTeamRow.id,
    line_root_wallet_address: SEED_WALLETS.W_B,
    line_effective_performance: '0',
    subordinate_team_rate: '0',
    differential_rate: lineA_B.differential_rate,
    raw_reward_amount: lineA_B.raw_reward_amount,
    equal_level_replaced: false,
  });
  await insertTeamRewardLineDetail(db, {
    team_reward_daily_id: aTeamRow.id,
    line_root_wallet_address: SEED_WALLETS.W_C,
    line_effective_performance: '5000',
    subordinate_team_rate: '0.01',
    differential_rate: lineA_C.differential_rate,
    raw_reward_amount: lineA_C.raw_reward_amount,
    equal_level_replaced: false,
  });

  // Finalize through the repo rather than open-coded SQL so that
  // all state transitions go through one place.
  await finalizeSettlementJob(db, {
    id: job.id,
    status: SettlementJobStatus.Completed,
    finished_at: SETTLEMENT_FINISHED_AT,
    processed_user_count: 2,
    created_snapshot_count: 3,
    created_adjustment_count: 0,
    error_count: 0,
  });

  return { claimableTeamRewardIdForA: aTeamRow.id };
}

async function seedClaim(
  db: DbClient,
  teamRewardIdForA: string,
): Promise<void> {
  const clock = nowIsoStepper('2026-04-13T01:00:00.000Z');

  const order = await insertClaimOrder(db, {
    wallet_address: SEED_WALLETS.W_A,
    client_request_id: 'seed_claim_W_A_001',
    requested_total_amount: '100',
    claim_scope: ClaimOrderScope.ClaimAll,
    status: ClaimOrderStatus.PendingSignature,
  });

  await insertClaimOrderItem(db, {
    claim_order_id: order.id,
    reward_type: ClaimItemRewardType.Team,
    source_table: ClaimItemSourceTable.TeamRewardsDaily,
    source_snapshot_id: teamRewardIdForA,
    amount: '100',
  });
  await lockTeamRewardToClaimOrder(db, teamRewardIdForA, order.id);

  const signedAt = clock();
  await updateClaimOrderStatus(db, order.id, ClaimOrderStatus.Queued, {
    signed_at: signedAt,
    signed_message: 'POSX Claim | wallet:W_A | order:seed_claim_W_A_001 | amount:100',
    queued_at: signedAt,
  });

  const broadcastAt = clock();
  const broadcastTx =
    '0xdddd000000000000000000000000000000000000000000000000000000000001';
  await updateClaimOrderStatus(db, order.id, ClaimOrderStatus.Broadcasted, {
    broadcasted_at: broadcastAt,
    broadcast_tx_hash: broadcastTx,
  });

  const confirmedAt = clock();
  await updateClaimOrderStatus(db, order.id, ClaimOrderStatus.Confirmed, {
    confirmed_at: confirmedAt,
  });
  await markTeamRewardClaimed(db, teamRewardIdForA, broadcastTx);
  await insertClaimRecord(db, {
    claim_order_id: order.id,
    wallet_address: SEED_WALLETS.W_A,
    amount: '100',
    tx_hash: broadcastTx,
    status: ClaimRecordStatus.Confirmed,
    recorded_at: confirmedAt,
  });
}

async function seedJobRuns(db: DbClient): Promise<void> {
  await insertJobRun(db, {
    job_name: 'daily_settlement',
    job_key: SETTLEMENT_DATE,
    status: JobRunStatus.Completed,
    started_at: SETTLEMENT_STARTED_AT,
    finished_at: SETTLEMENT_FINISHED_AT,
    rows_scanned: 5,
    rows_processed: 2,
    rows_failed: 0,
    detail: { mode: 'official', settlement_date: SETTLEMENT_DATE },
  });
  await insertJobRun(db, {
    job_name: 'rebuild_user_reward_summary',
    job_key: 'seed',
    status: JobRunStatus.Completed,
    started_at: SETTLEMENT_FINISHED_AT,
    finished_at: SETTLEMENT_FINISHED_AT,
    rows_scanned: 5,
    rows_processed: 5,
    rows_failed: 0,
  });
}

// ---------- entrypoint ----------

export interface RunSeedOptions {
  /**
   * When true, seed the Phase-6 persona fixtures on top of the
   * minimal dataset. Must only be used for local/staging. The
   * entrypoint reads PHASE6_PERSONAS from the environment and
   * refuses to set this to true when the DB URL looks production-like.
   */
  readonly includePersonas?: boolean;
}

export async function runSeed(
  db: DbClient,
  options: RunSeedOptions = {},
): Promise<void> {
  // Touch the env loader so missing variables fail this script
  // loudly rather than at some later repo call.
  const env = loadServerEnv(process.env);

  const includePersonas = options.includePersonas ?? false;
  if (includePersonas && isProductionLike(env.SUPABASE_DB_URL)) {
    throw new Error(
      'persona fixtures refused: SUPABASE_DB_URL looks production-like. ' +
        'Persona seeds are local/staging only.',
    );
  }

  const adminIds = await db.transaction(async (tx) => {
    const ids = await seedAdmins(tx);
    await seedConfigVersions(tx, ids.superId);
    await seedUsersAndPurchases(tx);
    await seedReferralTree(tx);
    await seedDirectRewards(tx);
    const { claimableTeamRewardIdForA } = await seedSettlement(tx, ids.operatorId);
    await seedClaim(tx, claimableTeamRewardIdForA);
    await seedJobRuns(tx);
    return ids;
  });

  // Phase 4 constraint 6: extended fixtures. Run AFTER the main
  // happy-path transaction commits so an integration test can look
  // at either dataset independently.
  await db.transaction(async (tx) => {
    await seedBurnFixture(tx, adminIds.operatorId);
    await seedReversalFixture(tx, adminIds.superId, adminIds.operatorId);
  });

  // Phase 6 constraint: persona fixtures. Same isolation strategy —
  // separate transaction, after the main dataset commits.
  if (includePersonas) {
    await db.transaction(async (tx) => {
      await seedPersonaFixtures(tx);
    });
  }

  // Summary rebuild happens OUTSIDE the transaction to mirror the
  // production pattern where the rebuilder runs after facts commit.
  await rebuildUserRewardSummaryAll(db);
}
