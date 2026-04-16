-- =============================================================================
-- 0060_vesting.sql
--
-- Vesting tables (03 §11).
--
-- One lot per confirmed purchase (01 §9.1). Weighted-average merging
-- is forbidden. `user_vesting_summary` is a rebuildable derived cache
-- and must not be hand-seeded as business truth.
-- =============================================================================

-- -------- vesting_lots --------
create table if not exists vesting_lots (
  id                      uuid           primary key default gen_random_uuid(),
  wallet_address          text           not null references users(wallet_address),
  purchase_id             uuid           not null unique references purchases(id),
  total_locked            numeric(38,18) not null,
  start_time              timestamptz    not null,
  lock_days               integer        not null,
  release_days            integer        not null,
  released_amount         numeric(38,18) not null default 0,
  withdrawable_amount     numeric(38,18) not null default 0,
  withdrawn_amount        numeric(38,18) not null default 0,
  status                  text           not null default 'active',
  created_at              timestamptz    not null default now(),
  updated_at              timestamptz    not null default now(),
  constraint vesting_lots_status_check
    check (status in ('active','completed','voided')),
  constraint vesting_lots_lock_days_non_negative check (lock_days >= 0),
  constraint vesting_lots_release_days_positive check (release_days > 0),
  constraint vesting_lots_amounts_non_negative check (
    total_locked         >= 0 and
    released_amount      >= 0 and
    withdrawable_amount  >= 0 and
    withdrawn_amount     >= 0
  ),
  constraint vesting_lots_withdrawn_le_released
    check (withdrawn_amount <= released_amount),
  constraint vesting_lots_released_le_total_locked
    check (released_amount <= total_locked)
);

create index if not exists vesting_lots_wallet_address_idx
  on vesting_lots (wallet_address);
create index if not exists vesting_lots_start_time_idx
  on vesting_lots (start_time);
create index if not exists vesting_lots_status_idx
  on vesting_lots (status);

drop trigger if exists vesting_lots_set_updated_at on vesting_lots;
create trigger vesting_lots_set_updated_at
  before update on vesting_lots
  for each row
  execute function trigger_set_updated_at();

-- -------- user_vesting_summary (derived cache) --------
-- DERIVED TABLE. Rebuilt from `vesting_lots` by a rebuild job. Must
-- NEVER be hand-seeded as business truth (13 §25.2, repo README).
create table if not exists user_vesting_summary (
  wallet_address         text           primary key references users(wallet_address),
  total_locked           numeric(38,18) not null default 0,
  total_released         numeric(38,18) not null default 0,
  total_withdrawable     numeric(38,18) not null default 0,
  total_withdrawn        numeric(38,18) not null default 0,
  updated_at             timestamptz    not null default now(),
  constraint user_vesting_summary_amounts_non_negative check (
    total_locked       >= 0 and
    total_released     >= 0 and
    total_withdrawable >= 0 and
    total_withdrawn    >= 0
  )
);

drop trigger if exists user_vesting_summary_set_updated_at on user_vesting_summary;
create trigger user_vesting_summary_set_updated_at
  before update on user_vesting_summary
  for each row
  execute function trigger_set_updated_at();
