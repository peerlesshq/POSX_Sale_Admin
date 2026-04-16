#!/usr/bin/env tsx
/**
 * Environment validation script.
 * Usage: pnpm verify:env
 *        APP_ENV=staging pnpm verify:env
 *
 * Can also be imported and called at boot time:
 *   import { verifyEnv } from '../scripts/verify-env';
 *   const result = verifyEnv(process.env);
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifyEnvResult {
  readonly valid: boolean;
  readonly appEnv: string | undefined;
  readonly errors: string[];
  readonly warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_APP_ENVS = ['local', 'staging', 'production'] as const;

/** Required variables that must be present and non-empty in every env. */
const REQUIRED_VARS = [
  'APP_ENV',
  'APP_BASE_URL',
  'ADMIN_BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'USER_SESSION_SECRET',
  'ADMIN_SESSION_SECRET',
  'CHAIN_ID',
  'RPC_URL',
  'CONTRACT_ADDRESS_MAIN',
] as const;

/** Patterns that indicate a production URL (case-insensitive). */
const PRODUCTION_PATTERNS = [
  /\.prod\./i,
  /-prod[.-]/i,
  /production\./i,
  /app\.posx\./i,
  /admin\.posx\./i,
];

/** Patterns that indicate a staging / test URL (case-insensitive). */
const STAGING_PATTERNS = [
  /staging/i,
  /-stg[.-]/i,
  /\.stg\./i,
  /testnet/i,
  /prebsc/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /example\.com/i,
];

const URL_VARS = [
  'APP_BASE_URL',
  'ADMIN_BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_DB_URL',
  'RPC_URL',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(value));
}

function loadDotenv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

export function verifyEnv(
  source: Record<string, string | undefined>,
): VerifyEnvResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. APP_ENV must be set and valid
  const appEnv = source.APP_ENV?.trim();
  if (!appEnv) {
    errors.push('APP_ENV is not set');
  } else if (!(VALID_APP_ENVS as readonly string[]).includes(appEnv)) {
    errors.push(
      `APP_ENV="${appEnv}" is not valid. Expected one of: ${VALID_APP_ENVS.join(', ')}`,
    );
  }

  // 2. Required variables present
  for (const key of REQUIRED_VARS) {
    const val = source[key]?.trim();
    if (!val) {
      errors.push(`${key} is missing or empty`);
    }
  }

  // 3. Cross-environment contamination checks
  if (appEnv === 'staging') {
    for (const key of URL_VARS) {
      const val = source[key];
      if (val && matchesAny(val, PRODUCTION_PATTERNS)) {
        errors.push(
          `${key} appears to contain a production URL in staging env: ${val}`,
        );
      }
    }
  }

  if (appEnv === 'production') {
    for (const key of URL_VARS) {
      const val = source[key];
      if (val && matchesAny(val, STAGING_PATTERNS)) {
        errors.push(
          `${key} appears to contain a staging/test URL in production env: ${val}`,
        );
      }
    }
  }

  // 4. Session secret strength warnings
  const userSecret = source.USER_SESSION_SECRET?.trim() ?? '';
  const adminSecret = source.ADMIN_SESSION_SECRET?.trim() ?? '';
  if (userSecret && userSecret.length < 16) {
    errors.push(`USER_SESSION_SECRET must be at least 16 characters (got ${userSecret.length})`);
  }
  if (adminSecret && adminSecret.length < 16) {
    errors.push(
      `ADMIN_SESSION_SECRET must be at least 16 characters (got ${adminSecret.length})`,
    );
  }
  if (
    appEnv !== 'local' &&
    userSecret &&
    adminSecret &&
    userSecret === adminSecret
  ) {
    warnings.push('USER_SESSION_SECRET and ADMIN_SESSION_SECRET should be different values');
  }

  // 5. Placeholder detection
  const placeholderPatterns = [/YOUR_/i, /replace_me/i, /replace_with/i];
  if (appEnv && appEnv !== 'local') {
    for (const key of REQUIRED_VARS) {
      const val = source[key];
      if (val && placeholderPatterns.some((p) => p.test(val))) {
        warnings.push(`${key} still contains a placeholder value: ${val}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    appEnv,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

function main(): void {
  // Allow specifying a .env file via CLI arg
  const envFile = process.argv[2];
  let source: Record<string, string | undefined> = { ...process.env };

  if (envFile) {
    const filePath = resolve(process.cwd(), envFile);
    console.info(`[verify-env] Loading from ${filePath}`);
    const dotenvVars = loadDotenv(filePath);
    source = { ...source, ...dotenvVars };
  }

  const result = verifyEnv(source);

  console.info('');
  console.info('=== Environment Verification ===');
  console.info(`  APP_ENV:       ${result.appEnv ?? '(not set)'}`);
  console.info(`  APP_BASE_URL:  ${source.APP_BASE_URL ?? '(not set)'}`);
  console.info(`  SUPABASE_URL:  ${source.SUPABASE_URL ?? '(not set)'}`);
  console.info(`  CHAIN_ID:      ${source.CHAIN_ID ?? '(not set)'}`);
  console.info(`  RPC_URL:       ${source.RPC_URL ?? '(not set)'}`);
  console.info('');

  if (result.warnings.length > 0) {
    console.warn('Warnings:');
    for (const w of result.warnings) {
      console.warn(`  ! ${w}`);
    }
    console.info('');
  }

  if (result.errors.length > 0) {
    console.error('Errors:');
    for (const e of result.errors) {
      console.error(`  x ${e}`);
    }
    console.info('');
    console.error(`[verify-env] FAILED with ${result.errors.length} error(s)`);
    process.exitCode = 1;
  } else {
    console.info(`[verify-env] PASSED (${result.appEnv} environment)`);
  }
}

// Run when executed directly
const isDirectRun =
  typeof require !== 'undefined'
    ? require.main === module
    : process.argv[1]?.endsWith('verify-env.ts') ||
      process.argv[1]?.endsWith('verify-env.js');

if (isDirectRun) {
  main();
}
