import { Pool, PoolClient, QueryResult } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pool: Pool | undefined;
}

const pool =
  global._pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },

    max: 10, // ✅ FIX (không dùng 1)
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  global._pool = pool;
}

/* ================= ERROR MAP ================= */

function mapDbError(err: unknown): Error {
  const e = err as { code?: string };

  switch (e?.code) {
    case "23505": // unique_violation
      return new Error("DUPLICATE");

    case "23503": // foreign_key_violation
      return new Error("INVALID_REFERENCE");

    case "23514": // check_violation
      return new Error("INVALID_DATA");

    default:
      return new Error("DB_ERROR");
  }
}

/* ================= QUERY ================= */

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    console.error("🔥 [DB][QUERY_ERROR]", {
      code: (err as any)?.code,
    });

    throw mapDbError(err);
  }
}

/* ================= TRANSACTION ================= */

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn(client);

    await client.query("COMMIT");

    return result;
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("🔥 [DB][TX_ERROR]", {
      code: (err as any)?.code,
    });

    throw mapDbError(err);
  } finally {
    client.release();
  }
}
