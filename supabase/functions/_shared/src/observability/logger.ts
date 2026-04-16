/**
 * Minimal structured logger.
 *
 * Every log line carries a `request_id` and a JSON-safe `context`
 * blob. In Phase 4 we write to stdout with JSON encoding; Phase 5
 * can plug in a transport (Supabase logs, external sink) without
 * touching callers.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  bindings?: Record<string, unknown>;
  /**
   * Optional sink override. Defaults to `console.log` at debug/info
   * and `console.error` at warn/error so stderr stays meaningful.
   */
  write?: (level: LogLevel, line: string) => void;
}

function defaultWrite(level: LogLevel, line: string): void {
  if (level === 'warn' || level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.info(line);
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level: LogLevel = options.level ?? 'info';
  const bindings = { ...(options.bindings ?? {}) };
  const write = options.write ?? defaultWrite;

  function emit(l: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_RANK[l] < LEVEL_RANK[level]) return;
    const record = {
      ts: new Date().toISOString(),
      level: l,
      message,
      ...bindings,
      ...(context ?? {}),
    };
    write(l, JSON.stringify(record));
  }

  return {
    debug: (m, c) => emit('debug', m, c),
    info: (m, c) => emit('info', m, c),
    warn: (m, c) => emit('warn', m, c),
    error: (m, c) => emit('error', m, c),
    child: (b) =>
      createLogger({
        level,
        bindings: { ...bindings, ...b },
        write,
      }),
  };
}
