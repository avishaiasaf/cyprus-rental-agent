import { Pool } from '@neondatabase/serverless';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({ connectionString });

    // Neon pooler doesn't support search_path in startup options,
    // so we set it on each new connection from the pool.
    pool.on('connect', (client: { query: (sql: string) => void }) => {
      client.query('SET search_path TO public');
    });
  }
  return pool;
}

/**
 * Execute a parameterized SQL query against Neon.
 * Usage: const rows = await query('SELECT * FROM t WHERE id = $1', [id])
 */
export async function query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  const p = getPool();
  const result = await p.query(text, params);
  return result.rows as Record<string, unknown>[];
}

// Normalize a DB listing row for JSON API output
export function normalizeListing(l: Record<string, unknown>): Record<string, unknown> {
  return {
    ...l,
    images: l.images ?? [],
    amenities: l.amenities ?? [],
    price: l.price != null ? Number(l.price) : null,
    area_sqm: l.area_sqm != null ? Number(l.area_sqm) : null,
    price_per_sqm: l.price_per_sqm != null ? Number(l.price_per_sqm) : null,
  };
}
