-- =============================================================================
-- base.sql  --  Staging seed: default config versions
--
-- Mirrors the 14 config keys from @posx/config buildDefaultConfigRows().
-- Uses the actual apply_scope enum values from 0040_config_content.sql.
-- Token price adjusted to $0.10 for staging (vs $0.0618 local dev).
--
-- Idempotent: DELETE + re-INSERT.
-- =============================================================================

-- ---- clean slate ----
DELETE FROM config_change_history WHERE TRUE;
DELETE FROM config_versions WHERE TRUE;

-- ---- 1. pricing.token_price ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'pricing', 'token_price', 1,
   '{"token_price": "0.10", "currency": "USDT"}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: POSX sale price $0.10 per token');

-- ---- 2. purchase_rules.minimum_purchase_amount ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'purchase_rules', 'minimum_purchase_amount', 1,
   '{"minimum_purchase_amount": "1000", "currency": "USDT"}',
   '2025-01-01T00:00:00Z', 'new_orders_only', 'active', null,
   'Staging seed: min purchase 1000 USDT');

-- ---- 3. purchase_rules.quick_amount_options ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'purchase_rules', 'quick_amount_options', 1,
   '{"options": ["1000", "5000", "10000", "50000"]}',
   '2025-01-01T00:00:00Z', 'all_users', 'active', null,
   'Staging seed: frontend quick-amount buttons');

-- ---- 4. qualification_rules.reward_minimums ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'qualification_rules', 'reward_minimums', 1,
   '{"reward_min_deposit_threshold": "1000", "reward_min_holding_threshold": "1000"}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: reward eligibility thresholds');

-- ---- 5. tier_rules.tier_definitions ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'tier_rules', 'tier_definitions', 1,
   '{"tiers": [
      {"tier_code": "basic",    "display_name": "Basic",    "holding_min": "5000",   "holding_max": "49999.999999999999999999", "deposit_min": "1000", "direct_rate": "0.05", "team_eligible": false},
      {"tier_code": "advanced", "display_name": "Advanced", "holding_min": "50000",  "holding_max": "199999.999999999999999999", "deposit_min": "1000", "direct_rate": "0.10", "team_eligible": true},
      {"tier_code": "elite",    "display_name": "Elite",    "holding_min": "200000", "holding_max": null, "deposit_min": "1000", "direct_rate": "0.15", "team_eligible": true}
    ]}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: 3 tiers at 5k/50k/200k cumulative deposit');

-- ---- 6. team_reward_rules.effective_depth ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'team_reward_rules', 'effective_depth', 1,
   '{"effective_level_start": 2, "effective_level_end": 7}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: team depth range levels 2-7');

-- ---- 7. team_reward_rules.team_ladders ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'team_reward_rules', 'team_ladders', 1,
   '{"ladders": {
      "advanced": [
        {"performance_min": "1",       "performance_max": "100000",  "team_rate": "0.05"},
        {"performance_min": "100001",  "performance_max": "500000",  "team_rate": "0.10"},
        {"performance_min": "500001",  "performance_max": null,      "team_rate": "0.15"}
      ],
      "elite": [
        {"performance_min": "1",       "performance_max": "100000",  "team_rate": "0.05"},
        {"performance_min": "100001",  "performance_max": "500000",  "team_rate": "0.10"},
        {"performance_min": "500001",  "performance_max": "2000000", "team_rate": "0.20"},
        {"performance_min": "2000001", "performance_max": null,      "team_rate": "0.25"}
      ]
    },
    "max_team_rate": "0.25"}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: team ladders 5%-25%');

-- ---- 8. equal_level_rules.equal_level_policy ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'equal_level_rules', 'equal_level_policy', 1,
   '{"equal_level_rate": "1.00", "subordinate_team_performance_threshold": "100000", "replacement_enabled": true}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: equal-level rate 100%');

-- ---- 9. burn_rules.burn_policy ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'burn_rules', 'burn_policy', 1,
   '{"burn_cap_multiplier": "3", "cap_basis": "holding_value", "applies_to": ["team", "equal_level"], "excludes": ["direct"]}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: burn cap 3x holding');

-- ---- 10. vesting_rules.vesting_policy ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'vesting_rules', 'vesting_policy', 1,
   '{"lock_days": 90, "release_days": 365, "mode": "lot_based"}',
   '2025-01-01T00:00:00Z', 'new_orders_only', 'active', null,
   'Staging seed: 90-day lock + 365-day linear vesting');

-- ---- 11. claim_rules.claim_policy ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'claim_rules', 'claim_policy', 1,
   '{"min_claim_amount": "10", "claim_scope_default": "claim_all", "allow_claim_by_type": true, "pending_signature_ttl_minutes": 30}',
   '2025-01-01T00:00:00Z', 'next_settlement_day', 'active', null,
   'Staging seed: min claim 10 USDT');

-- ---- 12. display_rules.enabled_languages ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'display_rules', 'enabled_languages', 1,
   '{"languages": ["zh-CN", "zh-TW", "en", "ko"]}',
   '2025-01-01T00:00:00Z', 'all_users', 'active', null,
   'Staging seed: supported UI locales');

-- ---- 13. sync_rules.chain_sync_policy ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'sync_rules', 'chain_sync_policy', 1,
   '{"min_confirmations": 12, "scan_batch_size": 500, "reorg_safety_window": 20}',
   '2025-01-01T00:00:00Z', 'all_users', 'active', null,
   'Staging seed: chain sync parameters');

-- ---- 14. system_limits.pagination_defaults ----
INSERT INTO config_versions
  (id, config_group, config_key, version_no, config_value, effective_from, apply_scope, status, created_by_admin_id, description)
VALUES
  (gen_random_uuid(), 'system_limits', 'pagination_defaults', 1,
   '{"default_page_size": 20, "max_page_size": 100}',
   '2025-01-01T00:00:00Z', 'all_users', 'active', null,
   'Staging seed: pagination defaults');
