-- =============================================================================
-- ops-scenarios.sql  --  Staging seed: operational data for admin dashboard QA
--
-- Settlement jobs, job_runs, chain_sync_state, report exports,
-- team/equal-level reward snapshots, direct rewards, burn records,
-- and dashboard daily summaries.
--
-- All timestamps use now() - interval so data stays "recent".
-- Idempotent: DELETE + re-INSERT.
-- Depends on: admin-fixtures.sql (admin user IDs), user-fixtures.sql (wallets)
-- =============================================================================

-- ============================================================
-- Clean slate (children before parents, skip tables already wiped by user-fixtures)
-- ============================================================
DELETE FROM burn_records WHERE TRUE;
DELETE FROM team_reward_line_details WHERE TRUE;
DELETE FROM equal_level_rewards_daily WHERE TRUE;
DELETE FROM team_rewards_daily WHERE TRUE;
DELETE FROM direct_rewards WHERE TRUE;
DELETE FROM settlement_jobs WHERE TRUE;
DELETE FROM job_runs WHERE TRUE;
DELETE FROM chain_sync_state WHERE TRUE;
DELETE FROM report_export_jobs WHERE TRUE;
DELETE FROM dashboard_daily_summary WHERE TRUE;

-- ============================================================
-- Settlement jobs (5 rows -- various statuses)
-- ============================================================
INSERT INTO settlement_jobs (id, job_type, settlement_date, mode, status, config_version_snapshot, started_at, finished_at, triggered_by_admin_id, processed_user_count, created_snapshot_count, error_count, created_at)
VALUES
  ('eb000001-0000-0000-0000-000000000001', 'daily_settlement', (current_date - 14), 'official', 'completed',
   '{"pricing.token_price": 1}', now() - interval '14 days', now() - interval '14 days' + interval '3 minutes',
   'a0000002-0000-0000-0000-000000000002', 20, 35, 0, now() - interval '14 days'),

  ('eb000002-0000-0000-0000-000000000001', 'daily_settlement', (current_date - 7), 'official', 'completed',
   '{"pricing.token_price": 1}', now() - interval '7 days', now() - interval '7 days' + interval '4 minutes',
   'a0000002-0000-0000-0000-000000000002', 20, 38, 0, now() - interval '7 days'),

  ('eb000003-0000-0000-0000-000000000001', 'daily_settlement', (current_date - 1), 'official', 'running',
   '{"pricing.token_price": 1}', now() - interval '30 minutes', null,
   'a0000002-0000-0000-0000-000000000002', 5, 8, 0, now() - interval '30 minutes'),

  ('eb000004-0000-0000-0000-000000000001', 'daily_settlement', (current_date - 3), 'official', 'failed',
   '{"pricing.token_price": 1}', now() - interval '3 days', now() - interval '3 days' + interval '1 minute',
   'a0000002-0000-0000-0000-000000000002', 2, 0, 2, now() - interval '3 days'),

  ('eb000005-0000-0000-0000-000000000001', 'daily_settlement', (current_date - 5), 'official', 'partial',
   '{"pricing.token_price": 1}', now() - interval '5 days', now() - interval '5 days' + interval '5 minutes',
   'a0000002-0000-0000-0000-000000000002', 18, 30, 3, now() - interval '5 days');

-- ============================================================
-- Job runs (10 rows -- chain_sync, daily_settlement, summary_rebuild)
-- ============================================================
INSERT INTO job_runs (id, job_name, job_key, status, started_at, finished_at, rows_scanned, rows_processed, rows_failed, detail, error_message)
VALUES
  (gen_random_uuid(), 'chain_sync', 'bsc_mainnet', 'completed',
   now() - interval '2 hours', now() - interval '2 hours' + interval '45 seconds',
   500, 12, 0, '{"chain_id": 56, "blocks_scanned": 500}', null),

  (gen_random_uuid(), 'chain_sync', 'bsc_mainnet', 'completed',
   now() - interval '4 hours', now() - interval '4 hours' + interval '38 seconds',
   500, 8, 0, '{"chain_id": 56, "blocks_scanned": 500}', null),

  (gen_random_uuid(), 'chain_sync', 'eth_mainnet', 'failed',
   now() - interval '6 hours', now() - interval '6 hours' + interval '10 seconds',
   100, 0, 1, '{"chain_id": 1, "blocks_scanned": 100}', 'RPC timeout after 10s'),

  (gen_random_uuid(), 'chain_sync', 'eth_mainnet', 'completed',
   now() - interval '1 hour', now() - interval '1 hour' + interval '30 seconds',
   200, 3, 0, '{"chain_id": 1, "blocks_scanned": 200}', null),

  (gen_random_uuid(), 'daily_settlement', (current_date - 14)::text, 'completed',
   now() - interval '14 days', now() - interval '14 days' + interval '3 minutes',
   20, 20, 0, '{"mode": "official"}', null),

  (gen_random_uuid(), 'daily_settlement', (current_date - 7)::text, 'completed',
   now() - interval '7 days', now() - interval '7 days' + interval '4 minutes',
   20, 20, 0, '{"mode": "official"}', null),

  (gen_random_uuid(), 'daily_settlement', (current_date - 3)::text, 'failed',
   now() - interval '3 days', now() - interval '3 days' + interval '1 minute',
   20, 2, 2, '{"mode": "official"}', 'config_version mismatch on tier_rules'),

  (gen_random_uuid(), 'summary_rebuild', 'user_reward_summary', 'completed',
   now() - interval '14 days' + interval '5 minutes', now() - interval '14 days' + interval '6 minutes',
   20, 20, 0, null, null),

  (gen_random_uuid(), 'summary_rebuild', 'user_reward_summary', 'completed',
   now() - interval '7 days' + interval '5 minutes', now() - interval '7 days' + interval '6 minutes',
   20, 20, 0, null, null),

  (gen_random_uuid(), 'summary_rebuild', 'team_performance_snapshot', 'completed',
   now() - interval '7 days' + interval '7 minutes', now() - interval '7 days' + interval '8 minutes',
   20, 20, 0, null, null);

-- ============================================================
-- Chain sync state (2 chains: BSC normal, ETH lagging)
-- ============================================================
INSERT INTO chain_sync_state (id, chain_id, contract_address, sync_key, last_scanned_block, last_confirmed_block, last_scanned_at)
VALUES
  (gen_random_uuid(), 56, '0x0000000000000000000000000000000000000001', 'purchase_events',
   30001500, 30001488, now() - interval '2 minutes'),
  (gen_random_uuid(), 1, '0x0000000000000000000000000000000000000002', 'purchase_events',
   19500000, 19499800, now() - interval '3 hours');

-- ============================================================
-- Report export jobs (5 rows)
-- ============================================================
INSERT INTO report_export_jobs (id, requested_by_admin_id, report_type, status, filters, file_path, error_message, created_at, finished_at)
VALUES
  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002', 'user_rewards_summary', 'completed',
   '{"date_from": "2026-03-01", "date_to": "2026-04-01"}',
   '/exports/user_rewards_2026_03.csv', null,
   now() - interval '5 days', now() - interval '5 days' + interval '20 seconds'),

  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002', 'purchase_report', 'completed',
   '{"status": "confirmed"}',
   '/exports/purchases_confirmed.csv', null,
   now() - interval '3 days', now() - interval '3 days' + interval '15 seconds'),

  (gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001', 'settlement_detail', 'failed',
   '{"settlement_date": "2026-04-10"}',
   null, 'no settlement data for requested date',
   now() - interval '2 days', now() - interval '2 days' + interval '5 seconds'),

  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002', 'team_structure', 'queued',
   '{"wallet_address": "0x00000000000000000000000000000000000ff014"}',
   null, null,
   now() - interval '10 minutes', null),

  (gen_random_uuid(), 'a0000003-0000-0000-0000-000000000003', 'burn_report', 'completed',
   '{"date_from": "2026-03-01"}',
   '/exports/burns_2026_03.csv', null,
   now() - interval '1 day', now() - interval '1 day' + interval '12 seconds');

-- ============================================================
-- Team rewards daily (20 rows -- last 14 days for trend data)
-- Uses completed settlement jobs s0000001 (14 days ago) and s0000002 (7 days ago)
-- ============================================================
INSERT INTO team_rewards_daily (id, settlement_job_id, wallet_address, settle_date, qualification_tier, user_team_rate, team_total_performance, effective_performance, raw_total, burned_amount, actual_total, status)
VALUES
  -- Settlement 1 (14 days ago): 10 users
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', current_date - 14, 'elite', 0.10, 500000, 300000, 30000, 0, 30000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', current_date - 14, 'advanced', 0.05, 120000, 80000, 4000, 0, 4000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', current_date - 14, 'elite', 0.10, 800000, 600000, 60000, 0, 60000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff017', current_date - 14, 'elite', 0.10, 200000, 100000, 10000, 0, 10000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff001', current_date - 14, 'basic', 0.05, 30000, 15000, 750, 0, 750, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff009', current_date - 14, 'advanced', 0.05, 50000, 25000, 1250, 0, 1250, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff011', current_date - 14, 'basic', 0.05, 20000, 10000, 500, 0, 500, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', current_date - 14, 'advanced', 0.05, 40000, 20000, 1000, 0, 1000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff018', current_date - 14, 'basic', 0.05, 15000, 8000, 400, 200, 200, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff019', current_date - 14, 'advanced', 0.05, 60000, 35000, 1750, 0, 1750, 'claimable'),

  -- Settlement 2 (7 days ago): 10 users
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', current_date - 7, 'elite', 0.10, 520000, 310000, 31000, 0, 31000, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', current_date - 7, 'advanced', 0.05, 130000, 85000, 4250, 0, 4250, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', current_date - 7, 'elite', 0.10, 850000, 640000, 64000, 0, 64000, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff017', current_date - 7, 'elite', 0.10, 210000, 105000, 10500, 0, 10500, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff001', current_date - 7, 'basic', 0.05, 32000, 16000, 800, 0, 800, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff009', current_date - 7, 'advanced', 0.05, 55000, 28000, 1400, 0, 1400, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff011', current_date - 7, 'basic', 0.05, 22000, 11000, 550, 0, 550, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', current_date - 7, 'advanced', 0.05, 45000, 22000, 1100, 0, 1100, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff018', current_date - 7, 'basic', 0.05, 16000, 9000, 450, 250, 200, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff019', current_date - 7, 'advanced', 0.05, 65000, 38000, 1900, 0, 1900, 'claimable');

-- ============================================================
-- Equal level rewards daily (10 rows)
-- ============================================================
INSERT INTO equal_level_rewards_daily (id, settlement_job_id, wallet_address, line_root_wallet_address, settle_date, equal_level_rate, subordinate_team_total_performance, line_effective_performance, raw_amount, burned_amount, actual_amount, status)
VALUES
  -- Settlement 1
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff002', current_date - 14, 1.00, 500000, 300000, 300000, 0, 300000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff017', current_date - 14, 1.00, 200000, 100000, 100000, 0, 100000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff013', current_date - 14, 1.00, 120000, 80000, 80000, 0, 80000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff009', current_date - 14, 1.00, 150000, 100000, 100000, 0, 100000, 'claimable'),
  (gen_random_uuid(), 'eb000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff018', current_date - 14, 1.00, 100000, 60000, 60000, 42000, 18000, 'claimable'),

  -- Settlement 2
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff002', current_date - 7, 1.00, 520000, 310000, 310000, 0, 310000, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff017', current_date - 7, 1.00, 210000, 105000, 105000, 0, 105000, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff013', current_date - 7, 1.00, 130000, 85000, 85000, 0, 85000, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff009', current_date - 7, 1.00, 155000, 105000, 105000, 0, 105000, 'claimable'),
  (gen_random_uuid(), 'eb000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff018', current_date - 7, 1.00, 110000, 65000, 65000, 47000, 18000, 'claimable');

-- ============================================================
-- Direct rewards (5 rows -- chain-backed facts)
-- ============================================================
INSERT INTO direct_rewards (id, from_wallet_address, to_wallet_address, chain_id, tx_hash, block_number, reward_rate, purchase_amount, reward_amount, rewarded_at)
VALUES
  (gen_random_uuid(), '0x00000000000000000000000000000000000ff001', '0x00000000000000000000000000000000000ff015', 56,
   '0xcc00000000000000000000000000000000000000000000000000000000000001', 30000001, 0.15, 10000, 1500, now() - interval '55 days'),
  (gen_random_uuid(), '0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff015', 56,
   '0xcc00000000000000000000000000000000000000000000000000000000000002', 30000010, 0.15, 300000, 45000, now() - interval '85 days'),
  (gen_random_uuid(), '0x00000000000000000000000000000000000ff003', '0x00000000000000000000000000000000000ff014', 56,
   '0xcc00000000000000000000000000000000000000000000000000000000000003', 30000020, 0.10, 2000, 200, now() - interval '40 days'),
  (gen_random_uuid(), '0x00000000000000000000000000000000000ff009', '0x00000000000000000000000000000000000ff014', 56,
   '0xcc00000000000000000000000000000000000000000000000000000000000004', 30000050, 0.10, 15000, 1500, now() - interval '45 days'),
  (gen_random_uuid(), '0x00000000000000000000000000000000000ff013', '0x00000000000000000000000000000000000ff002', 56,
   '0xcc00000000000000000000000000000000000000000000000000000000000005', 30000070, 0.15, 12000, 1800, now() - interval '45 days');

-- ============================================================
-- Burn records (5 rows -- user 18 is burn_affected)
-- ============================================================
-- burn_records need source_snapshot_id referencing team_rewards_daily or equal_level_rewards_daily.
-- We use the deterministic team_rewards_daily IDs from settlement 1 for user 18.
-- Since those use gen_random_uuid(), we create deterministic IDs here via a subquery pattern.

DO $$
DECLARE
  v_team_id_18_s1 uuid;
  v_team_id_18_s2 uuid;
  v_eq_id_18_s1 uuid;
  v_eq_id_18_s2 uuid;
BEGIN
  SELECT id INTO v_team_id_18_s1 FROM team_rewards_daily
    WHERE wallet_address = '0x00000000000000000000000000000000000ff018'
      AND settlement_job_id = 'eb000001-0000-0000-0000-000000000001' LIMIT 1;
  SELECT id INTO v_team_id_18_s2 FROM team_rewards_daily
    WHERE wallet_address = '0x00000000000000000000000000000000000ff018'
      AND settlement_job_id = 'eb000002-0000-0000-0000-000000000001' LIMIT 1;
  SELECT id INTO v_eq_id_18_s1 FROM equal_level_rewards_daily
    WHERE wallet_address = '0x00000000000000000000000000000000000ff002'
      AND line_root_wallet_address = '0x00000000000000000000000000000000000ff018'
      AND settlement_job_id = 'eb000001-0000-0000-0000-000000000001' LIMIT 1;
  SELECT id INTO v_eq_id_18_s2 FROM equal_level_rewards_daily
    WHERE wallet_address = '0x00000000000000000000000000000000000ff002'
      AND line_root_wallet_address = '0x00000000000000000000000000000000000ff018'
      AND settlement_job_id = 'eb000002-0000-0000-0000-000000000001' LIMIT 1;

  INSERT INTO burn_records (id, wallet_address, reward_type, source_snapshot_id, source_table, settle_date, holding_value_at_snapshot, used_burn_capacity_before, burn_cap, raw_amount, burned_amount, actual_amount, reason)
  VALUES
    (gen_random_uuid(), '0x00000000000000000000000000000000000ff018', 'team', v_team_id_18_s1, 'team_rewards_daily', current_date - 14,
     6000, 0, 18000, 400, 200, 200, 'burn cap 3x holding: 6000 * 3 = 18000'),
    (gen_random_uuid(), '0x00000000000000000000000000000000000ff018', 'team', v_team_id_18_s2, 'team_rewards_daily', current_date - 7,
     6000, 200, 18000, 450, 250, 200, 'burn cap 3x holding: cumulative burn applied'),
    (gen_random_uuid(), '0x00000000000000000000000000000000000ff018', 'equal_level', v_eq_id_18_s1, 'equal_level_rewards_daily', current_date - 14,
     6000, 400, 18000, 60000, 42000, 18000, 'burn cap 3x holding: large equal-level reward capped'),
    (gen_random_uuid(), '0x00000000000000000000000000000000000ff018', 'equal_level', v_eq_id_18_s2, 'equal_level_rewards_daily', current_date - 7,
     6000, 42400, 18000, 65000, 47000, 18000, 'burn cap 3x holding: cumulative burn continues'),
    -- One burn record for user 19 (vesting_partial) to add variety
    (gen_random_uuid(), '0x00000000000000000000000000000000000ff019', 'team',
     (SELECT id FROM team_rewards_daily WHERE wallet_address = '0x00000000000000000000000000000000000ff019' AND settlement_job_id = 'eb000001-0000-0000-0000-000000000001' LIMIT 1),
     'team_rewards_daily', current_date - 14,
     25000, 0, 75000, 1750, 0, 1750, 'no burn: holding 25000 * 3 = 75000 cap, well within limits');
END $$;

-- ============================================================
-- Dashboard daily summary (14 days of trend data)
-- ============================================================
INSERT INTO dashboard_daily_summary (summary_date, new_users_count, new_buyers_count, purchase_count, deposit_total, direct_reward_total, team_reward_total, equal_level_reward_total, burn_total, claim_total)
VALUES
  (current_date - 14, 3, 2, 4, 45000, 6750, 109650, 580000, 42200, 5000),
  (current_date - 13, 1, 1, 2, 12000, 1800, 0, 0, 0, 0),
  (current_date - 12, 2, 1, 3, 28000, 4200, 0, 0, 0, 2000),
  (current_date - 11, 0, 0, 1, 5000, 750, 0, 0, 0, 0),
  (current_date - 10, 1, 1, 2, 15000, 2250, 0, 0, 0, 8000),
  (current_date - 9,  2, 2, 3, 35000, 5250, 0, 0, 0, 0),
  (current_date - 8,  1, 0, 1, 8000, 1200, 0, 0, 0, 3000),
  (current_date - 7,  3, 2, 5, 55000, 8250, 115750, 605000, 47250, 10000),
  (current_date - 6,  0, 1, 2, 20000, 3000, 0, 0, 0, 0),
  (current_date - 5,  1, 1, 3, 18000, 2700, 0, 0, 0, 5000),
  (current_date - 4,  2, 1, 2, 10000, 1500, 0, 0, 0, 0),
  (current_date - 3,  1, 0, 1, 3000, 450, 0, 0, 0, 2000),
  (current_date - 2,  3, 2, 4, 42000, 6300, 0, 0, 0, 0),
  (current_date - 1,  2, 1, 3, 25000, 3750, 0, 0, 0, 7000);
