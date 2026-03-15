/**
 * One-time migration script: SQLite -> PostgreSQL
 *
 * Usage:
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts <sqlite-path> <postgres-url>
 *
 * Example:
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts ./data/listings.db postgresql://agent:changeme@localhost:5432/cyprus_rental
 */

import Database from 'better-sqlite3';
import pg from 'pg';

const { Pool } = pg;

async function migrate(sqlitePath: string, postgresUrl: string) {
  console.log(`Migrating from SQLite (${sqlitePath}) to PostgreSQL...`);

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pool = new Pool({ connectionString: postgresUrl });

  try {
    // Verify Postgres connection
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');

    // --- Listings ---
    const listings = sqlite.prepare('SELECT * FROM listings').all() as any[];
    console.log(`Found ${listings.length} listings to migrate`);

    let migrated = 0;
    for (const l of listings) {
      try {
        await pool.query(`
          INSERT INTO listings (
            source, external_id, url, title, listing_type, price, currency, price_per_sqm,
            location, district, property_type, bedrooms, bathrooms,
            area_sqm, furnished, description, contact_name, contact_phone,
            contact_email, agency_name, listing_date, amenities, images, raw_data,
            is_active, notified_at, telegram_message_id, first_seen_at, last_seen_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24,
            $25, $26, $27, $28, $29
          )
          ON CONFLICT(source, external_id) DO NOTHING
        `, [
          l.source,
          l.external_id,
          l.url,
          l.title,
          l.listing_type,
          l.price,
          l.currency ?? 'EUR',
          l.price_per_sqm ?? null,
          l.location,
          l.district ?? null,
          l.property_type ?? null,
          l.bedrooms ?? null,
          l.bathrooms ?? null,
          l.area_sqm ?? null,
          l.furnished != null ? Boolean(l.furnished) : null,
          l.description ?? null,
          l.contact_name ?? null,
          l.contact_phone ?? null,
          l.contact_email ?? null,
          l.agency_name ?? null,
          l.listing_date ?? null,
          l.amenities ?? '[]',
          l.images ?? '[]',
          l.raw_data ?? null,
          Boolean(l.is_active ?? 1),
          l.notified_at ?? null,
          l.telegram_message_id ?? null,
          l.first_seen_at ?? new Date().toISOString(),
          l.last_seen_at ?? new Date().toISOString(),
        ]);
        migrated++;
      } catch (err) {
        console.error(`Failed to migrate listing ${l.id} (${l.external_id}):`, (err as Error).message);
      }
    }
    console.log(`Migrated ${migrated}/${listings.length} listings`);

    // --- Price history ---
    const prices = sqlite.prepare('SELECT * FROM price_history').all() as any[];
    console.log(`Found ${prices.length} price history records`);

    let pricesMigrated = 0;
    for (const p of prices) {
      try {
        await pool.query(
          'INSERT INTO price_history (listing_id, old_price, new_price, detected_at) VALUES ($1, $2, $3, $4)',
          [p.listing_id, p.old_price, p.new_price, p.detected_at ?? new Date().toISOString()],
        );
        pricesMigrated++;
      } catch (err) {
        console.error(`Failed to migrate price history ${p.id}:`, (err as Error).message);
      }
    }
    console.log(`Migrated ${pricesMigrated}/${prices.length} price history records`);

    // --- Scrape runs ---
    const runs = sqlite.prepare('SELECT * FROM scrape_runs').all() as any[];
    console.log(`Found ${runs.length} scrape runs`);

    let runsMigrated = 0;
    for (const r of runs) {
      try {
        await pool.query(`
          INSERT INTO scrape_runs (started_at, completed_at, status, source, new_listings, updated_listings, errors)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          r.started_at,
          r.completed_at ?? null,
          r.status ?? 'completed',
          r.source ?? null,
          r.new_listings ?? 0,
          r.updated_listings ?? 0,
          r.errors ?? 0,
        ]);
        runsMigrated++;
      } catch (err) {
        console.error(`Failed to migrate scrape run ${r.id}:`, (err as Error).message);
      }
    }
    console.log(`Migrated ${runsMigrated}/${runs.length} scrape runs`);

    // --- User reactions ---
    try {
      const reactions = sqlite.prepare('SELECT * FROM user_reactions').all() as any[];
      console.log(`Found ${reactions.length} user reactions`);

      let reactionsMigrated = 0;
      for (const r of reactions) {
        try {
          await pool.query(`
            INSERT INTO user_reactions (listing_id, user_id, reaction, reacted_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT(listing_id, user_id) DO NOTHING
          `, [r.listing_id, r.user_id, r.reaction, r.reacted_at ?? new Date().toISOString()]);
          reactionsMigrated++;
        } catch (err) {
          console.error(`Failed to migrate reaction:`, (err as Error).message);
        }
      }
      console.log(`Migrated ${reactionsMigrated}/${reactions.length} user reactions`);
    } catch {
      console.log('No user_reactions table found, skipping');
    }

    console.log('\nMigration complete!');
  } finally {
    sqlite.close();
    await pool.end();
  }
}

// --- CLI ---
const [,, sqlitePath, postgresUrl] = process.argv;

if (!sqlitePath || !postgresUrl) {
  console.error('Usage: npx tsx scripts/migrate-sqlite-to-postgres.ts <sqlite-path> <postgres-url>');
  process.exit(1);
}

migrate(sqlitePath, postgresUrl).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
