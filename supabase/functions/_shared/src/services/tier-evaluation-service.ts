/**
 * TierEvaluationService — thin wrapper that fetches the normalized
 * `TierDefinitions` from config once per call and delegates to
 * `@posx/domain-rules/resolveTier`.
 *
 * Services that need a tier for multiple users in a settlement run
 * should call this once and cache the definitions themselves rather
 * than re-resolving config on every user.
 */
import {
  type TierCode,
  type UtcDate,
  type WalletAddress,
} from '@posx/shared-types';
import {
  ConfigGroup,
  type ConfigResolver,
  normalizeQualificationPolicy,
  normalizeTierDefinitions,
} from '@posx/config';
import {
  evaluateQualification,
  resolveTier,
  type QualificationPolicy,
  type TierDefinition,
  type TierDefinitions,
} from '@posx/domain-rules';

import { AppError } from '../errors';

export interface TierEvaluationResolved {
  readonly tier: TierCode | null;
  readonly tierDefinition: TierDefinition | null;
  readonly rewardQualified: boolean;
  readonly teamRewardQualified: boolean;
}

export class TierEvaluationService {
  constructor(private readonly config: ConfigResolver) {}

  async loadActiveInputs(
    evaluationTime: string,
    settlementDate?: UtcDate,
  ): Promise<{
    qualification: QualificationPolicy;
    tiers: TierDefinitions;
  }> {
    const ctx = settlementDate
      ? { evaluationTime, settlementDate }
      : { evaluationTime };

    const [qualRow, tierRow] = await Promise.all([
      this.config.resolve({
        group: ConfigGroup.QualificationRules,
        key: 'reward_minimums',
        context: ctx,
      }),
      this.config.resolve({
        group: ConfigGroup.TierRules,
        key: 'tier_definitions',
        context: ctx,
      }),
    ]);
    if (!qualRow) {
      throw new AppError('INTERNAL_ERROR', 'qualification_rules.reward_minimums missing');
    }
    if (!tierRow) {
      throw new AppError('INTERNAL_ERROR', 'tier_rules.tier_definitions missing');
    }

    return {
      qualification: normalizeQualificationPolicy(qualRow.config_value),
      tiers: normalizeTierDefinitions(tierRow.config_value),
    };
  }

  evaluate(args: {
    wallet: WalletAddress;
    cumulativeDeposit: string;
    holdingValueUsdt: string;
    inputs: { qualification: QualificationPolicy; tiers: TierDefinitions };
  }): TierEvaluationResolved {
    void args.wallet; // currently not used but keeps the API identity explicit
    const { tier, tier_definition } = resolveTier({
      cumulative_deposit: args.cumulativeDeposit,
      holding_value_usdt: args.holdingValueUsdt,
      tier_definitions: args.inputs.tiers,
    });
    const qual = evaluateQualification({
      cumulative_deposit: args.cumulativeDeposit,
      holding_value_usdt: args.holdingValueUsdt,
      tier,
      qualification_policy: args.inputs.qualification,
      tier_definitions: args.inputs.tiers,
    });
    return {
      tier,
      tierDefinition: tier_definition,
      rewardQualified: qual.reward_qualified,
      teamRewardQualified: qual.team_reward_qualified,
    };
  }

  /** Helper used by admin endpoints needing a single user lookup. */
  async evaluateForSingleWallet(args: {
    wallet: WalletAddress;
    cumulativeDeposit: string;
    holdingValueUsdt: string;
    evaluationTime: string;
    settlementDate?: UtcDate;
  }): Promise<TierEvaluationResolved> {
    const inputs = await this.loadActiveInputs(args.evaluationTime, args.settlementDate);
    return this.evaluate({
      wallet: args.wallet,
      cumulativeDeposit: args.cumulativeDeposit,
      holdingValueUsdt: args.holdingValueUsdt,
      inputs,
    });
  }
}
