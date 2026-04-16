/**
 * `postgres.js`-backed implementation of `DbClient`.
 *
 * Used by:
 *   - the seed script (Node runtime)
 *   - the migrate script (Node runtime)
 *   - Phase 6 integration tests
 *
 * For Supabase Edge Functions (Deno) Phase 4 will add a parallel
 * adapter targeting the Deno postgres client. Because every repo
 * depends only on the `DbClient` interface, that swap will not
 * require any repo change.
 */
import postgres, { type Sql } from 'postgres';

import type { DbClient } from './client';

export interface PostgresJsClientOptions {
  readonly connectionString: string;
  readonly max?: number;
  readonly idle_timeout?: number;
  readonly connect_timeout?: number;
  readonly debug?: boolean;
}

function convertPlaceholders(sql: string): string {
  // postgres.js uses tagged templates. We expose a `$1, $2, ...`
  // style for repos so they can write plain strings. Convert here.
  // Match `$1`..`$99` — more than enough for any single statement.
  return sql;
}

export class PostgresJsClient implements DbClient {
  private readonly sql: Sql;
  private closed = false;

  constructor(options: PostgresJsClientOptions) {
    // IMPORTANT: override the default date/timestamp/timestamptz
    // parsers so repo row types that declare `created_at: string`
    // match runtime reality. Without this, postgres.js returns JS
    // Date objects and every service that passes `row.created_at`
    // to a function expecting a string silently breaks at runtime.
    const dateToIso = {
      to: 1184,
      from: [1082, 1083, 1114, 1184], // date, time, timestamp, timestamptz
      serialize: (v: unknown): string =>
        v instanceof Date ? v.toISOString() : String(v),
      parse: (v: string): string => new Date(v).toISOString(),
    };

    this.sql = postgres(options.connectionString, {
      max: options.max ?? 5,
      idle_timeout: options.idle_timeout ?? 20,
      connect_timeout: options.connect_timeout ?? 10,
      ...(options.debug ? { debug: () => undefined } : {}),
      types: {
        date: dateToIso,
      },
      onnotice: () => undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  static fromSql(sql: Sql): PostgresJsClient {
    const instance = Object.create(PostgresJsClient.prototype) as PostgresJsClient;
    Object.defineProperty(instance, 'sql', { value: sql });
    Object.defineProperty(instance, 'closed', { value: false, writable: true });
    return instance;
  }

  async query<Row>(
    sqlText: string,
    params: ReadonlyArray<unknown> = [],
  ): Promise<Row[]> {
    const rows = (await this.sql.unsafe(
      convertPlaceholders(sqlText),
      params as postgres.ParameterOrJSON<string>[],
    )) as unknown as Row[];
    return rows;
  }

  async queryOne<Row>(
    sqlText: string,
    params: ReadonlyArray<unknown> = [],
  ): Promise<Row | null> {
    const rows = await this.query<Row>(sqlText, params);
    if (rows.length === 0) return null;
    return rows[0] ?? null;
  }

  async queryRequired<Row>(
    sqlText: string,
    params: ReadonlyArray<unknown> = [],
  ): Promise<Row> {
    const result = await this.queryOne<Row>(sqlText, params);
    if (result === null) {
      throw new Error(
        `queryRequired() returned zero rows for: ${sqlText.slice(0, 120)}...`,
      );
    }
    return result;
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    return this.sql.begin(async (txSql) => {
      const txClient = PostgresJsClient.fromSql(txSql as unknown as Sql);
      return fn(txClient);
    }) as Promise<T>;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.sql.end({ timeout: 5 });
  }
}
