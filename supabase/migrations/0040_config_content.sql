-- =============================================================================
-- 0040_config_content.sql
--
-- Versioned config + content tables (03 §12).
--
-- The config center is the source of truth for every mutable business
-- rule (09). Historical calculations must always resolve the version
-- that was effective at the original evaluation time, so older rows
-- are never destructively updated.
-- =============================================================================

-- -------- config_versions --------
create table if not exists config_versions (
  id                    uuid         primary key default gen_random_uuid(),
  config_group          text         not null,
  config_key            text         not null,
  version_no            integer      not null,
  config_value          jsonb        not null,
  effective_from        timestamptz  not null,
  apply_scope           text         not null,
  status                text         not null default 'active',
  description           text,
  created_by_admin_id   uuid         references admin_users(id),
  created_at            timestamptz  not null default now(),
  constraint config_versions_apply_scope_check check (apply_scope in (
    'all_users','new_users_only','new_orders_only','next_settlement_day'
  )),
  constraint config_versions_status_check
    check (status in ('draft','active','superseded','disabled')),
  constraint config_versions_version_no_positive
    check (version_no >= 1)
);

create unique index if not exists config_versions_group_key_version_unique_idx
  on config_versions (config_group, config_key, version_no);
create index if not exists config_versions_group_key_effective_from_idx
  on config_versions (config_group, config_key, effective_from desc);
create index if not exists config_versions_apply_scope_idx
  on config_versions (apply_scope);
create index if not exists config_versions_status_idx
  on config_versions (status);

-- -------- config_change_history --------
create table if not exists config_change_history (
  id                      uuid         primary key default gen_random_uuid(),
  config_version_id       uuid         not null references config_versions(id),
  config_group            text         not null,
  config_key              text         not null,
  old_value               jsonb,
  new_value               jsonb        not null,
  effective_from          timestamptz  not null,
  apply_scope             text         not null,
  changed_by_admin_id     uuid         references admin_users(id),
  changed_at              timestamptz  not null default now(),
  change_note             text
);

create index if not exists config_change_history_group_key_changed_at_idx
  on config_change_history (config_group, config_key, changed_at desc);
create index if not exists config_change_history_changed_by_admin_id_idx
  on config_change_history (changed_by_admin_id);

-- -------- content_entries --------
create table if not exists content_entries (
  id                     uuid         primary key default gen_random_uuid(),
  content_group          text         not null,
  content_key            text         not null,
  content_value          jsonb        not null,
  status                 text         not null default 'active',
  effective_from         timestamptz,
  created_by_admin_id    uuid         references admin_users(id),
  created_at             timestamptz  not null default now(),
  updated_at             timestamptz  not null default now(),
  constraint content_entries_status_check
    check (status in ('draft','active','disabled'))
);

create unique index if not exists content_entries_group_key_unique_idx
  on content_entries (content_group, content_key);
create index if not exists content_entries_status_idx
  on content_entries (status);

drop trigger if exists content_entries_set_updated_at on content_entries;
create trigger content_entries_set_updated_at
  before update on content_entries
  for each row
  execute function trigger_set_updated_at();
