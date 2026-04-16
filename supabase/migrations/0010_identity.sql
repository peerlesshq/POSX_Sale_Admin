-- =============================================================================
-- 0010_identity.sql
--
-- Identity + access tables (03 §7).
-- Tables:
--   - users
--   - auth_nonces
--   - user_sessions
--   - admin_users
--   - admin_sessions
--
-- Wallet addresses are always persisted in lowercase; the check
-- constraints below enforce that plus the 0x + 40 hex-char format.
-- =============================================================================

-- -------- users --------
create table if not exists users (
  wallet_address              text        primary key,
  status                      text        not null default 'active',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  first_seen_at               timestamptz,
  first_authenticated_at      timestamptz,
  first_purchase_at           timestamptz,
  last_login_at               timestamptz,
  last_active_at              timestamptz,
  status_changed_at           timestamptz,
  status_reason               text,
  status_note                 text,
  constraint users_wallet_address_lowercase
    check (wallet_address = lower(wallet_address)),
  constraint users_wallet_address_format
    check (wallet_address ~ '^0x[a-f0-9]{40}$'),
  constraint users_status_check
    check (status in (
      'active','restricted_purchase','restricted_claim','suspended','blacklisted'
    ))
);

create index if not exists users_status_idx
  on users (status);
create index if not exists users_created_at_desc_idx
  on users (created_at desc);
create index if not exists users_first_purchase_at_desc_idx
  on users (first_purchase_at desc);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
  before update on users
  for each row
  execute function trigger_set_updated_at();

-- -------- auth_nonces --------
create table if not exists auth_nonces (
  id             bigserial    primary key,
  wallet_address text         not null,
  nonce          text         not null,
  expires_at     timestamptz  not null,
  used_at        timestamptz,
  created_at     timestamptz  not null default now(),
  constraint auth_nonces_wallet_address_lowercase
    check (wallet_address = lower(wallet_address)),
  constraint auth_nonces_wallet_address_format
    check (wallet_address ~ '^0x[a-f0-9]{40}$')
);

create unique index if not exists auth_nonces_nonce_unique_idx
  on auth_nonces (nonce);
create index if not exists auth_nonces_wallet_address_idx
  on auth_nonces (wallet_address);
create index if not exists auth_nonces_expires_at_idx
  on auth_nonces (expires_at);

-- -------- user_sessions --------
create table if not exists user_sessions (
  id                  uuid         primary key default gen_random_uuid(),
  wallet_address      text         not null references users(wallet_address),
  session_token_hash  text         not null,
  issued_at           timestamptz  not null,
  expires_at          timestamptz  not null,
  revoked_at          timestamptz,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz  not null default now()
);

create unique index if not exists user_sessions_token_hash_unique_idx
  on user_sessions (session_token_hash);
create index if not exists user_sessions_wallet_address_idx
  on user_sessions (wallet_address);
create index if not exists user_sessions_expires_at_idx
  on user_sessions (expires_at);

-- -------- admin_users --------
create table if not exists admin_users (
  id             uuid         primary key default gen_random_uuid(),
  email          text         not null unique,
  password_hash  text         not null,
  role           text         not null,
  name           text         not null,
  status         text         not null default 'active',
  last_login_at  timestamptz,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),
  constraint admin_users_role_check
    check (role in ('super_admin','operator','viewer')),
  constraint admin_users_status_check
    check (status in ('active','disabled'))
);

create index if not exists admin_users_role_idx
  on admin_users (role);
create index if not exists admin_users_status_idx
  on admin_users (status);

drop trigger if exists admin_users_set_updated_at on admin_users;
create trigger admin_users_set_updated_at
  before update on admin_users
  for each row
  execute function trigger_set_updated_at();

-- -------- admin_sessions --------
create table if not exists admin_sessions (
  id                  uuid         primary key default gen_random_uuid(),
  admin_user_id       uuid         not null references admin_users(id),
  session_token_hash  text         not null unique,
  issued_at           timestamptz  not null,
  expires_at          timestamptz  not null,
  revoked_at          timestamptz,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz  not null default now()
);

create index if not exists admin_sessions_admin_user_id_idx
  on admin_sessions (admin_user_id);
create index if not exists admin_sessions_expires_at_idx
  on admin_sessions (expires_at);
