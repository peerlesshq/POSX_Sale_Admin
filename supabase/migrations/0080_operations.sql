-- =============================================================================
-- 0080_operations.sql
--
-- Operations + audit tables (03 §14).
-- =============================================================================

-- -------- admin_logs --------
create table if not exists admin_logs (
  id             uuid         primary key default gen_random_uuid(),
  admin_user_id  uuid         references admin_users(id),
  action         text         not null,
  target_type    text         not null,
  target_id      text,
  detail         jsonb,
  ip_address     text,
  created_at     timestamptz  not null default now()
);

create index if not exists admin_logs_admin_user_id_idx
  on admin_logs (admin_user_id);
create index if not exists admin_logs_action_created_at_idx
  on admin_logs (action, created_at desc);
create index if not exists admin_logs_target_idx
  on admin_logs (target_type, target_id);

-- -------- job_runs --------
create table if not exists job_runs (
  id               uuid         primary key default gen_random_uuid(),
  job_name         text         not null,
  job_key          text,
  status           text         not null,
  started_at       timestamptz  not null,
  finished_at      timestamptz,
  rows_scanned     integer      not null default 0,
  rows_processed   integer      not null default 0,
  rows_failed      integer      not null default 0,
  detail           jsonb,
  error_message    text,
  created_at       timestamptz  not null default now(),
  constraint job_runs_status_check check (status in (
    'running','completed','failed','partial','cancelled'
  )),
  constraint job_runs_row_counts_non_negative check (
    rows_scanned   >= 0 and
    rows_processed >= 0 and
    rows_failed    >= 0
  )
);

create index if not exists job_runs_name_created_at_idx
  on job_runs (job_name, created_at desc);
create index if not exists job_runs_status_idx
  on job_runs (status);

-- -------- system_health_checks --------
create table if not exists system_health_checks (
  health_key    text         primary key,
  status        text         not null,
  detail        jsonb,
  checked_at    timestamptz  not null,
  constraint system_health_checks_status_check
    check (status in ('ok','warn','error'))
);

-- -------- error_events --------
create table if not exists error_events (
  id           uuid         primary key default gen_random_uuid(),
  source       text         not null,
  severity     text         not null,
  error_code   text,
  message      text         not null,
  detail       jsonb,
  created_at   timestamptz  not null default now(),
  constraint error_events_severity_check
    check (severity in ('info','warn','error','critical'))
);

create index if not exists error_events_source_idx
  on error_events (source);
create index if not exists error_events_severity_idx
  on error_events (severity);
create index if not exists error_events_created_at_desc_idx
  on error_events (created_at desc);
