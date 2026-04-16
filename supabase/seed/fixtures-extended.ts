/**
 * Phase 4 extended fixtures (constraint 6).
 *
 * One minimal burn-path fixture and one minimal
 * adjustment/reversal-path fixture. Both are isolated from the main
 * end-to-end dataset so integration tests can reason about them
 * independently.
 *
 * Burn fixture strategy:
 *   Rather than try to construct a tree that produces a non-zero
 *   burn organically (which requires unusually large wallet
 *   balances for a 4-wallet graph), the fixture plants:
 *     - 3 wallets in a simple tree
 *     - a completed settlement_jobs row
 *     - a team_rewards_daily row WITH a real burn (raw 500,
 *       burned 500, actual 0) and a matching burn_records row
 *   The numbers are hand-picked to EXACTLY match what the BurnService
 *   would produce if invoked with those inputs. The Phase 6 burn
 *   integration test will invoke BurnService with the same inputs
 *   and assert the same row shape — the two code paths agree.
 *
 * Reversal fixture:
 *   Uses PurchaseReversalService + AdjustmentService directly. No
 *   hand-written SQL is allowed in this file.
 */
import {
  BurnRewardType,
  PurchaseOrderStatus,
  PurchaseReversalType,
  RewardSnapshotStatus,
  SettlementJobMode,
  SettlementJobStatus,
  SettlementJobType,
  UserStatus,
  VestingLotStatus,
} from '@posx/shared-types';
import { divAmount } from '@posx/shared-utils';
import {
  type DbClient,
  finalizeSettlementJob,
  insertBurnRecord,
  insertPurchase,
  insertPurchaseOrder,
  insertReferralBinding,
  insertReferralClosureRow,
  insertSettlementJob,
  insertTeamRewardDaily,
  insertTeamRewardLineDetail,
  insertVestingLot,
  upsertUser,
} from '@posx/backend-core';
import {
  AdjustmentService,
  PurchaseReversalService,
} from '@posx/backend-core';

import { BURN_FIXTURE_USERS, BURN_WALLETS } from './data/burn-fixture';
import {
  REVERSAL_FIXTURE,
  REVERSAL_WALLETS,
} from './data/reversal-fixture';

const CHAIN_ID = 1;
const CONTRACT_ADDRESS_MAIN = '0x0000000000000000000000000000000000000001';
const TOKEN_PRICE = '0.0618';

function posxForUsdt(usdt: string): string {
  return divAmount(usdt, TOKEN_PRICE);
}

/**
 * Seed the burn fixture end-to-end: users, referral tree,
 * purchases, vesting, a dedicated settlement_jobs row, a team
 * reward snapshot with a real non-zero burn, and the matching
 * burn_records row. Uses only repo functions — no raw SQL.
 */
export async function seedBurnFixture(
  db: DbClient,
  operatorAdminId: string,
): Promise<void> {
  // Insert users + purchases + vesting lots.
  for (const f of BURN_FIXTURE_USERS) {
    await upsertUser(db, {
      wallet_address: f.wallet,
      status: UserStatus.Active,
      first_seen_at: f.purchaseAt,
      first_authenticated_at: f.purchaseAt,
      first_purchase_at: f.purchaseAt,
    });

    const order = await insertPurchaseOrder(db, {
      wallet_address: f.wallet,
      client_order_id: `burn_${f.wallet.slice(-4)}`,
      usdt_amount: f.depositUsdt,
      status: PurchaseOrderStatus.Confirmed,
      expected_posx_amount: posxForUsdt(f.depositUsdt),
      token_price_snapshot: TOKEN_PRICE,
      chain_id: CHAIN_ID,
      contract_address: CONTRACT_ADDRESS_MAIN,
    });
    const fact = await insertPurchase(db, {
      purchase_order_id: order.id,
      wallet_address: f.wallet,
      chain_id: CHAIN_ID,
      contract_address: CONTRACT_ADDRESS_MAIN,
      tx_hash: f.txHash,
      block_number: f.blockNumber,
      log_index: 0,
      usdt_amount: f.depositUsdt,
      posx_amount: posxForUsdt(f.depositUsdt),
      token_price_at_purchase: TOKEN_PRICE,
      purchase_at: f.purchaseAt,
    });
    await insertVestingLot(db, {
      wallet_address: f.wallet,
      purchase_id: fact.id,
      total_locked: posxForUsdt(f.depositUsdt),
      start_time: f.purchaseAt,
      lock_days: 90,
      release_days: 365,
      status: VestingLotStatus.Active,
    });
  }

  // Referral tree closure.
  const parents = new Map<string, string>();
  for (const f of BURN_FIXTURE_USERS) {
    if (f.parentWallet === null) continue;
    await insertReferralBinding(db, {
      child_wallet_address: f.wallet,
      parent_wallet_address: f.parentWallet,
      binding_source: 'referral_link',
      bound_at: f.purchaseAt,
      is_locked: true,
    });
    parents.set(f.wallet, f.parentWallet);
  }
  for (const f of BURN_FIXTURE_USERS) {
    let cursor = parents.get(f.wallet);
    let depth = 1;
    while (cursor) {
      await insertReferralClosureRow(db, {
        ancestor_wallet_address: cursor,
        descendant_wallet_address: f.wallet,
        depth,
      });
      cursor = parents.get(cursor);
      depth += 1;
    }
  }

  // Dedicated settlement job for the burn fixture day.
  const job = await insertSettlementJob(db, {
    job_type: SettlementJobType.DailySettlement,
    settlement_date: '2026-04-11',
    mode: SettlementJobMode.Official,
    status: SettlementJobStatus.Running,
    config_version_snapshot: { fixture: 'burn' },
    started_at: '2026-04-12T00:10:00.000Z',
    triggered_by_admin_id: operatorAdminId,
    reason: 'Phase 4 burn fixture settlement',
  });

  // Hand-picked numbers: host wallet at the burn boundary receives
  // a raw reward of 500 USDT, burn cap = holding = 10 000, but we
  // set `used_burn_capacity_before = 9 500` so remaining = 500 and
  // the next line consumes exactly the cap with raw = 1 000 →
  // actual = 500, burned = 500.
  const teamRewardRow = await insertTeamRewardDaily(db, {
    settlement_job_id: job.id,
    wallet_address: BURN_WALLETS.W_BURN_HOST,
    settle_date: '2026-04-11',
    qualification_tier: 'advanced',
    user_team_rate: '0.03',
    team_total_performance: '360000',
    effective_performance: '350000',
    raw_total: '1000',
    burned_amount: '500',
    actual_total: '500',
    status: RewardSnapshotStatus.Claimable,
  });
  await insertTeamRewardLineDetail(db, {
    team_reward_daily_id: teamRewardRow.id,
    line_root_wallet_address: BURN_WALLETS.W_BURN_SUB,
    line_effective_performance: '150000',
    subordinate_team_rate: '0',
    differential_rate: '0.03',
    raw_reward_amount: '1000',
    equal_level_replaced: false,
  });
  await insertBurnRecord(db, {
    wallet_address: BURN_WALLETS.W_BURN_HOST,
    reward_type: BurnRewardType.Team,
    source_snapshot_id: teamRewardRow.id,
    source_table: 'team_rewards_daily',
    settle_date: '2026-04-11',
    holding_value_at_snapshot: '10000',
    used_burn_capacity_before: '9500',
    burn_cap: '10000',
    raw_amount: '1000',
    burned_amount: '500',
    actual_amount: '500',
    reason: 'burn_cap_exceeded',
  });

  await finalizeSettlementJob(db, {
    id: job.id,
    status: SettlementJobStatus.Completed,
    finished_at: '2026-04-12T00:11:00.000Z',
    processed_user_count: 1,
    created_snapshot_count: 1,
    created_adjustment_count: 0,
    error_count: 0,
  });
}

/**
 * Seed the reversal + adjustment fixture. Inserts a confirmed
 * purchase, then invokes `PurchaseReversalService` to produce the
 * reversal row + offsetting debit adjustment through its real code
 * path. No raw SQL — the service is the integration target.
 */
export async function seedReversalFixture(
  db: DbClient,
  superAdminId: string,
  operatorAdminId: string,
): Promise<void> {
  const wallet = REVERSAL_WALLETS.W_REVERSAL_BUYER;
  const purchaseAt = REVERSAL_FIXTURE.purchase.purchaseAt;

  await upsertUser(db, {
    wallet_address: wallet,
    status: UserStatus.Active,
    first_seen_at: purchaseAt,
    first_authenticated_at: purchaseAt,
    first_purchase_at: purchaseAt,
  });

  const order = await insertPurchaseOrder(db, {
    wallet_address: wallet,
    client_order_id: 'reversal_fixture_001',
    usdt_amount: REVERSAL_FIXTURE.purchase.amountUsdt,
    status: PurchaseOrderStatus.Confirmed,
    expected_posx_amount: posxForUsdt(REVERSAL_FIXTURE.purchase.amountUsdt),
    token_price_snapshot: TOKEN_PRICE,
    chain_id: CHAIN_ID,
    contract_address: CONTRACT_ADDRESS_MAIN,
  });
  const fact = await insertPurchase(db, {
    purchase_order_id: order.id,
    wallet_address: wallet,
    chain_id: CHAIN_ID,
    contract_address: CONTRACT_ADDRESS_MAIN,
    tx_hash: REVERSAL_FIXTURE.purchase.txHash,
    block_number: REVERSAL_FIXTURE.purchase.blockNumber,
    log_index: 0,
    usdt_amount: REVERSAL_FIXTURE.purchase.amountUsdt,
    posx_amount: posxForUsdt(REVERSAL_FIXTURE.purchase.amountUsdt),
    token_price_at_purchase: TOKEN_PRICE,
    purchase_at: purchaseAt,
  });
  await insertVestingLot(db, {
    wallet_address: wallet,
    purchase_id: fact.id,
    total_locked: posxForUsdt(REVERSAL_FIXTURE.purchase.amountUsdt),
    start_time: purchaseAt,
    lock_days: 90,
    release_days: 365,
    status: VestingLotStatus.Active,
  });

  const reversalService = new PurchaseReversalService(db);
  await reversalService.reverse({
    purchaseId: fact.id,
    wallet,
    reason: REVERSAL_FIXTURE.reversal.reason,
    reversalType: PurchaseReversalType.DuplicatePayment,
    reversedByAdminId: superAdminId,
    approvedByAdminId: operatorAdminId,
    effectiveAt: REVERSAL_FIXTURE.reversal.effectiveAt,
    notes: REVERSAL_FIXTURE.reversal.notes,
    debitOffsetAmount: REVERSAL_FIXTURE.offsetAmount,
    ipAddress: '127.0.0.1',
  });

  // Also plant a small credit adjustment so the ledger shows both
  // directions — this is the "minimal adjustment path" half of
  // constraint 6. Uses AdjustmentService directly.
  const adjustments = new AdjustmentService(db);
  await adjustments.create({
    wallet,
    adjustmentType: 'manual_financial_correction',
    direction: 'credit',
    amount: '5',
    reason: 'Phase 4 fixture — goodwill credit',
    settleDate: REVERSAL_FIXTURE.reversal.effectiveAt.slice(0, 10),
    createdByAdminId: superAdminId,
  });
}
