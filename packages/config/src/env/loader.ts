/**
 * Server env loader.
 *
 * Provides a runtime-agnostic loader for the env schema. It accepts any
 * `Record<string, string | undefined>` source, so Node (`process.env`)
 * and Deno (`Object.fromEntries(Deno.env.toObject())`) both work.
 *
 * Fails fast on any missing or malformed variable with a structured
 * error listing every issue.
 */
import { EnvSchema, type ServerEnv } from './schema';

export interface EnvIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Structured error thrown when env validation fails. Carries the full
 * list of issues so callers can render them in a boot-time health
 * check or CI output.
 */
export class EnvLoadError extends Error {
  constructor(
    message: string,
    public readonly issues: ReadonlyArray<EnvIssue>,
  ) {
    super(message);
    this.name = 'EnvLoadError';
  }
}

export type EnvSource = Record<string, string | undefined>;

/**
 * Parse the provided env source against the schema. On failure, throws
 * `EnvLoadError` with a multi-line summary plus `issues[]`.
 *
 * The function is side-effect free: pass the same source twice and you
 * get the same result. Use `getServerEnv()` below for the cached
 * process-wide singleton.
 */
export function loadServerEnv(source: EnvSource): ServerEnv {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues: EnvIssue[] = result.error.issues.map((i) => ({
      path: i.path.map(String).join('.') || '(root)',
      message: i.message,
    }));
    const summary = issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
    throw new EnvLoadError(
      `Failed to load server env:\n${summary}`,
      issues,
    );
  }
  return result.data;
}

/**
 * Convenience loader for Node environments. Kept separate from the
 * generic `loadServerEnv` so that the core loader stays runtime
 * agnostic (Edge Functions / Deno can use their own source).
 */
export function loadServerEnvFromProcess(): ServerEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as unknown as { process?: { env?: EnvSource } }).process;
  if (!proc || !proc.env) {
    throw new EnvLoadError(
      'process.env is not available in this runtime',
      [{ path: '(runtime)', message: 'process.env missing' }],
    );
  }
  return loadServerEnv(proc.env);
}

// -------- Process-wide singleton --------

let cached: ServerEnv | undefined;

/**
 * Process-wide cached env. First call validates + caches; subsequent
 * calls return the cached value. Tests should call
 * `resetServerEnvCache()` between runs.
 */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = loadServerEnvFromProcess();
  }
  return cached;
}

export function resetServerEnvCache(): void {
  cached = undefined;
}

/**
 * Explicitly install a pre-parsed env object as the process-wide
 * singleton. Useful for tests that want to inject an in-memory env
 * without touching `process.env`.
 */
export function setServerEnv(env: ServerEnv): void {
  cached = env;
}
