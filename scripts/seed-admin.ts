/**
 * Seed an admin user into the auth_users table.
 * Usage: DATABASE_URL=... npx tsx scripts/seed-admin.ts <email> <password> [name]
 */
import pg from 'pg';
import { hash } from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/seed-admin.ts <email> <password> [name]');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    await pool.query('SET search_path TO public');
    const passwordHash = await hash(password, 12);

    const result = await pool.query(
      `INSERT INTO auth_users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, updated_at = NOW()
       RETURNING id, email, name`,
      [email, passwordHash, name ?? null],
    );

    console.log('Admin user created/updated:', result.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
