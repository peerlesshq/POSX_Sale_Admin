-- =============================================================================
-- 0020_referral.sql
--
-- Referral + team topology tables (03 §8).
--
-- Referral binding occurs on first successful purchase only (01 §10.1).
-- The closure table is populated as a side effect of binding, by the
-- ReferralBindingService (Phase 4). This migration only provisions
-- the storage.
-- =============================================================================

-- -------- referral_pending_captures --------
create table if not exists referral_pending_captures (
  id                          uuid         primary key default gen_random_uuid(),
  wallet_address              text         not null,
  candidate_referrer_address  text         not null,
  capture_source              text         not null default 'referral_link',
  expires_at                  timestamptz  not null,
  created_at                  timestamptz  not null default now(),
  constraint referral_pending_captures_wallet_address_lowercase
    check (wallet_address = lower(wallet_address)),
  constraint referral_pending_captures_candidate_lowercase
    check (candidate_referrer_address = lower(candidate_referrer_address)),
  constraint referral_pending_captures_no_self_capture
    check (wallet_address <> candidate_referrer_address),
  constraint referral_pending_captures_capture_source_check
    check (capture_source in ('referral_link','manual_seed','import'))
);

create index if not exists referral_pending_captures_wallet_address_idx
  on referral_pending_captures (wallet_address);
create index if not exists referral_pending_captures_candidate_idx
  on referral_pending_captures (candidate_referrer_address);
create index if not exists referral_pending_captures_expires_at_idx
  on referral_pending_captures (expires_at);

-- -------- referral_bindings --------
-- Immutable child -> parent mapping. `is_locked` is a redundant
-- explicit marker so admin tooling can reason about whether a
-- legacy-import binding may still be amended.
create table if not exists referral_bindings (
  child_wallet_address   text        primary key
    references users(wallet_address),
  parent_wallet_address  text        not null
    references users(wallet_address),
  binding_source         text        not null,
  binding_tx_hash        text,
  bound_at               timestamptz not null,
  is_locked              boolean     not null default true,
  created_at             timestamptz not null default now(),
  constraint referral_bindings_no_self_loop
    check (child_wallet_address <> parent_wallet_address),
  constraint referral_bindings_binding_source_check
    check (binding_source in ('referral_link','admin_import','manual_correction'))
);

create index if not exists referral_bindings_parent_idx
  on referral_bindings (parent_wallet_address);
create index if not exists referral_bindings_bound_at_desc_idx
  on referral_bindings (bound_at desc);

-- -------- referral_closure --------
-- Fast-path depth queries. Rows here are derived from
-- referral_bindings and must be rebuildable from it alone.
create table if not exists referral_closure (
  ancestor_wallet_address   text        not null
    references users(wallet_address),
  descendant_wallet_address text        not null
    references users(wallet_address),
  depth                     integer     not null,
  created_at                timestamptz not null default now(),
  primary key (ancestor_wallet_address, descendant_wallet_address),
  constraint referral_closure_depth_positive check (depth >= 1),
  constraint referral_closure_no_self_rows
    check (ancestor_wallet_address <> descendant_wallet_address)
);

create index if not exists referral_closure_descendant_idx
  on referral_closure (descendant_wallet_address);
create index if not exists referral_closure_ancestor_depth_idx
  on referral_closure (ancestor_wallet_address, depth);
create index if not exists referral_closure_ancestor_created_at_idx
  on referral_closure (ancestor_wallet_address, created_at desc);
