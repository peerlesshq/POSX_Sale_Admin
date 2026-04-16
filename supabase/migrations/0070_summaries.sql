-- =============================================================================
-- 0070_summaries.sql
--
-- Summary + reporting tables (03 §13).
--
-- Every table created in this file is a DERIVED cache that must be
-- rebuildable from source-of-truth facts. Direct inserts by seed
-- scripts for business purposes are forbidden (13 §25.2). Only the
-- rebuild jobs may write here.
-- =============================================================================

-- -------- user_reward_summary --------
create table if not exists user_reward_summary (
  wallet_address               text           primary key references users(wallet_address),
  direct_total                 numeric(38,18) not null default 0,
  team_total                   numeric(38,18) not null default 0,
  equal_level_total            numeric(38,18) not null default 0,
  adjustment_credit_total      numeric(38,18) not null default 0,
  adjustment_debit_remaining   numeric(38,18) not null default 0,
  claimable_total              numeric(38,18) not null default 0,
  burned_total                 numeric(38,18) not null default 0,
  updated_at                   timestamptz    not null default now(),
  constraint user_reward_summary_amounts_non_negative check (
    direct_total                >= 0 and
    team_total                  >= 0 and
    equal_level_total           >= 0 and
    adjustment_credit_total     >= 0 and
    adjustment_debit_remaining  >= 0 and
    claimable_total             >= 0 and
    burned_total                >= 0
  )
);

create index if not exists user_reward_summary_claimable_total_desc_idx
  on user_reward_summary (claimable_total desc);

drop trigger if exists user_reward_summary_set_updated_at on user_reward_summary;
create trigger user_reward_summary_set_updated_at
  before update on user_reward_summary
  for each row
  execute function trigger_set_updated_at();

-- -------- team_performance_snapshot --------
create table if not exists team_performance_snapshot (
  id                          uuid           primary key default gen_random_uuid(),
  wallet_address              text           not null references users(wallet_address),
  snapshot_date               date           not null,
  team_total_performance      numeric(38,18) not null default 0,
  effective_performance       numeric(38,18) not null default 0,
  team_rate                   numeric(10,8)  not null default 0,
  tier                        text           not null,
  updated_at                  timestamptz    not null default now(),
  constraint team_performance_snapshot_amounts_non_negative check (
    team_total_performance >= 0 and
    effective_performance  >= 0
  )
);

create unique index if not exists team_performance_snapshot_wallet_date_unique_idx
  on team_performance_snapshot (wallet_address, snapshot_date);
create index if not exists team_performance_snapshot_date_desc_idx
  on team_performance_snapshot (snapshot_date desc);
create index if not exists team_performance_snapshot_wallet_date_desc_idx
  on team_performance_snapshot (wallet_address, snapshot_date desc);

drop trigger if exists team_performance_snapshot_set_updated_at on team_performance_snapshot;
create trigger team_performance_snapshot_set_updated_at
  before update on team_performance_snapshot
  for each row
  execute function trigger_set_updated_at();

-- -------- team_level_aggregate_daily --------
create table if not exists team_level_aggregate_daily (
  id                         uuid           primary key default gen_random_uuid(),
  wallet_address             text           not null references users(wallet_address),
  snapshot_date              date           not null,
  level                      integer        not null,
  member_count               integer        not null default 0,
  active_count               integer        not null default 0,
  new_performance            numeric(38,18) not null default 0,
  cumulative_performance     numeric(38,18) not null default 0,
  updated_at                 timestamptz    not null default now(),
  constraint team_level_aggregate_level_positive
    check (level >= 1),
  constraint team_level_aggregate_counts_non_negative check (
    member_count >= 0 and active_count >= 0
  ),
  constraint team_level_aggregate_amounts_non_negative check (
    new_performance        >= 0 and
    cumulative_performance >= 0
  )
);

create unique index if not exists team_level_aggregate_wallet_date_level_unique_idx
  on team_level_aggregate_daily (wallet_address, snapshot_date, level);
create index if not exists team_level_aggregate_wallet_date_desc_idx
  on team_level_aggregate_daily (wallet_address, snapshot_date desc);

drop trigger if exists team_level_aggregate_daily_set_updated_at on team_level_aggregate_daily;
create trigger team_level_aggregate_daily_set_updated_at
  before update on team_level_aggregate_daily
  for each row
  execute function trigger_set_updated_at();

-- -------- dashboard_daily_summary --------
create table if not exists dashboard_daily_summary (
  summary_date                date          primary key,
  new_users_count             integer       not null default 0,
  new_buyers_count            integer       not null default 0,
  purchase_count              integer       not null default 0,
  deposit_total               numeric(38,18) not null default 0,
  direct_reward_total         numeric(38,18) not null default 0,
  team_reward_total           numeric(38,18) not null default 0,
  equal_level_reward_total    numeric(38,18) not null default 0,
  burn_total                  numeric(38,18) not null default 0,
  claim_total                 numeric(38,18) not null default 0,
  updated_at                  timestamptz   not null default now(),
  constraint dashboard_daily_summary_counts_non_negative check (
    new_users_count  >= 0 and
    new_buyers_count >= 0 and
    purchase_count   >= 0
  ),
  constraint dashboard_daily_summary_amounts_non_negative check (
    deposit_total            >= 0 and
    direct_reward_total      >= 0 and
    team_reward_total        >= 0 and
    equal_level_reward_total >= 0 and
    burn_total               >= 0 and
    claim_total              >= 0
  )
);

drop trigger if exists dashboard_daily_summary_set_updated_at on dashboard_daily_summary;
create trigger dashboard_daily_summary_set_updated_at
  before update on dashboard_daily_summary
  for each row
  execute function trigger_set_updated_at();

-- -------- report_export_jobs --------
create table if not exists report_export_jobs (
  id                        uuid         primary key default gen_random_uuid(),
  requested_by_admin_id     uuid         references admin_users(id),
  report_type               text         not null,
  status                    text         not null,
  filters                   jsonb,
  file_path                 text,
  error_message             text,
  created_at                timestamptz  not null default now(),
  finished_at               timestamptz,
  constraint report_export_jobs_status_check
    check (status in ('queued','running','completed','failed'))
);

create index if not exists report_export_jobs_requested_by_idx
  on report_export_jobs (requested_by_admin_id);
create index if not exists report_export_jobs_status_idx
  on report_export_jobs (status);
create index if not exists report_export_jobs_created_at_desc_idx
  on report_export_jobs (created_at desc);
