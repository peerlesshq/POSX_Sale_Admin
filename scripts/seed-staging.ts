#!/usr/bin/env tsx
/**
 * Seed staging database with the 4 SQL seed files.
 * Usage: pnpm seed:staging
 *
 * Reads SQL files from `supabase/seeds/` and executes them in order:
 *   1. base.sql
 *   2. admin-fixtures.sql
 *   3. user-fixtures.sql
 *   4. ops-scenarios.sql
 *
 * SAFETY: Requires APP_ENV to be set. Refuses to run against production.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadServerEnv } from '@posx/config';
import { PostgresJsClient } from '@posx/backend-core/db';

const SEED_FILES_ORDERED = [
  'base.sql',
  'admin-fixtures.sql',
  'user-fixtures.sql',
  'ops-scenarios.sql',
] as const;

async function main(): Promise<void> {
  const env = loadServerEnv(process.env);

  if (env.APP_ENV === 'production') {
    console.error('[seed-staging] REFUSED: APP_ENV is "production". This script must not run against production.');
    process.exitCode = 1;
    return;
  }

  console.info(`[seed-staging] APP_ENV=${env.APP_ENV}`);
  console.info(`[seed-staging] SUPABASE_DB_URL=${env.SUPABASE_DB_URL.replace(/:[^@]+@/, ':****@')}`);

  const seedsDir = resolve(
    fileURLToPath(new URL('../supabase/seeds', import.meta.url)),
  );

  if (!existsSync(seedsDir)) {
    console.error(`[seed-staging] Seeds directory not found: ${seedsDir}`);
    console.info('[seed-staging] Available files in supabase/:');
    const supabaseDir = resolve(fileURLToPath(new URL('../supabase', import.meta.url)));
    if (existsSync(supabaseDir)) {
      const entries = readdirSync(supabaseDir);
      for (const entry of entries) {
        console.info(`  ${entry}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  const client = new PostgresJsClient({ connectionString: env.SUPABASE_DB_URL });

  try {
    let executed = 0;
    let skipped = 0;

    for (const fileName of SEED_FILES_ORDERED) {
      const filePath = join(seedsDir, fileName);
      if (!existsSync(filePath)) {
        console.warn(`[seed-staging] SKIP ${fileName} (file not found)`);
        skipped += 1;
        continue;
      }

      const sql = readFileSync(filePath, 'utf8');
      console.info(`[seed-staging] executing ${fileName} (${sql.length} bytes)...`);

      await client.query(sql);
      executed += 1;
      console.info(`[seed-staging] OK ${fileName}`);
    }

    console.info('');
    console.info(
      `[seed-staging] done: ${executed} file(s) executed, ${skipped} skipped`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[seed-staging] failed:', err);
  process.exitCode = 1;
});
