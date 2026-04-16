/**
 * GET /api/v1/config/public handler.
 *
 * Resolves only the subset of config keys the frontend is allowed
 * to see (09 §18.1). Never exposes admin-only config groups.
 */
import {
  ConfigGroup,
  normalizeClaimPolicy,
  normalizePricing,
  normalizeQualificationPolicy,
  normalizeQuickAmountOptions,
  normalizeMinimumPurchaseAmount,
} from '@posx/config';
import type { DbClient } from '../db';

import { success, type HandlerContext, type HandlerSuccess } from './types';

export async function handleGetPublicConfig(
  ctx: HandlerContext,
): Promise<
  HandlerSuccess<{
    token_price: string;
    min_purchase_amount: string;
    quick_amount_options: string[];
    reward_min_deposit_threshold: string;
    reward_min_holding_threshold: string;
    min_claim_amount: string;
    languages: string[];
    theme_options: string[];
    announcements: Record<string, string> | null;
  }>
> {
  return success(ctx, await readPublicConfigDirect(ctx.db));
}

async function readPublicConfigDirect(db: DbClient): Promise<{
  token_price: string;
  min_purchase_amount: string;
  quick_amount_options: string[];
  reward_min_deposit_threshold: string;
  reward_min_holding_threshold: string;
  min_claim_amount: string;
  languages: string[];
  theme_options: string[];
  announcements: Record<string, string> | null;
}> {
  const rows = await db.query<{
    config_group: string;
    config_key: string;
    config_value: Record<string, unknown>;
  }>(
    `select distinct on (config_group, config_key)
        config_group, config_key, config_value
       from config_versions
      where status in ('active','superseded')
        and effective_from <= now()
        and config_group in ($1, $2, $3, $4, $5)
      order by config_group, config_key, effective_from desc`,
    [
      ConfigGroup.Pricing,
      ConfigGroup.PurchaseRules,
      ConfigGroup.QualificationRules,
      ConfigGroup.ClaimRules,
      ConfigGroup.DisplayRules,
    ],
  );

  const byKey = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    byKey.set(`${r.config_group}::${r.config_key}`, r.config_value);
  }

  const pricing = normalizePricing(
    byKey.get(`${ConfigGroup.Pricing}::token_price`) ?? {
      token_price: '0',
      currency: 'USDT',
    },
  );
  const minPurchase = normalizeMinimumPurchaseAmount(
    byKey.get(`${ConfigGroup.PurchaseRules}::minimum_purchase_amount`) ?? {
      minimum_purchase_amount: '0',
      currency: 'USDT',
    },
  );
  const quickAmounts = normalizeQuickAmountOptions(
    byKey.get(`${ConfigGroup.PurchaseRules}::quick_amount_options`) ?? {
      options: [],
    },
  );
  const qualification = normalizeQualificationPolicy(
    byKey.get(`${ConfigGroup.QualificationRules}::reward_minimums`) ?? {
      reward_min_deposit_threshold: '0',
      reward_min_holding_threshold: '0',
    },
  );
  const claimPolicy = normalizeClaimPolicy(
    byKey.get(`${ConfigGroup.ClaimRules}::claim_policy`) ?? {
      min_claim_amount: '0',
      claim_scope_default: 'claim_all',
      allow_claim_by_type: true,
      pending_signature_ttl_minutes: 30,
    },
  );
  const languagesValue = byKey.get(
    `${ConfigGroup.DisplayRules}::enabled_languages`,
  ) as { languages?: string[] } | undefined;
  const themeValue = byKey.get(`${ConfigGroup.DisplayRules}::theme_options`) as
    | { themes?: string[] }
    | undefined;

  return {
    token_price: pricing.token_price,
    min_purchase_amount: minPurchase.minimum_purchase_amount,
    quick_amount_options: [...quickAmounts.options],
    reward_min_deposit_threshold: qualification.reward_min_deposit_threshold,
    reward_min_holding_threshold: qualification.reward_min_holding_threshold,
    min_claim_amount: claimPolicy.min_claim_amount,
    languages: languagesValue?.languages ?? ['zh-CN', 'zh-TW', 'en', 'ko'],
    theme_options: themeValue?.themes ?? ['light', 'dark'],
    announcements: null,
  };
}
