-- =============================================================================
-- 0001_helpers.sql
--
-- Shared helpers used across the rest of the migration set:
--   - `pgcrypto` extension for `gen_random_uuid()`
--   - `trigger_set_updated_at()` — the one and only updated_at trigger
--     function used by every mutable table (see 03 §25)
--   - `_posx_migrations` — tracking table consumed by scripts/migrate.ts
--
-- All migrations in this tree are intended to be additive. Destructive
-- ALTERs or DROPs should be introduced only via a new migration file,
-- never by hand-editing an existing one.
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function trigger_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists _posx_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);
