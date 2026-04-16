-- =============================================================================
-- admin-fixtures.sql  --  Staging seed: admin accounts + audit logs
--
-- Password for all accounts: 'Staging2025!!'
-- Generate the bcrypt hash before running:
--   node -e "console.log(require('bcryptjs').hashSync('Staging2025!!', 12))"
-- Then replace the placeholder below with the real hash.
--
-- Idempotent: DELETE children first, then parents, then re-INSERT.
-- =============================================================================

-- ---- clean slate (FK order: children before parents) ----
DELETE FROM admin_sessions WHERE TRUE;
DELETE FROM admin_logs WHERE TRUE;
DELETE FROM admin_users WHERE TRUE;

-- ---- bcrypt hash for 'Staging2025!!' at cost 12 ----
-- Generated via: node -e "console.log(require('bcrypt').hashSync('Staging2025!!', 12))"
-- To rotate: generate a new hash and update this file, then run pnpm seed:staging

-- ============================================================
-- Admin users
-- ============================================================

INSERT INTO admin_users (id, email, name, password_hash, role, status, last_login_at, created_at)
VALUES
  ('a0000001-0000-0000-0000-000000000001',
   'superadmin@staging.local', 'Staging Super Admin',
   '$2b$12$/8maWPLW5KaJ730ubixuAOawk.JtO6nHGq9LTups9AFWVj3XLt.Y2',
   'super_admin', 'active',
   now() - interval '2 hours', now() - interval '90 days'),

  ('a0000002-0000-0000-0000-000000000002',
   'operator@staging.local', 'Staging Operator',
   '$2b$12$/8maWPLW5KaJ730ubixuAOawk.JtO6nHGq9LTups9AFWVj3XLt.Y2',
   'operator', 'active',
   now() - interval '5 hours', now() - interval '60 days'),

  ('a0000003-0000-0000-0000-000000000003',
   'viewer@staging.local', 'Staging Viewer',
   '$2b$12$/8maWPLW5KaJ730ubixuAOawk.JtO6nHGq9LTups9AFWVj3XLt.Y2',
   'viewer', 'active',
   now() - interval '1 day', now() - interval '30 days'),

  ('a0000004-0000-0000-0000-000000000004',
   'disabled@staging.local', 'Disabled Admin',
   '$2b$12$/8maWPLW5KaJ730ubixuAOawk.JtO6nHGq9LTups9AFWVj3XLt.Y2',
   'operator', 'disabled',
   null, now() - interval '120 days');

-- ============================================================
-- Admin audit logs (12 rows -- realistic QA mix)
-- ============================================================

INSERT INTO admin_logs (id, admin_user_id, action, target_type, target_id, detail, ip_address, created_at)
VALUES
  -- super_admin login/logout cycle
  (gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001',
   'login', 'admin_session', null,
   '{"method": "password"}', '10.0.1.10',
   now() - interval '14 days'),

  (gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001',
   'logout', 'admin_session', null,
   null, '10.0.1.10',
   now() - interval '14 days' + interval '4 hours'),

  -- super_admin creates config
  (gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001',
   'create_config', 'config_version', null,
   '{"config_group": "pricing", "config_key": "token_price", "version_no": 1}',
   '10.0.1.10', now() - interval '13 days'),

  -- operator login
  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002',
   'login', 'admin_session', null,
   '{"method": "password"}', '10.0.1.20',
   now() - interval '10 days'),

  -- operator triggers settlement
  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002',
   'trigger_settlement', 'settlement_job', null,
   '{"settlement_date": "2026-04-01", "mode": "official"}',
   '10.0.1.20', now() - interval '10 days' + interval '30 minutes'),

  -- operator updates user status
  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002',
   'update_user_status', 'user', '0x00000000000000000000000000000000000ff004',
   '{"old_status": "active", "new_status": "suspended", "reason": "compliance review"}',
   '10.0.1.20', now() - interval '7 days'),

  -- operator blacklists a user
  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002',
   'update_user_status', 'user', '0x00000000000000000000000000000000000ff005',
   '{"old_status": "active", "new_status": "blacklisted", "reason": "ToS violation"}',
   '10.0.1.20', now() - interval '6 days'),

  -- viewer login
  (gen_random_uuid(), 'a0000003-0000-0000-0000-000000000003',
   'login', 'admin_session', null,
   '{"method": "password"}', '10.0.1.30',
   now() - interval '3 days'),

  -- viewer logout
  (gen_random_uuid(), 'a0000003-0000-0000-0000-000000000003',
   'logout', 'admin_session', null,
   null, '10.0.1.30',
   now() - interval '3 days' + interval '2 hours'),

  -- super_admin disables the disabled admin
  (gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001',
   'update_admin_status', 'admin_user', 'a0000004-0000-0000-0000-000000000004',
   '{"old_status": "active", "new_status": "disabled", "reason": "role no longer needed"}',
   '10.0.1.10', now() - interval '5 days'),

  -- operator exports a report
  (gen_random_uuid(), 'a0000002-0000-0000-0000-000000000002',
   'export_report', 'report_export_job', null,
   '{"report_type": "user_rewards_summary", "format": "csv"}',
   '10.0.1.20', now() - interval '2 days'),

  -- super_admin recent login
  (gen_random_uuid(), 'a0000001-0000-0000-0000-000000000001',
   'login', 'admin_session', null,
   '{"method": "password"}', '10.0.1.10',
   now() - interval '2 hours');
