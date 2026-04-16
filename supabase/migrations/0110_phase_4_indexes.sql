-- =============================================================================
-- 0110_phase_4_indexes.sql
--
-- Supplementary indexes added after reviewing the real Phase 4
-- query paths (constraint 7). Every index below was introduced only
-- because a specific service function has a hot path that would
-- otherwise scan a wide range of rows. Do NOT add speculative
-- indexes to this file — extend it with a new migration when a new
-- query pattern appears.
--
-- Reviewed paths:
--   1. ClaimPreparationService.listClaimableByWallet (team + equal-level)
--      needs `status = 'claimable' AND claim_order_id IS NULL` per
--      wallet. A partial covering index cuts the scan down to the
--      ~couple of rows per user that actually matter.
--   2. AdjustmentService.listActiveAdjustmentsForWallet uses
--      `wallet_address + status = 'active'` with an ORDER BY
--      `created_at asc` for FIFO consumption of credits.
--   3. ChainEventProcessor.listConfirmedUnprocessedEvents needs the
--      oldest confirmed-but-unprocessed events in block order.
--   4. SettlementOrchestrator.enumerateEligibleWallets reads
--      `referral_closure` grouped by ancestor at depth 1; the
--      existing `(ancestor_wallet_address, depth)` index already
--      covers this — NO new index needed.
-- =============================================================================

-- 1. team_rewards_daily — "claimable and unlocked by wallet".
create index if not exists team_rewards_daily_claimable_per_wallet_idx
  on team_rewards_daily (wallet_address, settle_date)
  where status = 'claimable' and claim_order_id is null;

-- 2. equal_level_rewards_daily — same shape.
create index if not exists equal_level_rewards_claimable_per_wallet_idx
  on equal_level_rewards_daily (wallet_address, settle_date)
  where status = 'claimable' and claim_order_id is null;

-- 3. adjustment_records — FIFO credit consumption path
--    (`listActiveAdjustmentsForWallet` + `consumeCredits`).
create index if not exists adjustment_records_active_per_wallet_idx
  on adjustment_records (wallet_address, created_at)
  where status = 'active';

-- 4. chain_events — the processor pulls confirmed-but-unprocessed
--    rows in `(block_number, log_index)` order.
create index if not exists chain_events_confirmed_scan_idx
  on chain_events (block_number, log_index)
  where status = 'confirmed';

-- 5. user_reward_summary — admin leaderboard + rewards page both
--    sort by `claimable_total desc`. The Phase 3 migration already
--    indexed this but only as a standalone single-column index;
--    repeating here as `if not exists` is safe and documents the
--    intent.
create index if not exists user_reward_summary_claimable_total_desc_idx
  on user_reward_summary (claimable_total desc);
