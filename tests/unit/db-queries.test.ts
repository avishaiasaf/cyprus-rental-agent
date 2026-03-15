import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as queries from '../../src/db/queries.js';
import type { RawListing } from '../../src/types/listing.js';
import { initDb, getDb, closeDb } from '../../src/db/client.js';

// These tests require a running PostgreSQL instance.
// Set TEST_DATABASE_URL to run them, or they will be skipped.
const TEST_DB_URL = process.env.TEST_DATABASE_URL;

const describeWithDb = TEST_DB_URL ? describe : describe.skip;

function makeListing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    externalId: 'ext-1',
    source: 'dom-com-cy',
    url: 'https://dom.com.cy/123',
    title: 'Test Listing',
    listingType: 'rent',
    price: 1000,
    currency: 'EUR',
    location: 'Limassol',
    images: [],
    ...overrides,
  };
}

describeWithDb('db queries (postgres)', () => {
  beforeAll(async () => {
    await initDb(TEST_DB_URL!);
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    const pool = getDb();
    await pool.query('DELETE FROM user_reactions');
    await pool.query('DELETE FROM price_history');
    await pool.query('DELETE FROM listings');
    await pool.query('DELETE FROM scrape_runs');
  });

  describe('upsertListing', () => {
    it('should insert a new listing', async () => {
      const { id, priceChanged } = await queries.upsertListing(makeListing());
      expect(id).toBeGreaterThan(0);
      expect(priceChanged).toBeNull();
    });

    it('should return existing listing on duplicate insert', async () => {
      const first = await queries.upsertListing(makeListing());
      const { id } = await queries.upsertListing(makeListing({ title: 'Updated Title' }));
      expect(id).toBe(first.id);
    });

    it('should detect price change on upsert', async () => {
      await queries.upsertListing(makeListing({ price: 1000 }));
      const { priceChanged } = await queries.upsertListing(makeListing({ price: 900 }));
      expect(priceChanged).not.toBeNull();
      expect(priceChanged!.oldPrice).toBe(1000);
      expect(priceChanged!.newPrice).toBe(900);
    });

    it('should not report price change when price is the same', async () => {
      await queries.upsertListing(makeListing({ price: 1000 }));
      const { priceChanged } = await queries.upsertListing(makeListing({ price: 1000 }));
      expect(priceChanged).toBeNull();
    });
  });

  describe('listingExists', () => {
    it('should return false for non-existent listing', async () => {
      expect(await queries.listingExists('dom-com-cy', 'non-existent')).toBe(false);
    });

    it('should return true for existing listing', async () => {
      await queries.upsertListing(makeListing());
      expect(await queries.listingExists('dom-com-cy', 'ext-1')).toBe(true);
    });
  });

  describe('getExistingListing', () => {
    it('should return undefined for non-existent listing', async () => {
      expect(await queries.getExistingListing('dom-com-cy', 'non-existent')).toBeUndefined();
    });

    it('should return the stored listing', async () => {
      await queries.upsertListing(makeListing());
      const stored = await queries.getExistingListing('dom-com-cy', 'ext-1');
      expect(stored).toBeDefined();
      expect(stored!.title).toBe('Test Listing');
      expect(Number(stored!.price)).toBe(1000);
    });
  });

  describe('markStaleListingsInactive', () => {
    it('should mark old listings as inactive', async () => {
      await queries.upsertListing(makeListing());
      const pool = getDb();
      await pool.query("UPDATE listings SET last_seen_at = NOW() - interval '72 hours'");

      const count = await queries.markStaleListingsInactive('dom-com-cy', 48);
      expect(count).toBe(1);

      const listing = await queries.getExistingListing('dom-com-cy', 'ext-1');
      expect(listing!.is_active).toBe(false);
    });

    it('should not mark recent listings as inactive', async () => {
      await queries.upsertListing(makeListing());
      const count = await queries.markStaleListingsInactive('dom-com-cy', 48);
      expect(count).toBe(0);
    });
  });

  describe('notification tracking', () => {
    it('should return unnotified listings', async () => {
      await queries.upsertListing(makeListing());
      const unnotified = await queries.getUnnotifiedListings();
      expect(unnotified).toHaveLength(1);
    });

    it('should not return notified listings', async () => {
      const { id } = await queries.upsertListing(makeListing());
      await queries.markNotified(id, 12345);
      const unnotified = await queries.getUnnotifiedListings();
      expect(unnotified).toHaveLength(0);
    });
  });

  describe('user reactions', () => {
    it('should save a reaction', async () => {
      const { id } = await queries.upsertListing(makeListing());
      await queries.saveReaction(id, 'user123', 'interested');

      const pool = getDb();
      const result = await pool.query('SELECT * FROM user_reactions WHERE listing_id = $1', [id]);
      expect(result.rows[0].reaction).toBe('interested');
      expect(result.rows[0].user_id).toBe('user123');
    });

    it('should update reaction on conflict', async () => {
      const { id } = await queries.upsertListing(makeListing());
      await queries.saveReaction(id, 'user123', 'interested');
      await queries.saveReaction(id, 'user123', 'not_interested');

      const pool = getDb();
      const result = await pool.query('SELECT * FROM user_reactions WHERE listing_id = $1', [id]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].reaction).toBe('not_interested');
    });
  });

  describe('findDuplicate', () => {
    it('should find cross-source duplicate by price and district', async () => {
      await queries.upsertListing(makeListing({
        source: 'bazaraki',
        externalId: 'baz-1',
        price: 1000,
        district: 'limassol',
        bedrooms: 2,
      }));

      const dup = await queries.findDuplicate(makeListing({
        source: 'dom-com-cy',
        externalId: 'dom-1',
        price: 1020,
        district: 'limassol',
        bedrooms: 2,
      }));

      expect(dup).not.toBeNull();
      expect(dup!.source).toBe('bazaraki');
    });

    it('should not match if price difference > 5%', async () => {
      await queries.upsertListing(makeListing({
        source: 'bazaraki',
        externalId: 'baz-1',
        price: 1000,
        district: 'limassol',
      }));

      const dup = await queries.findDuplicate(makeListing({
        source: 'dom-com-cy',
        externalId: 'dom-1',
        price: 1200,
        district: 'limassol',
      }));

      expect(dup).toBeNull();
    });

    it('should return null when no district', async () => {
      const dup = await queries.findDuplicate(makeListing({ district: undefined }));
      expect(dup).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct counts', async () => {
      await queries.upsertListing(makeListing({ externalId: '1', source: 'dom-com-cy' }));
      await queries.upsertListing(makeListing({ externalId: '2', source: 'bazaraki' }));

      const stats = await queries.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.bySource['dom-com-cy']).toBe(1);
      expect(stats.bySource['bazaraki']).toBe(1);
    });
  });

  describe('getListings', () => {
    it('should filter by listing type', async () => {
      await queries.upsertListing(makeListing({ externalId: '1', listingType: 'rent' }));
      await queries.upsertListing(makeListing({ externalId: '2', listingType: 'sale' }));

      const { listings, total } = await queries.getListings({ listingType: 'rent' });
      expect(total).toBe(1);
      expect(listings[0].listing_type).toBe('rent');
    });

    it('should filter by price range', async () => {
      await queries.upsertListing(makeListing({ externalId: '1', price: 500 }));
      await queries.upsertListing(makeListing({ externalId: '2', price: 1500 }));
      await queries.upsertListing(makeListing({ externalId: '3', price: 3000 }));

      const { total } = await queries.getListings({ minPrice: 400, maxPrice: 2000 });
      expect(total).toBe(2);
    });

    it('should paginate', async () => {
      for (let i = 0; i < 5; i++) {
        await queries.upsertListing(makeListing({ externalId: `${i}` }));
      }

      const { listings, total } = await queries.getListings({ limit: 2, offset: 0 });
      expect(listings).toHaveLength(2);
      expect(total).toBe(5);
    });
  });

  describe('scrape runs', () => {
    it('should track scrape run lifecycle', async () => {
      const runId = await queries.startScrapeRun('dom-com-cy');
      expect(runId).toBeGreaterThan(0);

      await queries.completeScrapeRun(runId, { newListings: 5, updatedListings: 2, errors: 1 });

      const pool = getDb();
      const result = await pool.query('SELECT * FROM scrape_runs WHERE id = $1', [runId]);
      expect(result.rows[0].status).toBe('completed');
      expect(result.rows[0].new_listings).toBe(5);
      expect(result.rows[0].errors).toBe(1);
    });

    it('should track failed runs', async () => {
      const runId = await queries.startScrapeRun();
      await queries.failScrapeRun(runId, 3);

      const pool = getDb();
      const result = await pool.query('SELECT * FROM scrape_runs WHERE id = $1', [runId]);
      expect(result.rows[0].status).toBe('failed');
      expect(result.rows[0].errors).toBe(3);
    });
  });
});
