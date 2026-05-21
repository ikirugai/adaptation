import { Pool, PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function pool(): Pool {
  if (!global.__pgPool) {
    // ADAPT_DATABASE_URL lets a consumer point Adaptation at a different
    // database than the app's primary one — useful when integrating
    // Adaptation into an existing app whose DATABASE_URL is already taken
    // by its own ORM. Falls back to DATABASE_URL for standalone apps.
    const connectionString = process.env.ADAPT_DATABASE_URL || process.env.DATABASE_URL;
    global.__pgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000
    });
  }
  return global.__pgPool;
}

export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query(sql, params);
  return res.rows as T[];
}

export async function one<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
