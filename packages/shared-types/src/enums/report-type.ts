/**
 * Report export type.
 *
 * Source of truth: 11_reporting_and_metrics_definition.md §16.4 and §22
 *
 * The metrics definition explicitly warns against collapsing raw and
 * actual reward exports into one ambiguous label, so this enum carries
 * separate `reward_generation_raw` and `reward_generation_actual`
 * variants.
 */
import { createEnumGuard } from '../internal/enum-helpers';

export const ReportType = {
  Deposit: 'deposit',
  DirectReward: 'direct_reward',
  TeamReward: 'team_reward',
  EqualLevelReward: 'equal_level_reward',
  RewardGenerationRaw: 'reward_generation_raw',
  RewardGenerationActual: 'reward_generation_actual',
  Burn: 'burn',
  ClaimPayoutHistory: 'claim_payout_history',
  TeamRanking: 'team_ranking',
  RewardIssuance: 'reward_issuance',
} as const;

export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const REPORT_TYPE_VALUES = [
  ReportType.Deposit,
  ReportType.DirectReward,
  ReportType.TeamReward,
  ReportType.EqualLevelReward,
  ReportType.RewardGenerationRaw,
  ReportType.RewardGenerationActual,
  ReportType.Burn,
  ReportType.ClaimPayoutHistory,
  ReportType.TeamRanking,
  ReportType.RewardIssuance,
] as const satisfies ReadonlyArray<ReportType>;

export const isReportType = createEnumGuard(REPORT_TYPE_VALUES);
