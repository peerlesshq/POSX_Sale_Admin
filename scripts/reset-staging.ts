#!/usr/bin/env tsx
/**
 * Reset staging database to a known baseline.
 * Usage: pnpm reset:staging
 *
 * SAFETY: Refuses to run unless APP_ENV=staging.
 *
 * Steps:
 *   1. Validates APP_ENV is 'staging'
 *   2. Drops and recreates all tables by running migrations
 *   3. Runs the staging seed (the 4 SQL files)
 *   4. Reports success
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

  // ------------------------------------------------------------------
  // Safety gate: only staging
  // ------------------------------------------------------------------
  if (env.APP_ENV !== 'staging') {
    console.error(
      `[reset-staging] REFUSED: APP_ENV is "${env.APP_ENV}". ` +
        'This script ONLY runs when APP_ENV=staging.',
    );
    process.exitCode = 1;
    return;
  }

  const maskedUrl = env.SUPABASE_DB_URL.replace(/:[^@]+@/, ':****@');
  console.info(`[reset-staging] APP_ENV=${env.APP_ENV}`);
  console.info(`[reset-staging] Target DB: ${maskedUrl}`);
  console.info('');

  const client = new PostgresJsClient({ connectionString: env.SUPABASE_DB_URL });

  try {
    // ----------------------------------------------------------------
    // Step 1: Drop all application tables
    // ----------------------------------------------------------------
    console.info('[reset-staging] Step 1/3: Dropping existing tables...');

    // Drop all tables in public schema that belong to the application.
    // We use a dynamic query to find and drop them all, respecting
    // dependency order via CASCADE.
    await client.query(`
      DO $$
      DECLARE
        tbl TEXT;
      BEGIN
        FOR tbl IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename NOT LIKE 'pg_%'
        LOOP
          EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', tbl);
        END LOOP;
      END $$;
    `);
    console.info('[reset-staging] Tables dropped.');

    // ----------------------------------------------------------------
    // Step 2: Run migrations
    // ----------------------------------------------------------------
    console.info('[reset-staging] Step 2/3: Running migrations...');

    const migrationsDir = resolve(
      fileURLToPath(new URL('../supabase/migrations', import.meta.url)),
    );

    if (!existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.info(`[reset-staging]   applied ${file}`);
    }

    // Record migrations in the tracking table
    for (const file of migrationFiles) {
      await client.query(
        `INSERT INTO _posx_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
        [file],
      );
    }

    console.info(`[reset-staging] ${migrationFiles.length} migration(s) applied.`);

    // ----------------------------------------------------------------
    // Step 3: Run staging seeds
    // ----------------------------------------------------------------
    console.info('[reset-staging] Step 3/3: Running staging seeds...');

    const seedsDir = resolve(
      fileURLToPath(new URL('../supabase/seeds', import.meta.url)),
    );

    if (!existsSync(seedsDir)) {
      console.warn(
        `[reset-staging] Seeds directory not found: ${seedsDir}. Skipping seeds.`,
      );
    } else {
      let seedCount = 0;
      for (const fileName of SEED_FILES_ORDERED) {
        const filePath = join(seedsDir, fileName);
        if (!existsSync(filePath)) {
          console.warn(`[reset-staging]   SKIP ${fileName} (not found)`);
          continue;
        }
        const sql = readFileSync(filePath, 'utf8');
        await client.query(sql);
        seedCount += 1;
        console.info(`[reset-staging]   seeded ${fileName}`);
      }
      console.info(`[reset-staging] ${seedCount} seed file(s) applied.`);
    }

    // ----------------------------------------------------------------
    // Done
    // ----------------------------------------------------------------
    console.info('');
    console.info('[reset-staging] SUCCESS: staging database reset to baseline.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[reset-staging] FAILED:', err);
  process.exitCode = 1;
});
