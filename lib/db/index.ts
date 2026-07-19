import {
  Pool,
  PoolClient,
  QueryResult,
  QueryResultRow,
} from "pg";

/* =========================================================
   SINGLETON POOL
========================================================= */

declare global {
  // eslint-disable-next-line no-var
  var _pool: Pool | undefined;
}

const pool =
  global._pool ||
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false,
          }
        : false,

    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

if (
  process.env.NODE_ENV !==
  "production"
) {
  global._pool = pool;
}

/* =========================================================
   QUERY LAYER
========================================================= */

export async function query<
  T extends QueryResultRow = QueryResultRow
>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {

  const t1 = Date.now();

  const client = await pool.connect();

  console.log(
    "[DB][CONNECT]",
    Date.now() - t1,
    "ms"
  );

  try {
    const t2 = Date.now();

    const result =
      await client.query(text, params);

    console.log(
      "[DB][QUERY]",
      Date.now() - t2,
      "ms"
    );

    return result;

  } finally {
    client.release();
  }
}

/* =========================================================
   TRANSACTION LAYER
========================================================= */

export async function withTransaction<T>(
  fn: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {

  const client =
    await pool.connect();

  try {

    await client.query("BEGIN");

    await client.query(
      "SET LOCAL lock_timeout = '8s'"
    );

    await client.query(
      "SET LOCAL statement_timeout = '15s'"
    );

    const result =
      await fn(client);

    await client.query(
      "COMMIT"
    );

    return result;

  } catch (err) {

    await client.query(
      "ROLLBACK"
    );

    throw err;

  } finally {

    client.release();
  }
}

/* =========================================================
   CLIENT EXPORT
========================================================= */

export function getClient():
  Promise<PoolClient> {

  return pool.connect();
}
