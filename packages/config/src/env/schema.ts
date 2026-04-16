/**
 * Server env schema.
 *
 * Source of truth: 14_deployment_and_env_spec.md §7 and §8.
 *
 * This schema is consumed by the env loader (`./loader.ts`). It is
 * deliberately strict so that missing or malformed variables fail fast
 * at boot time rather than producing subtle runtime bugs.
 *
 * IMPORTANT distinctions baked into the schema:
 *   - Claim / purchase constants here are runtime FALLBACKS only. The
 *     business source of truth for `min_claim_amount`, `min_purchase
 *     _amount`, etc. is the Config Center (09 §18.3). Business modules
 *     must resolve those values through `ConfigResolver`, not this
 *     env. See 14 §7.8 / §7.9.
 *   - Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `*_SESSION_SECRET`) are
 *     declared here for backend use. Frontend builds must not receive
 *     this schema — they read their own `VITE_*` variables separately.
 */
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'], {
    errorMap: () => ({ message: "Expected 'true' or 'false'" }),
  })
  .transform((v) => v === 'true');

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();

const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Expected a decimal number string');

const lowercaseEvmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address')
  .transform((v) => v.toLowerCase());

export const EnvSchema = z.object({
  // --- Core app ---
  APP_ENV: z.enum(['local', 'staging', 'production']),
  APP_NAME: z.string().min(1).default('POSX Token Sale System'),
  APP_BASE_URL: z.string().url(),
  ADMIN_BASE_URL: z.string().url(),
  DEFAULT_TIMEZONE: z.literal('UTC').default('UTC'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // --- Supabase backend ---
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().min(1),

  // --- Auth / session ---
  USER_SESSION_SECRET: z.string().min(16),
  ADMIN_SESSION_SECRET: z.string().min(16),
  USER_SESSION_TTL_HOURS: positiveInt.default(168),
  ADMIN_SESSION_TTL_HOURS: positiveInt.default(168),
  NONCE_TTL_MINUTES: positiveInt.default(5),

  // --- Chain / RPC ---
  CHAIN_ID: positiveInt,
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS_MAIN: lowercaseEvmAddress,
  MIN_CONFIRMATIONS: positiveInt.default(12),
  CHAIN_SYNC_BATCH_SIZE: positiveInt.default(500),
  CHAIN_REORG_SAFETY_WINDOW: nonNegativeInt.default(20),

  // --- Job / scheduler flags ---
  ENABLE_CHAIN_SYNC_JOB: booleanString.default('false'),
  ENABLE_SETTLEMENT_JOB: booleanString.default('false'),
  ENABLE_SUMMARY_REBUILD_JOB: booleanString.default('false'),
  ENABLE_EXPORT_JOB: booleanString.default('false'),
  ENABLE_CLEANUP_JOB: booleanString.default('false'),
  CHAIN_SYNC_INTERVAL_SECONDS: positiveInt.default(60),
  SETTLEMENT_RUN_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(0),
  SETTLEMENT_RUN_MINUTE_UTC: z.coerce.number().int().min(0).max(59).default(10),
  SUMMARY_REBUILD_INTERVAL_MINUTES: positiveInt.default(60),
  EXPORT_POLL_INTERVAL_SECONDS: positiveInt.default(30),

  // --- Claim / purchase bootstrap defaults (NOT business source of truth) ---
  MIN_CLAIM_AMOUNT_DEFAULT: decimalString.default('10'),
  CLAIM_PENDING_SIGNATURE_TTL_MINUTES: positiveInt.default(30),
  CLAIM_MAX_RETRY_COUNT: nonNegativeInt.default(3),
  MIN_PURCHASE_AMOUNT_DEFAULT: decimalString.default('1000'),
  PURCHASE_ORDER_EXPIRY_MINUTES: positiveInt.default(60),

  // --- Reporting / export ---
  EXPORT_STORAGE_PATH: z.string().min(1).default('/tmp/posx_exports'),
  EXPORT_RETENTION_DAYS: positiveInt.default(7),
  REPORT_MAX_EXPORT_ROWS: positiveInt.default(100_000),

  // --- Observability / debug ---
  ENABLE_REQUEST_LOGGING: booleanString.default('true'),
  ENABLE_SQL_DEBUG: booleanString.default('false'),
  ENABLE_JOB_DEBUG: booleanString.default('true'),
});

/**
 * Parsed + normalized server env. This is a *runtime value type*: it
 * represents what business code will actually see after parsing.
 */
export type ServerEnv = z.infer<typeof EnvSchema>;

export type AppEnv = ServerEnv['APP_ENV'];
export type LogLevel = ServerEnv['LOG_LEVEL'];
