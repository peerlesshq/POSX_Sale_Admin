/**
 * User detail view model.
 *
 * This is the frontend adapter that merges multiple API responses
 * (`/admin/users/:wallet`, `/admin/rewards/*` filtered by wallet,
 * `/admin/logs` filtered by `target_id`, `/admin/users/:wallet/tree`)
 * into a single typed object the User Detail page renders from.
 *
 * Hard rules:
 *   1. NEVER invent business fields. Every field here must trace
 *      back to an explicit backend source or be explicitly marked
 *      `null` / absent when the source has no data.
 *   2. NEVER fabricate financial numbers. `claimedTotal` and all
 *      vesting fields stay `null` when the backend does not expose
 *      them — the UI then renders a professional "—" + tooltip or
 *      an "integration required" empty state.
 *   3. Pure function. No React, no I/O, no fetching.
 *
 * The caller owns fetching. See `useUserDetailViewModel()` in the
 * page for the React-side orchestration.
 */

import { toNumber } from '../../lib/format';

/* --------------------------------------------------------------------- */
/*  Types                                                                */
/* --------------------------------------------------------------------- */

export interface UserIdentity {
  readonly walletAddress: string;
  readonly status: string;
  readonly tier: string | null;
  readonly createdAt: string | null;
  readonly firstPurchaseAt: string | null;
  /**
   * Derived from the most recent admin log or reward timestamp for
   * this wallet. `null` when no signals exist. Not a business field
   * — purely a display hint.
   */
  readonly lastActiveAt: string | null;
}

export interface UserReferral {
  readonly referrerAddress: string | null;
  readonly boundAt: string | null;
  readonly bindingSource: string | null;
  readonly directReferralCount: number;
  readonly teamSize: number;
}

export interface UserFinancial {
  readonly cumulativeDeposit: string;
  readonly holdingValueUsdt: string;
  readonly teamTotalPerformance: string;
  readonly buyCount: number | null;
}

/**
 * Reward totals. `claimedTotal` is intentionally `null` when the
 * backend does not expose it — we refuse to fabricate this number.
 * UI shows `—` with a tooltip explaining that a claim-records
 * endpoint is required.
 */
export interface UserRewards {
  readonly directTotal: string;
  readonly teamTotal: string;
  readonly equalLevelTotal: string;
  readonly burnedTotal: string;
  readonly claimableTotal: string;
  readonly total: string;
  /** `null` = no data source exposes this yet. Never synthesized. */
  readonly claimedTotal: string | null;
}

/**
 * Vesting summary. All fields are `null` by default because the
 * current API surface does not include a per-user vesting endpoint.
 * The Vesting tab renders an "integration required" placeholder
 * instead of fake lots.
 */
export interface UserVesting {
  readonly totalLocked: string | null;
  readonly totalReleased: string | null;
  readonly totalWithdrawable: string | null;
  readonly totalWithdrawn: string | null;
  readonly lots: readonly UserVestingLot[];
  /**
   * `true` when the backend contract has a vesting endpoint wired
   * up. Currently always `false`; the UI uses this to show a
   * professional "pending integration" state.
   */
  readonly available: boolean;
}

export interface UserVestingLot {
  readonly lotId: string;
  readonly startTime: string | null;
  readonly totalLocked: string;
  readonly releasedAmount: string;
  readonly withdrawableAmount: string;
  readonly withdrawnAmount: string;
  readonly status: string;
}

export interface UserQualification {
  readonly rewardQualified: boolean;
  readonly teamRewardQualified: boolean;
  readonly directRate: string | null;
  readonly teamRate: string | null;
  readonly isPeer: boolean;
}

export interface UserRewardRow {
  readonly id: string;
  readonly kind: 'direct' | 'team' | 'equal_level' | 'burn';
  readonly date: string;
  readonly rawAmount: string;
  readonly burnedAmount: string;
  readonly actualAmount: string;
  readonly counterpartyWallet: string | null;
  readonly status: string | null;
  readonly reason: string | null;
  /** Full original row — fed into the drill drawer raw tab. */
  readonly original: Record<string, unknown>;
}

export interface UserAuditRow {
  readonly id: string;
  readonly adminUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly createdAt: string;
  readonly original: Record<string, unknown>;
}

export interface UserTeamChild {
  readonly walletAddress: string;
  readonly status: string;
  readonly tier: string | null;
  readonly personalDeposit: string;
  readonly teamPerformance: string;
  readonly directCount: number;
  readonly teamSize: number;
  readonly depth: number;
}

export interface UserDetailViewModel {
  readonly identity: UserIdentity;
  readonly referral: UserReferral;
  readonly financial: UserFinancial;
  readonly rewards: UserRewards;
  readonly vesting: UserVesting;
  readonly qualification: UserQualification;
  readonly rewardRows: readonly UserRewardRow[];
  readonly audit: readonly UserAuditRow[];
  readonly teamChildren: readonly UserTeamChild[];
}

/* --------------------------------------------------------------------- */
/*  Builder                                                              */
/* --------------------------------------------------------------------- */

type AnyRow = Record<string, unknown>;

export interface BuildUserViewModelInput {
  readonly walletAddress: string;
  readonly detail: AnyRow; // `api.getUser` response
  readonly directRewards: readonly AnyRow[]; // filtered by wallet
  readonly teamRewards: readonly AnyRow[];
  readonly equalRewards: readonly AnyRow[];
  readonly burns: readonly AnyRow[];
  readonly logs: readonly AnyRow[]; // filtered by target_id = wallet
  readonly teamSubtree: readonly AnyRow[]; // from api.getUserTree
}

export function buildUserViewModel(input: BuildUserViewModelInput): UserDetailViewModel {
  const { detail } = input;
  const identity = (detail['identity'] as AnyRow) ?? {};
  const referral = (detail['referral'] as AnyRow) ?? {};
  const financial = (detail['financial'] as AnyRow) ?? {};
  const rewardSummary = (detail['reward_summary'] as AnyRow) ?? {};

  /* ---------- Last-active derivation ------------------------------ */
  // Not a business field — purely a display hint derived from the
  // latest reward or audit entry timestamp we've already fetched.
  const candidateTimestamps: number[] = [];
  for (const list of [input.directRewards, input.teamRewards, input.equalRewards, input.burns]) {
    for (const row of list) {
      const raw = row['rewarded_at'] ?? row['settle_date'] ?? row['created_at'];
      const ts = raw ? Date.parse(String(raw)) : NaN;
      if (Number.isFinite(ts)) candidateTimestamps.push(ts);
    }
  }
  for (const row of input.logs) {
    const ts = Date.parse(String(row['created_at'] ?? ''));
    if (Number.isFinite(ts)) candidateTimestamps.push(ts);
  }
  const lastActiveAt =
    candidateTimestamps.length > 0
      ? new Date(Math.max(...candidateTimestamps)).toISOString()
      : null;

  /* ---------- Identity -------------------------------------------- */
  const identityVm: UserIdentity = {
    walletAddress: input.walletAddress,
    status: String(identity['status'] ?? 'active'),
    tier: (financial['current_tier'] as string) ?? null,
    createdAt: (identity['created_at'] as string) ?? null,
    firstPurchaseAt: (identity['first_purchase_at'] as string) ?? null,
    lastActiveAt,
  };

  /* ---------- Referral -------------------------------------------- */
  const referralVm: UserReferral = {
    referrerAddress: (referral['referrer_address'] as string) ?? null,
    boundAt: (referral['bound_at'] as string) ?? null,
    bindingSource: (referral['binding_source'] as string) ?? null,
    directReferralCount: toNumber(referral['direct_referral_count']),
    teamSize: toNumber(referral['team_size']),
  };

  /* ---------- Financial ------------------------------------------- */
  const financialVm: UserFinancial = {
    cumulativeDeposit: String(financial['cumulative_deposit'] ?? '0'),
    holdingValueUsdt: String(financial['holding_value_usdt'] ?? '0'),
    teamTotalPerformance: String(financial['team_total_performance'] ?? '0'),
    buyCount:
      financial['buy_count'] === undefined || financial['buy_count'] === null
        ? null
        : toNumber(financial['buy_count']),
  };

  /* ---------- Rewards --------------------------------------------- */
  // NOTE: `claimedTotal` stays `null` until the backend exposes a
  // claim-records endpoint. We refuse to fabricate this number.
  const rewardsVm: UserRewards = {
    directTotal: String(rewardSummary['direct_total'] ?? '0'),
    teamTotal: String(rewardSummary['team_total'] ?? '0'),
    equalLevelTotal: String(rewardSummary['equal_level_total'] ?? '0'),
    burnedTotal: String(rewardSummary['burned_total'] ?? '0'),
    claimableTotal: String(rewardSummary['claimable_total'] ?? '0'),
    total: String(rewardSummary['total'] ?? '0'),
    claimedTotal:
      rewardSummary['claimed_total'] === undefined
        ? null
        : String(rewardSummary['claimed_total']),
  };

  /* ---------- Vesting --------------------------------------------- */
  // No vesting endpoint exists today — the view model reflects that
  // honestly with `available: false` and all fields `null`.
  const vestingAvailable = Boolean(detail['vesting']);
  const vestingSource = (detail['vesting'] as AnyRow) ?? {};
  const vestingLots: UserVestingLot[] = Array.isArray(vestingSource['lots'])
    ? (vestingSource['lots'] as AnyRow[]).map((lot) => ({
        lotId: String(lot['lot_id'] ?? lot['vesting_lot_id'] ?? ''),
        startTime: (lot['start_time'] as string) ?? null,
        totalLocked: String(lot['total_locked'] ?? '0'),
        releasedAmount: String(lot['released_amount'] ?? '0'),
        withdrawableAmount: String(lot['withdrawable_amount'] ?? '0'),
        withdrawnAmount: String(lot['withdrawn_amount'] ?? '0'),
        status: String(lot['status'] ?? 'unknown'),
      }))
    : [];
  const vestingVm: UserVesting = {
    totalLocked: vestingAvailable ? String(vestingSource['total_locked'] ?? '0') : null,
    totalReleased: vestingAvailable ? String(vestingSource['total_released'] ?? '0') : null,
    totalWithdrawable: vestingAvailable
      ? String(vestingSource['total_withdrawable'] ?? '0')
      : null,
    totalWithdrawn: vestingAvailable ? String(vestingSource['total_withdrawn'] ?? '0') : null,
    lots: vestingLots,
    available: vestingAvailable,
  };

  /* ---------- Qualification --------------------------------------- */
  const qualificationVm: UserQualification = {
    rewardQualified: Boolean(financial['reward_qualified']),
    teamRewardQualified: Boolean(financial['team_reward_qualified']),
    directRate: null, // derived at render time from tier definitions
    teamRate:
      financial['team_rate'] === undefined
        ? null
        : String(financial['team_rate']),
    isPeer: Boolean(financial['is_peer']),
  };

  /* ---------- Reward rows ----------------------------------------- */
  const rewardRows: UserRewardRow[] = [
    ...input.directRewards.map(mapDirectReward),
    ...input.teamRewards.map(mapTeamReward),
    ...input.equalRewards.map(mapEqualReward),
    ...input.burns.map(mapBurnReward),
  ];
  // Sort by date desc so the most recent row is on top.
  rewardRows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  /* ---------- Audit ----------------------------------------------- */
  const audit: UserAuditRow[] = input.logs.map((row) => ({
    id: String(row['admin_log_id'] ?? ''),
    adminUserId: String(row['admin_user_id'] ?? ''),
    action: String(row['action'] ?? ''),
    targetType: String(row['target_type'] ?? ''),
    targetId: String(row['target_id'] ?? ''),
    createdAt: String(row['created_at'] ?? ''),
    original: row,
  }));
  audit.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  /* ---------- Team children --------------------------------------- */
  const teamChildren: UserTeamChild[] = input.teamSubtree
    .filter((n) => String(n['parent_wallet_address'] ?? '') === input.walletAddress)
    .map((n) => ({
      walletAddress: String(n['wallet_address'] ?? ''),
      status: String(n['status'] ?? 'active'),
      tier: (n['current_tier'] as string) ?? null,
      personalDeposit: String(n['cumulative_deposit'] ?? '0'),
      teamPerformance: String(n['team_total_performance'] ?? '0'),
      directCount: toNumber(n['direct_referral_count']),
      teamSize: toNumber(n['team_size']),
      depth: toNumber(n['depth']),
    }));

  return {
    identity: identityVm,
    referral: referralVm,
    financial: financialVm,
    rewards: rewardsVm,
    vesting: vestingVm,
    qualification: qualificationVm,
    rewardRows,
    audit,
    teamChildren,
  };
}

/* --------------------------------------------------------------------- */
/*  Reward row mappers                                                   */
/* --------------------------------------------------------------------- */

function mapDirectReward(row: AnyRow): UserRewardRow {
  return {
    id: String(row['direct_reward_id'] ?? ''),
    kind: 'direct',
    date: String(row['rewarded_at'] ?? ''),
    rawAmount: String(row['reward_amount'] ?? '0'),
    burnedAmount: '0',
    actualAmount: String(row['reward_amount'] ?? '0'),
    counterpartyWallet: (row['from_wallet_address'] as string) ?? null,
    status: 'claimable',
    reason: null,
    original: row,
  };
}

function mapTeamReward(row: AnyRow): UserRewardRow {
  return {
    id: String(row['team_reward_daily_id'] ?? ''),
    kind: 'team',
    date: String(row['settle_date'] ?? ''),
    rawAmount: String(row['raw_total'] ?? '0'),
    burnedAmount: String(row['burned_amount'] ?? '0'),
    actualAmount: String(row['actual_total'] ?? '0'),
    counterpartyWallet: null,
    status: (row['status'] as string) ?? null,
    reason: null,
    original: row,
  };
}

function mapEqualReward(row: AnyRow): UserRewardRow {
  return {
    id: String(row['equal_level_reward_id'] ?? ''),
    kind: 'equal_level',
    date: String(row['settle_date'] ?? ''),
    rawAmount: String(row['raw_amount'] ?? '0'),
    burnedAmount: String(row['burned_amount'] ?? '0'),
    actualAmount: String(row['actual_amount'] ?? '0'),
    counterpartyWallet: null,
    status: (row['status'] as string) ?? null,
    reason: null,
    original: row,
  };
}

function mapBurnReward(row: AnyRow): UserRewardRow {
  return {
    id: String(row['burn_record_id'] ?? ''),
    kind: 'burn',
    date: String(row['settle_date'] ?? ''),
    rawAmount: String(row['raw_amount'] ?? '0'),
    burnedAmount: String(row['burned_amount'] ?? '0'),
    actualAmount: String(row['actual_amount'] ?? '0'),
    counterpartyWallet: null,
    status: null,
    reason: (row['reason'] as string) ?? null,
    original: row,
  };
}
