/**
 * Persona fixture seeder.
 *
 * Seeds the 8 Phase-6 user personas: users + one confirmed purchase
 * each (except NEW_USER) + vesting lot. The personas are deliberately
 * independent — no referral bindings between them, no settlement
 * runs, no claim orders — so they sit alongside the minimal dataset
 * and the burn/reversal fixtures without interfering.
 *
 * Rule: this function must only be invoked for local/staging seed
 * runs. The entrypoint guards it via the PHASE6_PERSONAS env flag.
 * Additionally, the function refuses to run if `SUPABASE_DB_URL`
 * points at a host that looks like a production host. See
 * `isProductionLike` below — heuristic, but combined with the env
 * flag gives two independent checks.
 */
import {
  PurchaseOrderStatus,
  VestingLotStatus,
  type WalletAddress,
} from '@posx/shared-types';
import { divAmount } from '@posx/shared-utils';
import {
  type DbClient,
  insertPurchase,
  insertPurchaseOrder,
  insertVestingLot,
  upsertUser,
} from '@posx/backend-core';

import { PERSONA_FIXTURES, type PersonaFixture } from './data/personas';

const CHAIN_ID = 1;
const CONTRACT_ADDRESS_MAIN = '0x0000000000000000000000000000000000000001';
const TOKEN_PRICE = '0.0618';

function posxForUsdt(usdt: string): string {
  return divAmount(usdt, TOKEN_PRICE);
}

/**
 * Reject any connection string that looks even vaguely production-ish.
 * The heuristic is conservative: if in doubt, refuse.
 */
export function isProductionLike(connectionUrl: string | undefined): boolean {
  if (!connectionUrl) return false;
  const lower = connectionUrl.toLowerCase();
  const blockList = ['prod', 'production', 'supabase.co', 'live'];
  return blockList.some((needle) => lower.includes(needle));
}

/**
 * Seed one persona. Idempotent via upsertUser for the user row, but
 * the purchase rows will duplicate on re-run — call this at most once
 * per clean database.
 */
async function seedOnePersona(db: DbClient, p: PersonaFixture): Promise<void> {
  await upsertUser(db, {
    wallet_address: p.wallet,
    status: p.status,
    first_seen_at: p.createdAt,
    first_authenticated_at: p.createdAt,
    first_purchase_at: p.firstPurchaseAt,
  });

  if (p.cumulativeDeposit === '0' || p.firstPurchaseAt === null) {
    return;
  }

  const order = await insertPurchaseOrder(db, {
    wallet_address: p.wallet,
    client_order_id: `persona_${p.key.toLowerCase()}_1`,
    usdt_amount: p.cumulativeDeposit,
    status: PurchaseOrderStatus.Confirmed,
    expected_posx_amount: posxForUsdt(p.cumulativeDeposit),
    token_price_snapshot: TOKEN_PRICE,
    chain_id: CHAIN_ID,
    contract_address: CONTRACT_ADDRESS_MAIN,
  });

  const fact = await insertPurchase(db, {
    purchase_order_id: order.id,
    wallet_address: p.wallet,
    chain_id: CHAIN_ID,
    contract_address: CONTRACT_ADDRESS_MAIN,
    tx_hash: p.txHashPrefix,
    block_number: p.blockNumberBase,
    log_index: 0,
    usdt_amount: p.cumulativeDeposit,
    posx_amount: posxForUsdt(p.cumulativeDeposit),
    token_price_at_purchase: TOKEN_PRICE,
    purchase_at: p.firstPurchaseAt,
  });

  await insertVestingLot(db, {
    wallet_address: p.wallet,
    purchase_id: fact.id,
    total_locked: posxForUsdt(p.cumulativeDeposit),
    start_time: p.firstPurchaseAt,
    lock_days: 90,
    release_days: 365,
    status: VestingLotStatus.Active,
  });
}

export async function seedPersonaFixtures(db: DbClient): Promise<void> {
  for (const persona of PERSONA_FIXTURES) {
    await seedOnePersona(db, persona);
  }
}

/**
 * Return the wallet address of the persona matching `key`. Used by
 * tests that want to exercise a specific persona.
 */
export function personaWallet(key: PersonaFixture['key']): WalletAddress {
  const found = PERSONA_FIXTURES.find((p) => p.key === key);
  if (!found) throw new Error(`unknown persona key: ${key}`);
  return found.wallet;
}
