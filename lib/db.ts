/**
 * Shared pg connection pool — replaces Prisma.
 * Uses the same DATABASE_URL already in .env.local.
 */
import { Pool } from "pg";

const globalForPool = globalThis as unknown as { pgPool: Pool | undefined };

const rawDbUrl = process.env.DATABASE_URL;
const connectionString = rawDbUrl?.replace(
  /([?&])sslmode=(?:require|prefer|verify-ca)\b/i,
  "$1sslmode=verify-full"
);

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 300000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool = pool;
}

/** Pre-warm the pool by executing a lightweight query if idle */
export async function warmDbPool(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
  } catch {
    // Non-fatal background warmup
  }
}

// Pre-warm on startup in background so the first user query doesn't pay a 3.5s cold TLS connection penalty
if (process.env.DATABASE_URL) {
  warmDbPool().catch(() => {});
}

/** Run a parameterised query and return all rows. */
export async function query<T = Record<string, any>>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

/** Run a parameterised query and return the first row (or null). */
export async function queryOne<T = Record<string, any>>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return (rows[0] as T) ?? null;
}

/** Run a statement (INSERT/UPDATE/DELETE) and return rowCount. */
export async function execute(sql: string, params?: any[]): Promise<number> {
  const { rowCount } = await pool.query(sql, params);
  return rowCount ?? 0;
}
