-- =============================================================================
-- 0030_purchase_chain.sql
--
-- Purchase + chain synchronization tables (03 §9).
--
-- Tables:
--   - purchase_orders     — off-chain orchestration record
--   - purchases           — confirmed chain-backed fact
--   - purchase_recoveries — tx-hash-based recovery audit
--   - purchase_reversals  — approved exceptional reversal
--   - chain_events        — raw event ledger
--   - chain_sync_state    — scan + confirmation checkpoint per source
-- =============================================================================

-- -------- purchase_orders --------
create table if not exists purchase_orders (
  id                     uuid            primary key default gen_random_uuid(),
  wallet_address         text            not null references users(wallet_address),
  client_order_id        text            not null,
  status                 text            not null,
  usdt_amount            numeric(38,18)  not null,
  expected_posx_amount   numeric(38,18),
  token_price_snapshot   numeric(38,18),
  approval_tx_hash       text,
  purchase_tx_hash       text,
  chain_id               bigint,
  contract_address       text,
  failure_reason         text,
  risk_flag              text,
  created_at             timestamptz     not null default now(),
  updated_at             timestamptz     not null default now(),
  confirmed_at           timestamptz,
  constraint purchase_orders_status_check check (status in (
    'created','approval_pending','approval_done','purchase_pending',
    'confirmed','failed','reversed','cancelled'
  )),
  constraint purchase_orders_usdt_amount_positive
    check (usdt_amount >= 0)
);

create unique index if not exists purchase_orders_wallet_client_order_unique_idx
  on purchase_orders (wallet_address, client_order_id);
create unique index if not exists purchase_orders_purchase_tx_hash_unique_idx
  on purchase_orders (purchase_tx_hash)
  where purchase_tx_hash is not null;
create index if not exists purchase_orders_wallet_address_idx
  on purchase_orders (wallet_address);
create index if not exists purchase_orders_status_idx
  on purchase_orders (status);
create index if not exists purchase_orders_created_at_desc_idx
  on purchase_orders (created_at desc);

drop trigger if exists purchase_orders_set_updated_at on purchase_orders;
create trigger purchase_orders_set_updated_at
  before update on purchase_orders
  for each row
  execute function trigger_set_updated_at();

-- -------- purchases --------
create table if not exists purchases (
  id                       uuid            primary key default gen_random_uuid(),
  purchase_order_id        uuid            references purchase_orders(id),
  wallet_address           text            not null references users(wallet_address),
  chain_id                 bigint          not null,
  contract_address         text            not null,
  tx_hash                  text            not null,
  block_number             bigint          not null,
  log_index                integer,
  usdt_amount              numeric(38,18)  not null,
  posx_amount              numeric(38,18)  not null,
  token_price_at_purchase  numeric(38,18)  not null,
  purchase_at              timestamptz     not null,
  created_at               timestamptz     not null default now(),
  is_reversed              boolean         not null default false,
  constraint purchases_usdt_amount_positive check (usdt_amount >= 0),
  constraint purchases_posx_amount_positive check (posx_amount >= 0),
  constraint purchases_token_price_positive
    check (token_price_at_purchase >= 0)
);

-- Unique per (chain_id, tx_hash, coalesce(log_index, -1)) to support
-- contracts that emit multiple purchase events per tx.
create unique index if not exists purchases_chain_tx_log_unique_idx
  on purchases (chain_id, tx_hash, coalesce(log_index, -1));

create index if not exists purchases_wallet_address_idx
  on purchases (wallet_address);
create index if not exists purchases_purchase_at_desc_idx
  on purchases (purchase_at desc);
create index if not exists purchases_wallet_purchase_at_desc_idx
  on purchases (wallet_address, purchase_at desc);
create index if not exists purchases_is_reversed_idx
  on purchases (is_reversed);

-- -------- purchase_recoveries --------
create table if not exists purchase_recoveries (
  id                     uuid        primary key default gen_random_uuid(),
  purchase_order_id      uuid        references purchase_orders(id),
  wallet_address         text        not null references users(wallet_address),
  tx_hash                text        not null,
  status                 text        not null,
  resolved_purchase_id   uuid        references purchases(id),
  failure_reason         text,
  requested_at           timestamptz not null default now(),
  resolved_at            timestamptz,
  constraint purchase_recoveries_status_check
    check (status in ('requested','resolved','failed','duplicate'))
);

create index if not exists purchase_recoveries_wallet_address_idx
  on purchase_recoveries (wallet_address);
create index if not exists purchase_recoveries_tx_hash_idx
  on purchase_recoveries (tx_hash);
create index if not exists purchase_recoveries_status_idx
  on purchase_recoveries (status);

-- -------- purchase_reversals --------
create table if not exists purchase_reversals (
  id                      uuid        primary key default gen_random_uuid(),
  purchase_id             uuid        not null references purchases(id),
  reversal_reason         text        not null,
  reversal_type           text        not null,
  reversed_by_admin_id    uuid        references admin_users(id),
  approved_by_admin_id    uuid        references admin_users(id),
  created_at              timestamptz not null default now(),
  effective_at            timestamptz not null,
  notes                   text,
  constraint purchase_reversals_type_check
    check (reversal_type in (
      'duplicate_payment','system_error','compliance','manual_exception'
    ))
);

create unique index if not exists purchase_reversals_purchase_id_unique_idx
  on purchase_reversals (purchase_id);
create index if not exists purchase_reversals_effective_at_idx
  on purchase_reversals (effective_at);

-- -------- chain_events --------
create table if not exists chain_events (
  id                 uuid         primary key default gen_random_uuid(),
  chain_id           bigint       not null,
  contract_address   text         not null,
  event_name         text         not null,
  tx_hash            text         not null,
  log_index          integer      not null,
  block_number       bigint       not null,
  block_hash         text,
  status             text         not null,
  confirmations      integer      not null default 0,
  payload            jsonb        not null,
  observed_at        timestamptz  not null default now(),
  confirmed_at       timestamptz,
  processed_at       timestamptz,
  failed_at          timestamptz,
  failure_reason     text,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),
  constraint chain_events_status_check check (status in (
    'observed','confirmed','processed','reverted','failed_processing'
  )),
  constraint chain_events_confirmations_non_negative
    check (confirmations >= 0)
);

create unique index if not exists chain_events_chain_tx_log_unique_idx
  on chain_events (chain_id, tx_hash, log_index);
create index if not exists chain_events_chain_contract_block_idx
  on chain_events (chain_id, contract_address, block_number);
create index if not exists chain_events_status_idx
  on chain_events (status);
create index if not exists chain_events_event_name_idx
  on chain_events (event_name);
create index if not exists chain_events_confirmed_at_idx
  on chain_events (confirmed_at);

drop trigger if exists chain_events_set_updated_at on chain_events;
create trigger chain_events_set_updated_at
  before update on chain_events
  for each row
  execute function trigger_set_updated_at();

-- -------- chain_sync_state --------
create table if not exists chain_sync_state (
  id                     uuid         primary key default gen_random_uuid(),
  chain_id               bigint       not null,
  contract_address       text         not null,
  sync_key               text         not null,
  last_scanned_block     bigint       not null default 0,
  last_confirmed_block   bigint       not null default 0,
  last_scanned_at        timestamptz,
  updated_at             timestamptz  not null default now()
);

create unique index if not exists chain_sync_state_source_unique_idx
  on chain_sync_state (chain_id, contract_address, sync_key);

drop trigger if exists chain_sync_state_set_updated_at on chain_sync_state;
create trigger chain_sync_state_set_updated_at
  before update on chain_sync_state
  for each row
  execute function trigger_set_updated_at();
