import {
  Pool,
  PoolClient,
  QueryResult,
} from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pool: Pool | undefined;
}

/* =========================================================
   SINGLETON POOL
========================================================= */

const pool =
  global._pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },

    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  global._pool = pool;
}

/* =========================================================
   TYPES
========================================================= */

type DbExecutor = Pool | PoolClient;

type DbError = {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
  table?: string;
};

type MappedDbError = Error & {
  code?: string;
  pgMessage?: string;
  constraint?: string | null;
  table?: string | null;
};

/* =========================================================
   ERROR MAP (KEEP PG METADATA)
========================================================= */

function mapDbError(err: unknown): MappedDbError {
  const e = err as DbError;

  let message = "DB_ERROR";

  switch (e.code) {
    case "23505":
      message = "DUPLICATE";
      break;

    case "23503":
      message = "INVALID_REFERENCE";
      break;

    case "23514":
      message = "INVALID_DATA";
      break;

    case "22P02":
      message = "INVALID_UUID";
      break;

    case "42703":
      message = "COLUMN_NOT_FOUND";
      break;

    case "40001":
      message = "TX_SERIALIZATION_FAIL";
      break;

    case "40P01":
      message = "TX_DEADLOCK";
      break;

    case "57014":
      message = "QUERY_TIMEOUT";
      break;
  }

  const error = new Error(message) as MappedDbError;

  error.code = e.code;
  error.pgMessage = e.message;
  error.constraint = e.constraint ?? null;
  error.table = e.table ?? null;

  return error;
}

/* =========================================================
   SAFE LOG
========================================================= */

function logDbError(prefix: string, err: unknown) {
  const e = err as DbError;

  console.error(prefix, {
    code: e.code ?? "UNKNOWN",
    message: e.message ?? "UNKNOWN",
    detail: e.detail ?? null,
    constraint: e.constraint ?? null,
    table: e.table ?? null,
  });
}

/* =========================================================
   SAFE QUERY (SUPPORT TX CLIENT)
========================================================= */

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
  db: DbExecutor = pool
): Promise<QueryResult<T>> {
  try {
    return await db.query<T>(text, params);
  } catch (err) {
    logDbError("🔥 [DB][QUERY_ERROR]", err);
    throw mapDbError(err);
  }
}

/* =========================================================
   FINANCIAL SAFE TRANSACTION
========================================================= */

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ---------------------------------------------
       anti hanging / anti deadlock / anti stuck tx
    --------------------------------------------- */

    await client.query("SET LOCAL lock_timeout = '8s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '15s'"
    );

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("🔥 [DB][ROLLBACK_FAIL]", rollbackErr);
    }

    logDbError("🔥 [DB][TX_ERROR]", err);

    throw mapDbError(err);
  } finally {
    client.release();
  }
}

/* =========================================================
   OPTIONAL DIRECT CLIENT EXPORT
========================================================= */

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export * from "./orders";
