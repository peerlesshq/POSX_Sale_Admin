/**
 * `DbClient` interface — the contract every repository in this
 * package depends on.
 *
 * Kept narrow on purpose. A concrete client only needs to expose four
 * primitives (query, queryOne, queryRequired, transaction) plus a
 * disposer, and it can be swapped for an in-memory test double or a
 * different runtime adapter without touching any repo code.
 */

export interface DbClient {
  /**
   * Run a parameterised statement and return rows.
   *
   * Placeholders in `sql` are driver-specific: for postgres.js the
   * `$1, $2, ...` style is used and `params` is passed through as an
   * ordered array. Repos use this abstraction via tiny helpers
   * defined in `./sql-builder.ts` so individual queries stay
   * readable.
   */
  query<Row>(sql: string, params?: ReadonlyArray<unknown>): Promise<Row[]>;

  /**
   * Variant that returns at most one row. Returns `null` when the
   * result set is empty.
   */
  queryOne<Row>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<Row | null>;

  /**
   * Variant that throws if zero rows come back. Useful after an
   * `INSERT ... RETURNING *`.
   */
  queryRequired<Row>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<Row>;

  /**
   * Run `fn` inside a database transaction. The argument passed to
   * `fn` is a client scoped to the transaction — repos should use
   * THAT client for all reads and writes inside the callback.
   */
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;

  /**
   * Clean up any underlying resources (connection pool, etc.). Safe
   * to call multiple times.
   */
  close(): Promise<void>;
}
