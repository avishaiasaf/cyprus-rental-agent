import pg from 'pg';
import { runMigrations } from './migrations.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export async function initDb(connectionString: string): Promise<pg.Pool> {
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Verify connectivity
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  await runMigrations(pool);

  return pool;
}

export function getDb(): pg.Pool {
  if (!pool) throw new Error('Database not initialized. Call initDb() first.');
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
