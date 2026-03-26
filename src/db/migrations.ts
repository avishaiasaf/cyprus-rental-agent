import type pg from 'pg';

interface Migration {
  version: number;
  description: string;
  up: (client: pg.PoolClient) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema with FTS and webhooks',
    up: async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS listings (
          id              SERIAL PRIMARY KEY,
          source          TEXT NOT NULL,
          external_id     TEXT NOT NULL,
          url             TEXT NOT NULL,
          title           TEXT NOT NULL,
          listing_type    TEXT NOT NULL CHECK(listing_type IN ('rent', 'sale')),
          price           NUMERIC(12,2),
          currency        TEXT DEFAULT 'EUR',
          price_per_sqm   NUMERIC(12,2),
          location        TEXT,
          district        TEXT,
          property_type   TEXT,
          bedrooms        INTEGER,
          bathrooms       INTEGER,
          area_sqm        NUMERIC(10,2),
          furnished       BOOLEAN,
          description     TEXT,
          images          JSONB DEFAULT '[]'::jsonb,
          contact_name    TEXT,
          contact_phone   TEXT,
          contact_email   TEXT,
          agency_name     TEXT,
          listing_date    TIMESTAMPTZ,
          amenities       JSONB DEFAULT '[]'::jsonb,
          raw_data        JSONB,
          first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_active       BOOLEAN NOT NULL DEFAULT TRUE,
          notified_at     TIMESTAMPTZ,
          telegram_message_id INTEGER,
          search_vector   TSVECTOR,

          UNIQUE(source, external_id)
        );

        CREATE INDEX IF NOT EXISTS idx_listings_source_eid ON listings(source, external_id);
        CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
        CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(district);
        CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type);
        CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
        CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen_at);
        CREATE INDEX IF NOT EXISTS idx_listings_search ON listings USING GIN(search_vector);

        CREATE OR REPLACE FUNCTION listings_search_update() RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(NEW.district, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_listings_search ON listings;
        CREATE TRIGGER trg_listings_search
          BEFORE INSERT OR UPDATE OF title, location, district, description
          ON listings
          FOR EACH ROW
          EXECUTE FUNCTION listings_search_update();

        CREATE TABLE IF NOT EXISTS price_history (
          id          SERIAL PRIMARY KEY,
          listing_id  INTEGER NOT NULL REFERENCES listings(id),
          old_price   NUMERIC(12,2) NOT NULL,
          new_price   NUMERIC(12,2) NOT NULL,
          detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_price_history_listing ON price_history(listing_id);

        CREATE TABLE IF NOT EXISTS scrape_runs (
          id               SERIAL PRIMARY KEY,
          started_at       TIMESTAMPTZ NOT NULL,
          completed_at     TIMESTAMPTZ,
          source           TEXT,
          new_listings     INTEGER DEFAULT 0,
          updated_listings INTEGER DEFAULT 0,
          errors           INTEGER DEFAULT 0,
          status           TEXT DEFAULT 'running'
        );

        CREATE TABLE IF NOT EXISTS user_reactions (
          id          SERIAL PRIMARY KEY,
          listing_id  INTEGER NOT NULL REFERENCES listings(id),
          user_id     TEXT NOT NULL,
          reaction    TEXT NOT NULL CHECK(reaction IN ('interested', 'not_interested')),
          reacted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

          UNIQUE(listing_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_reactions_listing ON user_reactions(listing_id);

        CREATE TABLE IF NOT EXISTS schema_version (
          version     INTEGER NOT NULL,
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS webhook_subscriptions (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          url             TEXT NOT NULL,
          name            TEXT NOT NULL DEFAULT '',
          filters         JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_active       BOOLEAN NOT NULL DEFAULT TRUE,
          signing_secret  TEXT,
          failure_count   INTEGER NOT NULL DEFAULT 0,
          last_triggered_at TIMESTAMPTZ,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhook_subscriptions(is_active);
      `);
    },
  },
  {
    version: 2,
    description: 'Auth tables for NextAuth.js',
    up: async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id              SERIAL PRIMARY KEY,
          email           TEXT NOT NULL UNIQUE,
          name            TEXT,
          password_hash   TEXT NOT NULL,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
      `);
    },
  },
];

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();

  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_version'
      ) AS exists
    `);

    let currentVersion = 0;
    if (tableCheck.rows[0].exists) {
      const result = await client.query('SELECT MAX(version) as v FROM schema_version');
      currentVersion = result.rows[0]?.v ?? 0;
    }

    const pending = migrations.filter(m => m.version > currentVersion);

    for (const migration of pending) {
      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query(
          'INSERT INTO schema_version (version) VALUES ($1)',
          [migration.version],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
