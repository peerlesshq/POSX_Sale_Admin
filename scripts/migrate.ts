#!/usr/bin/env tsx
/**
 * Migration runner.
 *
 * Reads every `*.sql` file in `supabase/migrations/` in lexical
 * order, checks `_posx_migrations` for prior application, and runs
 * each not-yet-applied file inside a transaction before recording
 * its id.
 *
 * This keeps us independent of the Supabase CLI. `supabase db reset`
 * can still be used when available; this script is the fallback when
 * the CLI is not installed or when we are pointing at a non-Supabase
 * postgres instance.
 *
 * Usage:
 *     pnpm db:migrate
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadServerEnv } from '@posx/config';
import { PostgresJsClient } from '@posx/backend-core/db';

async function main(): Promise<void> {
  const env = loadServerEnv(process.env);
  const client = new PostgresJsClient({ connectionString: env.SUPABASE_DB_URL });

  try {
    const migrationsDir = resolve(
      fileURLToPath(new URL('../supabase/migrations', import.meta.url)),
    );
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Ensure the tracking table exists before any migration runs.
    // The first file (0001_helpers.sql) creates it, but we also need
    // to query it right after. We run 0001 outside the "skip if
    // applied" check so that every boot reapplies idempotent
    // helpers.
    const helperFile = files[0];
    if (!helperFile || !helperFile.startsWith('0001_')) {
      throw new Error(
        `Expected 0001_*.sql to be the first migration; found: ${helperFile ?? '(none)'}`,
      );
    }
    const helperSql = readFileSync(join(migrationsDir, helperFile), 'utf8');
    await client.query(helperSql);
    await client.query(
      `insert into _posx_migrations (id) values ($1)
         on conflict (id) do nothing`,
      [helperFile],
    );
    console.info(`[migrate] applied ${helperFile}`);

    for (let i = 1; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;
      const existing = await client.queryOne<{ id: string }>(
        `select id from _posx_migrations where id = $1`,
        [file],
      );
      if (existing) {
        console.info(`[migrate] skip    ${file} (already applied)`);
        continue;
      }

      const sqlText = readFileSync(join(migrationsDir, file), 'utf8');
      await client.transaction(async (tx) => {
        await tx.query(sqlText);
        await tx.query(`insert into _posx_migrations (id) values ($1)`, [file]);
      });
      console.info(`[migrate] applied ${file}`);
    }

    console.info('[migrate] done');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exitCode = 1;
});
