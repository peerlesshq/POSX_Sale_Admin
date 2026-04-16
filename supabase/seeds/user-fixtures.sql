-- =============================================================================
-- user-fixtures.sql  --  Staging seed: 20 user scenarios
--
-- Wallet addresses: 0x00000000000000000000000000000000000ffXXX
-- Deterministic UUIDs for cross-table refs: u0000XXX-0000-0000-0000-000000000001
--   (purchase_orders use b0000XXX-, purchases use bf000XXX-, vesting ce000XXX-,
--    claim_orders use dc000XXX-)
--
-- FK ordering: users -> referral_bindings -> purchase_orders -> purchases ->
--   vesting_lots -> claim_orders -> claim_records
--
-- Idempotent: delete children first, insert parents first.
-- =============================================================================

-- ============================================================
-- Clean slate (children before parents)
-- ============================================================
DELETE FROM claim_records WHERE TRUE;
DELETE FROM claim_order_items WHERE TRUE;
DELETE FROM claim_orders WHERE TRUE;
DELETE FROM vesting_lots WHERE TRUE;
DELETE FROM purchases WHERE TRUE;
DELETE FROM purchase_orders WHERE TRUE;
DELETE FROM referral_closure WHERE TRUE;
DELETE FROM referral_bindings WHERE TRUE;
DELETE FROM referral_pending_captures WHERE TRUE;
DELETE FROM users WHERE TRUE;

-- ============================================================
-- Users (20 scenarios)
-- ============================================================
-- Wallet mapping:
--   01 = normal_active       02 = rewards_heavy      03 = no_rewards
--   04 = suspended_user      05 = blacklisted_user   06 = restricted_purchase
--   07 = restricted_claim    08 = pending_purchase    09 = confirmed_purchase
--   10 = failed_purchase     11 = queued_claim        12 = failed_claim
--   13 = finalized_claim     14 = team_leader         15 = no_inviter (root)
--   16 = new_user            17 = whale_user          18 = burn_affected
--   19 = vesting_partial     20 = multi_purchase

INSERT INTO users (wallet_address, status, created_at, first_purchase_at, status_changed_at, status_reason)
VALUES
  ('0x00000000000000000000000000000000000ff001', 'active',              now() - interval '60 days', now() - interval '55 days', null, null),
  ('0x00000000000000000000000000000000000ff002', 'active',              now() - interval '90 days', now() - interval '85 days', null, null),
  ('0x00000000000000000000000000000000000ff003', 'active',              now() - interval '45 days', now() - interval '40 days', null, null),
  ('0x00000000000000000000000000000000000ff004', 'suspended',           now() - interval '80 days', now() - interval '75 days', now() - interval '7 days', 'compliance review'),
  ('0x00000000000000000000000000000000000ff005', 'blacklisted',         now() - interval '70 days', now() - interval '65 days', now() - interval '6 days', 'ToS violation'),
  ('0x00000000000000000000000000000000000ff006', 'restricted_purchase', now() - interval '50 days', now() - interval '45 days', now() - interval '10 days', 'KYC pending'),
  ('0x00000000000000000000000000000000000ff007', 'restricted_claim',    now() - interval '40 days', now() - interval '35 days', now() - interval '5 days', 'AML hold'),
  ('0x00000000000000000000000000000000000ff008', 'active',              now() - interval '30 days', null, null, null),
  ('0x00000000000000000000000000000000000ff009', 'active',              now() - interval '50 days', now() - interval '45 days', null, null),
  ('0x00000000000000000000000000000000000ff010', 'active',              now() - interval '25 days', null, null, null),
  ('0x00000000000000000000000000000000000ff011', 'active',              now() - interval '35 days', now() - interval '30 days', null, null),
  ('0x00000000000000000000000000000000000ff012', 'active',              now() - interval '33 days', now() - interval '28 days', null, null),
  ('0x00000000000000000000000000000000000ff013', 'active',              now() - interval '50 days', now() - interval '45 days', null, null),
  ('0x00000000000000000000000000000000000ff014', 'active',              now() - interval '100 days', now() - interval '95 days', null, null),
  ('0x00000000000000000000000000000000000ff015', 'active',              now() - interval '120 days', now() - interval '115 days', null, null),
  ('0x00000000000000000000000000000000000ff016', 'active',              now(), null, null, null),
  ('0x00000000000000000000000000000000000ff017', 'active',              now() - interval '75 days', now() - interval '70 days', null, null),
  ('0x00000000000000000000000000000000000ff018', 'active',              now() - interval '55 days', now() - interval '50 days', null, null),
  ('0x00000000000000000000000000000000000ff019', 'active',              now() - interval '200 days', now() - interval '195 days', null, null),
  ('0x00000000000000000000000000000000000ff020', 'active',              now() - interval '40 days', now() - interval '35 days', null, null);

-- ============================================================
-- Referral bindings
-- ============================================================
-- 15 = no_inviter (root), 14 = team_leader (root)
-- 01 -> 15,  02 -> 15,  03 -> 14,  08 -> 14,  09 -> 14,
-- 10 -> 14,  11 -> 14,  13 -> 02,  17 -> 15,  18 -> 02,
-- 19 -> 15,  20 -> 14

INSERT INTO referral_bindings (child_wallet_address, parent_wallet_address, binding_source, bound_at, is_locked)
VALUES
  ('0x00000000000000000000000000000000000ff001', '0x00000000000000000000000000000000000ff015', 'referral_link', now() - interval '55 days', true),
  ('0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff015', 'referral_link', now() - interval '85 days', true),
  ('0x00000000000000000000000000000000000ff003', '0x00000000000000000000000000000000000ff014', 'referral_link', now() - interval '40 days', true),
  ('0x00000000000000000000000000000000000ff008', '0x00000000000000000000000000000000000ff014', 'referral_link', now() - interval '28 days', true),
  ('0x00000000000000000000000000000000000ff009', '0x00000000000000000000000000000000000ff014', 'referral_link', now() - interval '45 days', true),
  ('0x00000000000000000000000000000000000ff010', '0x00000000000000000000000000000000000ff014', 'referral_link', now() - interval '20 days', true),
  ('0x00000000000000000000000000000000000ff011', '0x00000000000000000000000000000000000ff014', 'referral_link', now() - interval '30 days', true),
  ('0x00000000000000000000000000000000000ff013', '0x00000000000000000000000000000000000ff002', 'referral_link', now() - interval '45 days', true),
  ('0x00000000000000000000000000000000000ff017', '0x00000000000000000000000000000000000ff015', 'referral_link', now() - interval '70 days', true),
  ('0x00000000000000000000000000000000000ff018', '0x00000000000000000000000000000000000ff002', 'referral_link', now() - interval '50 days', true),
  ('0x00000000000000000000000000000000000ff019', '0x00000000000000000000000000000000000ff015', 'referral_link', now() - interval '195 days', true),
  ('0x00000000000000000000000000000000000ff020', '0x00000000000000000000000000000000000ff014', 'referral_link', now() - interval '35 days', true);

-- Closure rows (depth-1 only for brevity; covers direct parent lookups)
INSERT INTO referral_closure (ancestor_wallet_address, descendant_wallet_address, depth)
VALUES
  ('0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff001', 1),
  ('0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff002', 1),
  ('0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff003', 1),
  ('0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff008', 1),
  ('0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff009', 1),
  ('0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff010', 1),
  ('0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff011', 1),
  ('0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff013', 1),
  ('0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff013', 2),
  ('0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff017', 1),
  ('0x00000000000000000000000000000000000ff002', '0x00000000000000000000000000000000000ff018', 1),
  ('0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff018', 2),
  ('0x00000000000000000000000000000000000ff015', '0x00000000000000000000000000000000000ff019', 1),
  ('0x00000000000000000000000000000000000ff014', '0x00000000000000000000000000000000000ff020', 1);

-- ============================================================
-- Purchase orders + purchases
-- ============================================================
-- Deterministic IDs: purchase_orders = b0000XXX, purchases = bf000XXX

-- 01 normal_active: 10k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff001', 'stg_ord_001', 'confirmed', 10000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '55 days', now() - interval '55 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff001', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000001', 30000001, 0, 10000, 100000, 0.10, now() - interval '55 days');

-- 02 rewards_heavy: 300k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', 'stg_ord_002', 'confirmed', 300000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '85 days', now() - interval '85 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000002-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000002', 30000010, 0, 300000, 3000000, 0.10, now() - interval '85 days');

-- 03 no_rewards: 2k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000003-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff003', 'stg_ord_003', 'confirmed', 2000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '40 days', now() - interval '40 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000003-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff003', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000003', 30000020, 0, 2000, 20000, 0.10, now() - interval '40 days');

-- 08 pending_purchase: 5k pending
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, created_at)
VALUES ('b0000008-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff008', 'stg_ord_008', 'purchase_pending', 5000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '2 days');

-- 09 confirmed_purchase: 15k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000009-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff009', 'stg_ord_009', 'confirmed', 15000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '45 days', now() - interval '45 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000009-0000-0000-0000-000000000001', 'b0000009-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff009', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000009', 30000050, 0, 15000, 150000, 0.10, now() - interval '45 days');

-- 10 failed_purchase: 3k failed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, failure_reason, created_at)
VALUES ('b0000010-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff010', 'stg_ord_010', 'failed', 3000, 0.10, 56, '0x0000000000000000000000000000000000000001', 'tx reverted: insufficient allowance', now() - interval '20 days');

-- 11 queued_claim user: 8k confirmed purchase
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000011-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff011', 'stg_ord_011', 'confirmed', 8000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '30 days', now() - interval '30 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000011-0000-0000-0000-000000000001', 'b0000011-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff011', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000011', 30000060, 0, 8000, 80000, 0.10, now() - interval '30 days');

-- 13 finalized_claim: 12k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000013-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', 'stg_ord_013', 'confirmed', 12000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '45 days', now() - interval '45 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000013-0000-0000-0000-000000000001', 'b0000013-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000013', 30000070, 0, 12000, 120000, 0.10, now() - interval '45 days');

-- 14 team_leader: 80k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000014-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', 'stg_ord_014', 'confirmed', 80000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '95 days', now() - interval '95 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000014-0000-0000-0000-000000000001', 'b0000014-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000014', 30000080, 0, 80000, 800000, 0.10, now() - interval '95 days');

-- 15 no_inviter (root): 100k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000015-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', 'stg_ord_015', 'confirmed', 100000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '115 days', now() - interval '115 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000015-0000-0000-0000-000000000001', 'b0000015-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000015', 30000090, 0, 100000, 1000000, 0.10, now() - interval '115 days');

-- 17 whale_user: 500k confirmed
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000017-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff017', 'stg_ord_017', 'confirmed', 500000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '70 days', now() - interval '70 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000017-0000-0000-0000-000000000001', 'b0000017-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff017', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000017', 30000100, 0, 500000, 5000000, 0.10, now() - interval '70 days');

-- 18 burn_affected: 6k confirmed (small holding, triggers burn)
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000018-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff018', 'stg_ord_018', 'confirmed', 6000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '50 days', now() - interval '50 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000018-0000-0000-0000-000000000001', 'b0000018-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff018', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000018', 30000110, 0, 6000, 60000, 0.10, now() - interval '50 days');

-- 19 vesting_partial: 25k confirmed (old purchase, partial release)
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES ('b0000019-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff019', 'stg_ord_019', 'confirmed', 25000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '195 days', now() - interval '195 days');
INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000019-0000-0000-0000-000000000001', 'b0000019-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff019', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000019', 30000120, 0, 25000, 250000, 0.10, now() - interval '195 days');

-- 20 multi_purchase: 3 orders in different states
INSERT INTO purchase_orders (id, wallet_address, client_order_id, status, usdt_amount, token_price_snapshot, chain_id, contract_address, confirmed_at, created_at)
VALUES
  ('b0000020-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff020', 'stg_ord_020a', 'confirmed', 5000, 0.10, 56, '0x0000000000000000000000000000000000000001', now() - interval '35 days', now() - interval '35 days'),
  ('b0000020-0000-0000-0000-000000000002', '0x00000000000000000000000000000000000ff020', 'stg_ord_020b', 'purchase_pending', 10000, 0.10, 56, '0x0000000000000000000000000000000000000001', null, now() - interval '3 days'),
  ('b0000020-0000-0000-0000-000000000003', '0x00000000000000000000000000000000000ff020', 'stg_ord_020c', 'failed', 8000, 0.10, 56, '0x0000000000000000000000000000000000000001', null, now() - interval '10 days');

INSERT INTO purchases (id, purchase_order_id, wallet_address, chain_id, contract_address, tx_hash, block_number, log_index, usdt_amount, posx_amount, token_price_at_purchase, purchase_at)
VALUES ('bf000020-0000-0000-0000-000000000001', 'b0000020-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff020', 56, '0x0000000000000000000000000000000000000001', '0xaa00000000000000000000000000000000000000000000000000000000000020', 30000130, 0, 5000, 50000, 0.10, now() - interval '35 days');

-- ============================================================
-- Vesting lots (for users with confirmed purchases)
-- ============================================================
INSERT INTO vesting_lots (id, wallet_address, purchase_id, total_locked, start_time, lock_days, release_days, released_amount, withdrawable_amount, withdrawn_amount, status)
VALUES
  ('ce000001-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff001', 'bf000001-0000-0000-0000-000000000001', 100000, now() - interval '55 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000002-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff002', 'bf000002-0000-0000-0000-000000000001', 3000000, now() - interval '85 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000003-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff003', 'bf000003-0000-0000-0000-000000000001', 20000, now() - interval '40 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000009-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff009', 'bf000009-0000-0000-0000-000000000001', 150000, now() - interval '45 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000011-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff011', 'bf000011-0000-0000-0000-000000000001', 80000, now() - interval '30 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000013-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', 'bf000013-0000-0000-0000-000000000001', 120000, now() - interval '45 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000014-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff014', 'bf000014-0000-0000-0000-000000000001', 800000, now() - interval '95 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000015-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff015', 'bf000015-0000-0000-0000-000000000001', 1000000, now() - interval '115 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000017-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff017', 'bf000017-0000-0000-0000-000000000001', 5000000, now() - interval '70 days', 90, 365, 0, 0, 0, 'active'),
  ('ce000018-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff018', 'bf000018-0000-0000-0000-000000000001', 60000, now() - interval '50 days', 90, 365, 0, 0, 0, 'active'),
  -- 19 vesting_partial: 200 days old, past 90-day lock, ~110 days into 365-day release => ~30% released
  ('ce000019-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff019', 'bf000019-0000-0000-0000-000000000001', 250000, now() - interval '195 days', 90, 365, 75000, 75000, 0, 'active'),
  ('ce000020-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff020', 'bf000020-0000-0000-0000-000000000001', 50000, now() - interval '35 days', 90, 365, 0, 0, 0, 'active');

-- ============================================================
-- Claim orders (scenarios 11, 12, 13)
-- ============================================================

-- 11 queued_claim: claim in queued status
INSERT INTO claim_orders (id, wallet_address, client_request_id, status, claim_scope, requested_total_amount, queued_at, created_at)
VALUES ('dc000011-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff011', 'stg_claim_011', 'queued', 'claim_all', 50, now() - interval '1 day', now() - interval '1 day');

-- 12 failed_claim: claim that failed
INSERT INTO claim_orders (id, wallet_address, client_request_id, status, claim_scope, requested_total_amount, failed_at, failure_reason, created_at)
VALUES ('dc000012-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff012', 'stg_claim_012', 'failed', 'claim_all', 100, now() - interval '5 days', 'broadcast timeout: tx not mined within 30 min', now() - interval '5 days');

-- 13 finalized_claim: confirmed claim with claim_record
INSERT INTO claim_orders (id, wallet_address, client_request_id, status, claim_scope, requested_total_amount, broadcast_tx_hash, confirmed_at, created_at)
VALUES ('dc000013-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', 'stg_claim_013', 'confirmed', 'claim_all', 200, '0xdd00000000000000000000000000000000000000000000000000000000000013', now() - interval '10 days', now() - interval '12 days');

INSERT INTO claim_records (id, claim_order_id, wallet_address, amount, tx_hash, status, recorded_at)
VALUES (gen_random_uuid(), 'dc000013-0000-0000-0000-000000000001', '0x00000000000000000000000000000000000ff013', 200, '0xdd00000000000000000000000000000000000000000000000000000000000013', 'confirmed', now() - interval '10 days');
