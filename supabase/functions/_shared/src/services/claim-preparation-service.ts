/**
 * ClaimPreparationService — builds a `claim_orders` row, locks the
 * claimable snapshots to it, and returns the signable payload for
 * the frontend.
 *
 * Constraint 2: the order enters `pending_signature` via the
 * transition helper, not a raw insert that would bypass the state
 * machine. The initial insert already carries the starting status
 * (allowed) — state machine entries are the FIRST allowed status.
 */
import {
  ClaimItemRewardType,
  ClaimItemSourceTable,
  type ClaimOrderScope,
  ClaimOrderStatus,
  type AmountString,
  type Uuid,
  type WalletAddress,
} from '@posx/shared-types';
import { addAmount, amountLt, type Clock, systemClock } from '@posx/shared-utils';
import { ConfigGroup, type ConfigResolver, normalizeClaimPolicy } from '@posx/config';

import { buildClaimMessage, generateAuthNonce } from '../crypto';
import type { DbClient } from '../db';
import { AppError } from '../errors';
import {
  insertClaimOrder,
  insertClaimOrderItem,
  persistClaimOrderSignedMessage,
  type ClaimOrderRow,
} from '../repos/claim-orders';
import {
  listClaimableTeamRewardsByWallet,
  lockTeamRewardToClaimOrder,
} from '../repos/team-rewards';
import {
  listClaimableEqualLevelRewardsByWallet,
  lockEqualLevelRewardToClaimOrder,
} from '../repos/equal-level-rewards';
import type { UserAccessPolicyService } from './user-access-policy';

export interface PrepareClaimInput {
  readonly wallet: WalletAddress;
  readonly clientRequestId: string;
  readonly scope?: ClaimOrderScope;
}

export interface PrepareClaimResult {
  readonly order: ClaimOrderRow;
  readonly items: ReadonlyArray<{
    reward_type: ClaimItemRewardType;
    source_snapshot_id: Uuid;
    amount: AmountString;
  }>;
  readonly messageToSign: string;
}

export class ClaimPreparationService {
  private readonly clock: Clock;

  constructor(
    private readonly db: DbClient,
    private readonly access: UserAccessPolicyService,
    private readonly config: ConfigResolver,
    options: { clock?: Clock } = {},
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async prepare(input: PrepareClaimInput): Promise<PrepareClaimResult> {
    await this.access.assertCanClaim(input.wallet);

    const nowIso = this.clock.nowIso();
    const claimRow = await this.config.resolve({
      group: ConfigGroup.ClaimRules,
      key: 'claim_policy',
      context: { evaluationTime: nowIso },
    });
    if (!claimRow) {
      throw new AppError('INTERNAL_ERROR', 'claim_rules.claim_policy missing');
    }
    const claimPolicy = normalizeClaimPolicy(claimRow.config_value);

    return this.db.transaction(async (tx) => {
      const teamClaimable = await listClaimableTeamRewardsByWallet(tx, input.wallet);
      const equalClaimable = await listClaimableEqualLevelRewardsByWallet(tx, input.wallet);

      const items: Array<{
        reward_type: ClaimItemRewardType;
        source_table: ClaimItemSourceTable;
        source_snapshot_id: Uuid;
        amount: AmountString;
      }> = [];
      let total: AmountString = '0';
      for (const row of teamClaimable) {
        if (row.actual_total === '0') continue;
        items.push({
          reward_type: ClaimItemRewardType.Team,
          source_table: ClaimItemSourceTable.TeamRewardsDaily,
          source_snapshot_id: row.id,
          amount: row.actual_total,
        });
        total = addAmount(total, row.actual_total);
      }
      for (const row of equalClaimable) {
        if (row.actual_amount === '0') continue;
        items.push({
          reward_type: ClaimItemRewardType.EqualLevel,
          source_table: ClaimItemSourceTable.EqualLevelRewardsDaily,
          source_snapshot_id: row.id,
          amount: row.actual_amount,
        });
        total = addAmount(total, row.actual_amount);
      }

      if (items.length === 0) {
        throw new AppError('CLAIM_NOTHING_AVAILABLE', 'no claimable rewards');
      }
      if (amountLt(total, claimPolicy.min_claim_amount)) {
        throw new AppError(
          'CLAIM_MIN_AMOUNT_NOT_MET',
          `minimum claim amount is ${claimPolicy.min_claim_amount}`,
        );
      }

      const order = await insertClaimOrder(tx, {
        wallet_address: input.wallet,
        client_request_id: input.clientRequestId,
        status: ClaimOrderStatus.PendingSignature,
        claim_scope: input.scope ?? claimPolicy.claim_scope_default,
        requested_total_amount: total,
      });

      for (const item of items) {
        await insertClaimOrderItem(tx, {
          claim_order_id: order.id,
          reward_type: item.reward_type,
          source_table: item.source_table,
          source_snapshot_id: item.source_snapshot_id,
          amount: item.amount,
        });
        if (item.source_table === ClaimItemSourceTable.TeamRewardsDaily) {
          await lockTeamRewardToClaimOrder(tx, item.source_snapshot_id, order.id);
        } else if (item.source_table === ClaimItemSourceTable.EqualLevelRewardsDaily) {
          await lockEqualLevelRewardToClaimOrder(tx, item.source_snapshot_id, order.id);
        }
      }

      const messageToSign = buildClaimMessage({
        walletAddress: input.wallet,
        claimOrderId: order.id,
        amount: total,
        nonce: generateAuthNonce().slice(0, 16),
      });

      // BE-35/36/89: persist the canonical message-to-sign inside
      // the same transaction as the order + item inserts. The sign
      // handler reads it back from `claim_orders.signed_message` —
      // it MUST be the exact byte sequence we hand the client, or
      // the signature verification path degenerates into comparing
      // the user's signature against an empty string.
      const persisted = await persistClaimOrderSignedMessage(
        tx,
        order.id,
        messageToSign,
      );

      return {
        order: persisted,
        items: items.map((it) => ({
          reward_type: it.reward_type,
          source_snapshot_id: it.source_snapshot_id,
          amount: it.amount,
        })),
        messageToSign,
      };
    });
  }
}
