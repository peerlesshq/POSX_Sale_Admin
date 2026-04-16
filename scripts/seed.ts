#!/usr/bin/env tsx
/**
 * Seed runner entrypoint.
 *
 *     pnpm db:seed
 *     PHASE6_PERSONAS=true pnpm db:seed   # add persona fixtures
 *
 * Requires migrations to have already been applied.
 *
 * Phase 6 persona fixtures are gated behind PHASE6_PERSONAS — the
 * seed library additionally refuses to run them against a
 * production-like SUPABASE_DB_URL, so the flag is a convenience, not
 * the only safety net.
 */
import { loadServerEnv } from '@posx/config';
import { PostgresJsClient } from '@posx/backend-core/db';

import { runSeed } from '../supabase/seed';

function boolEnv(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

async function main(): Promise<void> {
  const env = loadServerEnv(process.env);
  const client = new PostgresJsClient({ connectionString: env.SUPABASE_DB_URL });
  try {
    const includePersonas = boolEnv('PHASE6_PERSONAS');
    await runSeed(client, { includePersonas });
    console.info(
      `[seed] done${includePersonas ? ' (with Phase 6 personas)' : ''}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exitCode = 1;
});
