-- =============================================================================
-- 0050_rewards_settlement.sql
--
-- Reward + settlement + claim + adjustment tables (03 §10).
--
-- Ordering within this file is significant because several tables have
-- foreign keys onto `claim_orders`. We create:
--   1. settlement_jobs
--   2. direct_rewards
--   3. claim_orders
--   4. team_rewards_daily            (FKs → settlement_jobs, claim_orders)
--   5. team_reward_line_details      (FK → team_rewards_daily)
--   6. equal_level_rewards_daily     (FKs → settlement_jobs, claim_orders)
--   7. burn_records
--   8. adjustment_records            (FK → settlement_jobs)
--   9. claim_order_items             (FK → claim_orders)
--  10. claim_records                 (FK → claim_orders)
--
-- Burn semantics are in 01 §8. Direct rewards are chain facts and are
-- never burned (01 §5.3). Burn records only ever reference
-- team_rewards_daily or equal_level_rewards_daily (03 §10.6).
-- =============================================================================

-- -------- settlement_jobs --------
create table if not exists settlement_jobs (
  id                          uuid           primary key default gen_random_uuid(),
  job_type                    text           not null,
  settlement_date             date           not null,
  mode                        text           not null,
  status                      text           not null,
  config_version_snapshot     jsonb          not null,
  started_at                  timestamptz    not null,
  finished_at                 timestamptz,
  triggered_by_admin_id       uuid           references admin_users(id),
  reason                      text,
  processed_user_count        integer        not null default 0,
  created_snapshot_count      integer        not null default 0,
  created_adjustment_count    integer        not null default 0,
  error_count                 integer        not null default 0,
  error_sample                jsonb,
  created_at                  timestamptz    not null default now(),
  constraint settlement_jobs_job_type_check
    check (job_type in ('daily_settlement','recompute','backfill')),
  constraint settlement_jobs_mode_check check (mode in (
    'official','backfill','recompute_preview','recompute_apply_adjustment'
  )),
  constraint settlement_jobs_status_check check (status in (
    'running','completed','failed','partial','cancelled'
  )),
  constraint settlement_jobs_counts_non_negative check (
    processed_user_count   >= 0 and
    created_snapshot_count >= 0 and
    created_adjustment_count >= 0 and
    error_count            >= 0
  )
);

create index if not exists settlement_jobs_date_type_idx
  on settlement_jobs (settlement_date desc, job_type);
create index if not exists settlement_jobs_status_idx
  on settlement_jobs (status);
create index if not exists settlement_jobs_created_at_desc_idx
  on settlement_jobs (created_at desc);

-- -------- direct_rewards --------
-- Chain-backed direct reward facts (01 §5). Never burned.
create table if not exists direct_rewards (
  id                    uuid           primary key default gen_random_uuid(),
  from_wallet_address   text           not null references users(wallet_address),
  to_wallet_address     text           not null references users(wallet_address),
  purchase_id           uuid           references purchases(id),
  chain_id              bigint         not null,
  tx_hash               text           not null,
  block_number          bigint         not null,
  reward_rate           numeric(10,8),
  purchase_amount       numeric(38,18) not null,
  reward_amount         numeric(38,18) not null,
  rewarded_at           timestamptz    not null,
  created_at            timestamptz    not null default now(),
  constraint direct_rewards_purchase_amount_non_negative
    check (purchase_amount >= 0),
  constraint direct_rewards_reward_amount_non_negative
    check (reward_amount >= 0)
);

create unique index if not exists direct_rewards_chain_tx_to_purchase_unique_idx
  on direct_rewards (chain_id, tx_hash, to_wallet_address, coalesce(purchase_id::text, ''));
create index if not exists direct_rewards_to_wallet_idx
  on direct_rewards (to_wallet_address);
create index if not exists direct_rewards_from_wallet_idx
  on direct_rewards (from_wallet_address);
create index if not exists direct_rewards_rewarded_at_desc_idx
  on direct_rewards (rewarded_at desc);

-- -------- claim_orders --------
create table if not exists claim_orders (
  id                      uuid           primary key default gen_random_uuid(),
  wallet_address          text           not null references users(wallet_address),
  client_request_id       text           not null,
  status                  text           not null,
  claim_scope             text           not null default 'claim_all',
  requested_total_amount  numeric(38,18) not null default 0,
  signed_message          text,
  signed_at               timestamptz,
  queued_at               timestamptz,
  broadcast_tx_hash       text,
  broadcasted_at          timestamptz,
  confirmed_at            timestamptz,
  failed_at               timestamptz,
  failure_reason          text,
  created_at              timestamptz    not null default now(),
  updated_at              timestamptz    not null default now(),
  constraint claim_orders_status_check check (status in (
    'pending_signature','queued','broadcasted','confirmed','failed','cancelled'
  )),
  constraint claim_orders_scope_check
    check (claim_scope in ('claim_all','claim_by_type')),
  constraint claim_orders_requested_total_non_negative
    check (requested_total_amount >= 0)
);

create unique index if not exists claim_orders_wallet_client_request_unique_idx
  on claim_orders (wallet_address, client_request_id);
create unique index if not exists claim_orders_broadcast_tx_hash_unique_idx
  on claim_orders (broadcast_tx_hash)
  where broadcast_tx_hash is not null;
create index if not exists claim_orders_wallet_address_idx
  on claim_orders (wallet_address);
create index if not exists claim_orders_status_idx
  on claim_orders (status);
create index if not exists claim_orders_created_at_desc_idx
  on claim_orders (created_at desc);

drop trigger if exists claim_orders_set_updated_at on claim_orders;
create trigger claim_orders_set_updated_at
  before update on claim_orders
  for each row
  execute function trigger_set_updated_at();

-- -------- team_rewards_daily --------
create table if not exists team_rewards_daily (
  id                          uuid           primary key default gen_random_uuid(),
  settlement_job_id           uuid           not null references settlement_jobs(id),
  wallet_address              text           not null references users(wallet_address),
  settle_date                 date           not null,
  qualification_tier          text           not null,
  user_team_rate              numeric(10,8)  not null,
  team_total_performance      numeric(38,18) not null default 0,
  effective_performance       numeric(38,18) not null default 0,
  raw_total                   numeric(38,18) not null default 0,
  burned_amount               numeric(38,18) not null default 0,
  actual_total                numeric(38,18) not null default 0,
  status                      text           not null,
  claim_tx_hash               text,
  claim_order_id              uuid           references claim_orders(id),
  created_at                  timestamptz    not null default now(),
  updated_at                  timestamptz    not null default now(),
  constraint team_rewards_daily_status_check
    check (status in ('claimable','claimed','offset','voided')),
  constraint team_rewards_daily_amounts_non_negative check (
    team_total_performance >= 0 and
    effective_performance  >= 0 and
    raw_total              >= 0 and
    burned_amount          >= 0 and
    actual_total           >= 0
  ),
  constraint team_rewards_daily_burn_reconciliation
    check (actual_total + burned_amount = raw_total)
);

create unique index if not exists team_rewards_daily_wallet_date_job_unique_idx
  on team_rewards_daily (wallet_address, settle_date, settlement_job_id);
create index if not exists team_rewards_daily_wallet_date_desc_idx
  on team_rewards_daily (wallet_address, settle_date desc);
create index if not exists team_rewards_daily_status_idx
  on team_rewards_daily (status);
create index if not exists team_rewards_daily_claim_order_id_idx
  on team_rewards_daily (claim_order_id);

drop trigger if exists team_rewards_daily_set_updated_at on team_rewards_daily;
create trigger team_rewards_daily_set_updated_at
  before update on team_rewards_daily
  for each row
  execute function trigger_set_updated_at();

-- -------- team_reward_line_details --------
create table if not exists team_reward_line_details (
  id                            uuid           primary key default gen_random_uuid(),
  team_reward_daily_id          uuid           not null
    references team_rewards_daily(id) on delete cascade,
  line_root_wallet_address      text           not null references users(wallet_address),
  line_effective_performance    numeric(38,18) not null default 0,
  subordinate_team_rate         numeric(10,8)  not null default 0,
  differential_rate             numeric(10,8)  not null default 0,
  raw_reward_amount             numeric(38,18) not null default 0,
  equal_level_replaced          boolean        not null default false,
  created_at                    timestamptz    not null default now(),
  constraint team_reward_line_details_amounts_non_negative check (
    line_effective_performance >= 0 and
    raw_reward_amount          >= 0
  )
);

create index if not exists team_reward_line_details_daily_id_idx
  on team_reward_line_details (team_reward_daily_id);
create index if not exists team_reward_line_details_line_root_idx
  on team_reward_line_details (line_root_wallet_address);

-- -------- equal_level_rewards_daily --------
create table if not exists equal_level_rewards_daily (
  id                                    uuid           primary key default gen_random_uuid(),
  settlement_job_id                     uuid           not null references settlement_jobs(id),
  wallet_address                        text           not null references users(wallet_address),
  line_root_wallet_address              text           not null references users(wallet_address),
  settle_date                           date           not null,
  equal_level_rate                      numeric(10,8)  not null,
  subordinate_team_total_performance    numeric(38,18) not null default 0,
  line_effective_performance            numeric(38,18) not null default 0,
  raw_amount                            numeric(38,18) not null default 0,
  burned_amount                         numeric(38,18) not null default 0,
  actual_amount                         numeric(38,18) not null default 0,
  status                                text           not null,
  claim_order_id                        uuid           references claim_orders(id),
  claim_tx_hash                         text,
  created_at                            timestamptz    not null default now(),
  updated_at                            timestamptz    not null default now(),
  constraint equal_level_rewards_daily_status_check
    check (status in ('claimable','claimed','offset','voided')),
  constraint equal_level_rewards_daily_amounts_non_negative check (
    subordinate_team_total_performance >= 0 and
    line_effective_performance          >= 0 and
    raw_amount                          >= 0 and
    burned_amount                       >= 0 and
    actual_amount                       >= 0
  ),
  constraint equal_level_rewards_daily_burn_reconciliation
    check (actual_amount + burned_amount = raw_amount)
);

create unique index if not exists equal_level_rewards_wallet_line_date_job_unique_idx
  on equal_level_rewards_daily (
    wallet_address, line_root_wallet_address, settle_date, settlement_job_id
  );
create index if not exists equal_level_rewards_wallet_date_desc_idx
  on equal_level_rewards_daily (wallet_address, settle_date desc);
create index if not exists equal_level_rewards_line_root_idx
  on equal_level_rewards_daily (line_root_wallet_address);
create index if not exists equal_level_rewards_status_idx
  on equal_level_rewards_daily (status);
create index if not exists equal_level_rewards_claim_order_id_idx
  on equal_level_rewards_daily (claim_order_id);

drop trigger if exists equal_level_rewards_daily_set_updated_at on equal_level_rewards_daily;
create trigger equal_level_rewards_daily_set_updated_at
  before update on equal_level_rewards_daily
  for each row
  execute function trigger_set_updated_at();

-- -------- burn_records --------
create table if not exists burn_records (
  id                            uuid           primary key default gen_random_uuid(),
  wallet_address                text           not null references users(wallet_address),
  reward_type                   text           not null,
  source_snapshot_id            uuid           not null,
  source_table                  text           not null,
  settle_date                   date           not null,
  holding_value_at_snapshot     numeric(38,18) not null,
  used_burn_capacity_before     numeric(38,18) not null,
  burn_cap                      numeric(38,18) not null,
  raw_amount                    numeric(38,18) not null,
  burned_amount                 numeric(38,18) not null,
  actual_amount                 numeric(38,18) not null,
  reason                        text           not null,
  created_at                    timestamptz    not null default now(),
  constraint burn_records_reward_type_check
    check (reward_type in ('team','equal_level')),
  constraint burn_records_source_table_check
    check (source_table in ('team_rewards_daily','equal_level_rewards_daily')),
  constraint burn_records_amounts_non_negative check (
    holding_value_at_snapshot >= 0 and
    used_burn_capacity_before >= 0 and
    burn_cap                  >= 0 and
    raw_amount                >= 0 and
    burned_amount             >= 0 and
    actual_amount             >= 0
  ),
  constraint burn_records_burn_reconciliation
    check (actual_amount + burned_amount = raw_amount)
);

create index if not exists burn_records_wallet_address_idx
  on burn_records (wallet_address);
create index if not exists burn_records_settle_date_desc_idx
  on burn_records (settle_date desc);
create index if not exists burn_records_reward_type_idx
  on burn_records (reward_type);
create index if not exists burn_records_source_table_snapshot_idx
  on burn_records (source_table, source_snapshot_id);

-- -------- adjustment_records --------
create table if not exists adjustment_records (
  id                      uuid           primary key default gen_random_uuid(),
  wallet_address          text           not null references users(wallet_address),
  settlement_job_id       uuid           references settlement_jobs(id),
  adjustment_type         text           not null,
  direction               text           not null,
  amount                  numeric(38,18) not null,
  remaining_amount        numeric(38,18) not null,
  settle_date             date,
  source_table            text,
  source_snapshot_id      uuid,
  reason                  text           not null,
  status                  text           not null,
  created_by_admin_id     uuid           references admin_users(id),
  created_at              timestamptz    not null default now(),
  updated_at              timestamptz    not null default now(),
  constraint adjustment_records_type_check
    check (adjustment_type in (
      'recompute_diff','purchase_reversal_offset','manual_financial_correction'
    )),
  constraint adjustment_records_direction_check
    check (direction in ('credit','debit')),
  constraint adjustment_records_status_check
    check (status in ('active','fully_offset','voided')),
  constraint adjustment_records_amounts_non_negative
    check (amount >= 0 and remaining_amount >= 0),
  constraint adjustment_records_remaining_le_amount
    check (remaining_amount <= amount)
);

create index if not exists adjustment_records_wallet_address_idx
  on adjustment_records (wallet_address);
create index if not exists adjustment_records_status_idx
  on adjustment_records (status);
create index if not exists adjustment_records_created_at_desc_idx
  on adjustment_records (created_at desc);
create index if not exists adjustment_records_source_idx
  on adjustment_records (source_table, source_snapshot_id);

drop trigger if exists adjustment_records_set_updated_at on adjustment_records;
create trigger adjustment_records_set_updated_at
  before update on adjustment_records
  for each row
  execute function trigger_set_updated_at();

-- -------- claim_order_items --------
-- Locks specific reward snapshots (or adjustment credits) to a claim
-- order. Source integrity is enforced through the value check on
-- `source_table`; partial unique enforcement of "one live lock per
-- snapshot" is delegated to the application layer because SQL cannot
-- express it without explicit lock state columns on the source tables.
create table if not exists claim_order_items (
  id                     uuid           primary key default gen_random_uuid(),
  claim_order_id         uuid           not null
    references claim_orders(id) on delete cascade,
  reward_type            text           not null,
  source_table           text           not null,
  source_snapshot_id     uuid           not null,
  amount                 numeric(38,18) not null,
  created_at             timestamptz    not null default now(),
  constraint claim_order_items_reward_type_check
    check (reward_type in ('team','equal_level','adjustment_credit')),
  constraint claim_order_items_source_table_check check (
    source_table in ('team_rewards_daily','equal_level_rewards_daily','adjustment_records')
  ),
  constraint claim_order_items_amount_non_negative
    check (amount >= 0)
);

create index if not exists claim_order_items_claim_order_id_idx
  on claim_order_items (claim_order_id);
create index if not exists claim_order_items_source_idx
  on claim_order_items (source_table, source_snapshot_id);

-- -------- claim_records --------
create table if not exists claim_records (
  id                     uuid           primary key default gen_random_uuid(),
  claim_order_id         uuid           not null references claim_orders(id),
  wallet_address         text           not null references users(wallet_address),
  amount                 numeric(38,18) not null,
  tx_hash                text,
  status                 text           not null,
  recorded_at            timestamptz    not null default now(),
  created_at             timestamptz    not null default now(),
  constraint claim_records_status_check
    check (status in ('confirmed','failed')),
  constraint claim_records_amount_non_negative
    check (amount >= 0)
);

create index if not exists claim_records_wallet_address_idx
  on claim_records (wallet_address);
create index if not exists claim_records_claim_order_id_idx
  on claim_records (claim_order_id);
create index if not exists claim_records_recorded_at_desc_idx
  on claim_records (recorded_at desc);
