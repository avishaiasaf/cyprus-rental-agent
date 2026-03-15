import { getDb } from './client.js';
import type { RawListing, StoredListing, PriceChange } from '../types/listing.js';

export async function listingExists(source: string, externalId: string): Promise<boolean> {
  const pool = getDb();
  const result = await pool.query(
    'SELECT 1 FROM listings WHERE source = $1 AND external_id = $2',
    [source, externalId],
  );
  return result.rowCount! > 0;
}

export async function listingNeedsRescrape(source: string, externalId: string): Promise<boolean> {
  const pool = getDb();
  const result = await pool.query(
    'SELECT 1 FROM listings WHERE source = $1 AND external_id = $2 AND (price IS NULL OR description IS NULL OR description = \'\')',
    [source, externalId],
  );
  return result.rowCount! > 0;
}

export async function getExistingListing(source: string, externalId: string): Promise<StoredListing | undefined> {
  const pool = getDb();
  const result = await pool.query(
    'SELECT * FROM listings WHERE source = $1 AND external_id = $2',
    [source, externalId],
  );
  return result.rows[0] as StoredListing | undefined;
}

export async function upsertListing(listing: RawListing): Promise<{ id: number; priceChanged: PriceChange | null }> {
  const pool = getDb();

  const existing = await getExistingListing(listing.source, listing.externalId);
  let priceChanged: PriceChange | null = null;

  if (existing && existing.price !== null && listing.price !== null && Number(existing.price) !== listing.price) {
    priceChanged = {
      listingId: existing.id,
      oldPrice: Number(existing.price),
      newPrice: listing.price,
      detectedAt: new Date().toISOString(),
    };
  }

  const result = await pool.query(`
    INSERT INTO listings (
      source, external_id, url, title, listing_type, price, currency, price_per_sqm,
      location, district, property_type, bedrooms, bathrooms,
      area_sqm, furnished, description, contact_name, contact_phone,
      contact_email, agency_name, listing_date, amenities, images, raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24
    )
    ON CONFLICT(source, external_id) DO UPDATE SET
      title = EXCLUDED.title,
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      price_per_sqm = EXCLUDED.price_per_sqm,
      location = COALESCE(EXCLUDED.location, listings.location),
      district = COALESCE(EXCLUDED.district, listings.district),
      property_type = COALESCE(EXCLUDED.property_type, listings.property_type),
      bedrooms = COALESCE(EXCLUDED.bedrooms, listings.bedrooms),
      bathrooms = COALESCE(EXCLUDED.bathrooms, listings.bathrooms),
      area_sqm = COALESCE(EXCLUDED.area_sqm, listings.area_sqm),
      furnished = COALESCE(EXCLUDED.furnished, listings.furnished),
      description = COALESCE(EXCLUDED.description, listings.description),
      images = EXCLUDED.images,
      contact_name = COALESCE(EXCLUDED.contact_name, listings.contact_name),
      contact_phone = COALESCE(EXCLUDED.contact_phone, listings.contact_phone),
      contact_email = COALESCE(EXCLUDED.contact_email, listings.contact_email),
      agency_name = COALESCE(EXCLUDED.agency_name, listings.agency_name),
      amenities = EXCLUDED.amenities,
      listing_date = COALESCE(EXCLUDED.listing_date, listings.listing_date),
      last_seen_at = NOW(),
      is_active = TRUE
    RETURNING id
  `, [
    listing.source,
    listing.externalId,
    listing.url,
    listing.title,
    listing.listingType,
    listing.price,
    listing.currency ?? 'EUR',
    listing.pricePerSqm ?? null,
    listing.location,
    listing.district ?? null,
    listing.propertyType ?? null,
    listing.bedrooms ?? null,
    listing.bathrooms ?? null,
    listing.areaSqm ?? null,
    listing.furnished ?? null,
    listing.description ?? null,
    listing.contactName ?? null,
    listing.contactPhone ?? null,
    listing.contactEmail ?? null,
    listing.agencyName ?? null,
    listing.listingDate?.toISOString() ?? null,
    listing.amenities ? JSON.stringify(listing.amenities) : '[]',
    JSON.stringify(listing.images),
    listing.raw ? JSON.stringify(listing.raw) : null,
  ]);

  const id = result.rows[0].id;

  if (priceChanged) {
    priceChanged.listingId = id;
    await recordPriceChange(priceChanged);
  }

  return { id, priceChanged };
}

export async function touchListing(source: string, externalId: string): Promise<void> {
  const pool = getDb();
  await pool.query(
    'UPDATE listings SET last_seen_at = NOW(), is_active = TRUE WHERE source = $1 AND external_id = $2',
    [source, externalId],
  );
}

export async function markStaleListingsInactive(source: string, olderThanHours: number = 48): Promise<number> {
  const pool = getDb();
  const result = await pool.query(
    'UPDATE listings SET is_active = FALSE WHERE source = $1 AND is_active = TRUE AND last_seen_at < NOW() - $2::interval',
    [source, `${olderThanHours} hours`],
  );
  return result.rowCount ?? 0;
}

export async function getUnnotifiedListings(limit: number = 50): Promise<StoredListing[]> {
  const pool = getDb();
  const result = await pool.query(
    'SELECT * FROM listings WHERE notified_at IS NULL AND is_active = TRUE ORDER BY first_seen_at DESC LIMIT $1',
    [limit],
  );
  return result.rows as StoredListing[];
}

export async function markNotified(id: number, telegramMessageId?: number): Promise<void> {
  const pool = getDb();
  await pool.query(
    'UPDATE listings SET notified_at = NOW(), telegram_message_id = $1 WHERE id = $2',
    [telegramMessageId ?? null, id],
  );
}

export async function recordPriceChange(change: PriceChange): Promise<void> {
  const pool = getDb();
  await pool.query(
    'INSERT INTO price_history (listing_id, old_price, new_price) VALUES ($1, $2, $3)',
    [change.listingId, change.oldPrice, change.newPrice],
  );
}

export async function saveReaction(listingId: number, userId: string, reaction: 'interested' | 'not_interested'): Promise<void> {
  const pool = getDb();
  await pool.query(`
    INSERT INTO user_reactions (listing_id, user_id, reaction)
    VALUES ($1, $2, $3)
    ON CONFLICT(listing_id, user_id) DO UPDATE SET
      reaction = EXCLUDED.reaction,
      reacted_at = NOW()
  `, [listingId, userId, reaction]);
}

export async function findDuplicate(listing: RawListing): Promise<StoredListing | null> {
  const pool = getDb();

  if (!listing.district || listing.price === null) return null;

  const priceLow = listing.price * 0.95;
  const priceHigh = listing.price * 1.05;

  const params: unknown[] = [listing.source, listing.district, listing.listingType, priceLow, priceHigh];
  let bedroomClause = '';
  if (listing.bedrooms != null) {
    bedroomClause = 'AND bedrooms = $6';
    params.push(listing.bedrooms);
  }

  const result = await pool.query(`
    SELECT * FROM listings
    WHERE source != $1
      AND district = $2
      AND listing_type = $3
      AND price BETWEEN $4 AND $5
      AND is_active = TRUE
      ${bedroomClause}
  `, params);

  const candidates = result.rows as StoredListing[];
  if (candidates.length === 0) return null;

  if (listing.areaSqm != null) {
    const areaLow = listing.areaSqm * 0.9;
    const areaHigh = listing.areaSqm * 1.1;
    const match = candidates.find(
      c => c.area_sqm != null && Number(c.area_sqm) >= areaLow && Number(c.area_sqm) <= areaHigh,
    );
    if (match) return match;
  }

  return candidates[0];
}

export async function getStats(): Promise<{ total: number; active: number; bySource: Record<string, number> }> {
  const pool = getDb();

  const [totalRes, activeRes, bySourceRes] = await Promise.all([
    pool.query('SELECT COUNT(*) as c FROM listings'),
    pool.query('SELECT COUNT(*) as c FROM listings WHERE is_active = TRUE'),
    pool.query('SELECT source, COUNT(*) as c FROM listings WHERE is_active = TRUE GROUP BY source'),
  ]);

  const bySource: Record<string, number> = {};
  for (const row of bySourceRes.rows) {
    bySource[row.source] = Number(row.c);
  }

  return {
    total: Number(totalRes.rows[0].c),
    active: Number(activeRes.rows[0].c),
    bySource,
  };
}

export async function getListings(opts: {
  limit?: number;
  offset?: number;
  listingType?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  source?: string;
  activeOnly?: boolean;
}): Promise<{ listings: StoredListing[]; total: number }> {
  const pool = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (opts.activeOnly !== false) {
    conditions.push('is_active = TRUE');
  }
  if (opts.listingType && opts.listingType !== 'any') {
    conditions.push(`listing_type = $${paramIdx++}`);
    params.push(opts.listingType);
  }
  if (opts.district) {
    conditions.push(`district = $${paramIdx++}`);
    params.push(opts.district);
  }
  if (opts.minPrice != null) {
    conditions.push(`price >= $${paramIdx++}`);
    params.push(opts.minPrice);
  }
  if (opts.maxPrice != null) {
    conditions.push(`price <= $${paramIdx++}`);
    params.push(opts.maxPrice);
  }
  if (opts.source) {
    conditions.push(`source = $${paramIdx++}`);
    params.push(opts.source);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRes, listingsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) as c FROM listings ${where}`, params),
    pool.query(
      `SELECT * FROM listings ${where} ORDER BY first_seen_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, opts.limit ?? 50, opts.offset ?? 0],
    ),
  ]);

  return {
    listings: listingsRes.rows as StoredListing[],
    total: Number(countRes.rows[0].c),
  };
}

export async function searchListings(opts: {
  query: string;
  listingType?: string;
  district?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  furnished?: boolean;
  source?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ listings: StoredListing[]; total: number }> {
  const pool = getDb();
  const conditions: string[] = ['is_active = TRUE'];
  const params: unknown[] = [];
  let paramIdx = 1;

  // Full-text search
  let orderBy = 'first_seen_at DESC';
  if (opts.query) {
    conditions.push(`search_vector @@ websearch_to_tsquery('english', $${paramIdx++})`);
    params.push(opts.query);
    orderBy = `ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC`;
  }

  if (opts.listingType && opts.listingType !== 'any') {
    conditions.push(`listing_type = $${paramIdx++}`);
    params.push(opts.listingType);
  }
  if (opts.district) {
    conditions.push(`district = $${paramIdx++}`);
    params.push(opts.district);
  }
  if (opts.propertyType) {
    conditions.push(`property_type = $${paramIdx++}`);
    params.push(opts.propertyType);
  }
  if (opts.minPrice != null) {
    conditions.push(`price >= $${paramIdx++}`);
    params.push(opts.minPrice);
  }
  if (opts.maxPrice != null) {
    conditions.push(`price <= $${paramIdx++}`);
    params.push(opts.maxPrice);
  }
  if (opts.minBedrooms != null) {
    conditions.push(`bedrooms >= $${paramIdx++}`);
    params.push(opts.minBedrooms);
  }
  if (opts.maxBedrooms != null) {
    conditions.push(`bedrooms <= $${paramIdx++}`);
    params.push(opts.maxBedrooms);
  }
  if (opts.furnished != null) {
    conditions.push(`furnished = $${paramIdx++}`);
    params.push(opts.furnished);
  }
  if (opts.source) {
    conditions.push(`source = $${paramIdx++}`);
    params.push(opts.source);
  }

  // Sort override
  if (opts.sort) {
    const sortMap: Record<string, string> = {
      'price_asc': 'price ASC NULLS LAST',
      'price_desc': 'price DESC NULLS LAST',
      'newest': 'first_seen_at DESC',
      'oldest': 'first_seen_at ASC',
    };
    orderBy = sortMap[opts.sort] || orderBy;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [countRes, listingsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) as c FROM listings ${where}`, params),
    pool.query(
      `SELECT * FROM listings ${where} ORDER BY ${orderBy} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, opts.limit ?? 50, opts.offset ?? 0],
    ),
  ]);

  return {
    listings: listingsRes.rows as StoredListing[],
    total: Number(countRes.rows[0].c),
  };
}

export async function getListingById(id: number): Promise<StoredListing | undefined> {
  const pool = getDb();
  const result = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
  return result.rows[0] as StoredListing | undefined;
}

export async function startScrapeRun(source?: string): Promise<number> {
  const pool = getDb();
  const result = await pool.query(
    'INSERT INTO scrape_runs (started_at, source) VALUES (NOW(), $1) RETURNING id',
    [source ?? null],
  );
  return result.rows[0].id;
}

export async function completeScrapeRun(
  runId: number,
  stats: { newListings: number; updatedListings: number; errors: number },
): Promise<void> {
  const pool = getDb();
  await pool.query(
    "UPDATE scrape_runs SET completed_at = NOW(), status = 'completed', new_listings = $1, updated_listings = $2, errors = $3 WHERE id = $4",
    [stats.newListings, stats.updatedListings, stats.errors, runId],
  );
}

export async function failScrapeRun(runId: number, errors: number): Promise<void> {
  const pool = getDb();
  await pool.query(
    "UPDATE scrape_runs SET completed_at = NOW(), status = 'failed', errors = $1 WHERE id = $2",
    [errors, runId],
  );
}

export async function getScrapeRuns(limit: number = 20): Promise<any[]> {
  const pool = getDb();
  const result = await pool.query(
    'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT $1',
    [limit],
  );
  return result.rows;
}

// --- Webhook queries ---

export interface WebhookSubscription {
  id: string;
  url: string;
  name: string;
  filters: Record<string, unknown>;
  is_active: boolean;
  signing_secret: string | null;
  failure_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createWebhook(data: {
  url: string;
  name?: string;
  filters?: Record<string, unknown>;
  signing_secret?: string;
}): Promise<WebhookSubscription> {
  const pool = getDb();
  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (url, name, filters, signing_secret)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.url, data.name ?? '', data.filters ? JSON.stringify(data.filters) : '{}', data.signing_secret ?? null],
  );
  return result.rows[0] as WebhookSubscription;
}

export async function getWebhooks(): Promise<WebhookSubscription[]> {
  const pool = getDb();
  const result = await pool.query('SELECT * FROM webhook_subscriptions ORDER BY created_at DESC');
  return result.rows as WebhookSubscription[];
}

export async function getActiveWebhooks(): Promise<WebhookSubscription[]> {
  const pool = getDb();
  const result = await pool.query('SELECT * FROM webhook_subscriptions WHERE is_active = TRUE');
  return result.rows as WebhookSubscription[];
}

export async function updateWebhook(id: string, data: {
  url?: string;
  name?: string;
  filters?: Record<string, unknown>;
  is_active?: boolean;
}): Promise<WebhookSubscription | undefined> {
  const pool = getDb();
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.url !== undefined) {
    sets.push(`url = $${paramIdx++}`);
    params.push(data.url);
  }
  if (data.name !== undefined) {
    sets.push(`name = $${paramIdx++}`);
    params.push(data.name);
  }
  if (data.filters !== undefined) {
    sets.push(`filters = $${paramIdx++}`);
    params.push(JSON.stringify(data.filters));
  }
  if (data.is_active !== undefined) {
    sets.push(`is_active = $${paramIdx++}`);
    params.push(data.is_active);
  }

  params.push(id);
  const result = await pool.query(
    `UPDATE webhook_subscriptions SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );
  return result.rows[0] as WebhookSubscription | undefined;
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const pool = getDb();
  const result = await pool.query('DELETE FROM webhook_subscriptions WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function incrementWebhookFailure(id: string): Promise<void> {
  const pool = getDb();
  await pool.query(
    'UPDATE webhook_subscriptions SET failure_count = failure_count + 1, updated_at = NOW() WHERE id = $1',
    [id],
  );
}

export async function resetWebhookFailure(id: string): Promise<void> {
  const pool = getDb();
  await pool.query(
    'UPDATE webhook_subscriptions SET failure_count = 0, last_triggered_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id],
  );
}

export async function disableWebhook(id: string): Promise<void> {
  const pool = getDb();
  await pool.query(
    'UPDATE webhook_subscriptions SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
    [id],
  );
}
