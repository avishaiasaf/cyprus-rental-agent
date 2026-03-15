import express from 'express';
import cors from 'cors';
import type { AppConfig } from '../config/schema.js';
import * as db from '../db/queries.js';

export function startApiServer(port: number, config: AppConfig): void {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // --- Health ---
  app.get('/health', async (_req, res) => {
    try {
      const stats = await db.getStats();
      res.json({ status: 'ok', timestamp: new Date().toISOString(), stats });
    } catch {
      res.status(500).json({ status: 'error' });
    }
  });

  // --- Listings API ---

  // Search + filter listings (full-text search when `q` is present)
  app.get('/api/listings', async (req, res) => {
    try {
      const q = req.query as Record<string, string>;
      const perPage = Math.min(parseInt(q.per_page ?? '50', 10), 200);
      const page = Math.max(1, parseInt(q.page ?? '1', 10));
      const offset = (page - 1) * perPage;

      // If full-text query provided, use searchListings, otherwise getListings
      if (q.q) {
        const { listings, total } = await db.searchListings({
          query: q.q,
          listingType: q.type,
          district: q.district,
          propertyType: q.property_type,
          minPrice: q.min_price ? parseFloat(q.min_price) : undefined,
          maxPrice: q.max_price ? parseFloat(q.max_price) : undefined,
          minBedrooms: q.min_bedrooms ? parseInt(q.min_bedrooms, 10) : undefined,
          maxBedrooms: q.max_bedrooms ? parseInt(q.max_bedrooms, 10) : undefined,
          furnished: q.furnished === 'true' ? true : q.furnished === 'false' ? false : undefined,
          source: q.source,
          sort: q.sort,
          limit: perPage,
          offset,
        });

        res.json({
          total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(total / perPage),
          listings: listings.map(normalizeListing),
        });
      } else {
        const { listings, total } = await db.getListings({
          listingType: q.type,
          district: q.district,
          minPrice: q.min_price ? parseFloat(q.min_price) : undefined,
          maxPrice: q.max_price ? parseFloat(q.max_price) : undefined,
          source: q.source,
          limit: perPage,
          offset,
        });

        res.json({
          total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(total / perPage),
          listings: listings.map(normalizeListing),
        });
      }
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Single listing detail
  app.get('/api/listings/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }
      const listing = await db.getListingById(id);
      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }
      res.json(normalizeListing(listing));
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // --- Stats ---
  app.get('/api/stats', async (_req, res) => {
    try {
      const stats = await db.getStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // --- Scrape runs ---
  app.get('/api/scrape-runs', async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query as any).limit ?? '20', 10), 100);
      const runs = await db.getScrapeRuns(limit);
      res.json(runs);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // --- Sources ---
  app.get('/api/sources', async (_req, res) => {
    try {
      const stats = await db.getStats();
      const sources = Object.entries(stats.bySource).map(([name, count]) => ({
        name,
        active_listings: count,
      }));
      res.json(sources);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // --- Webhooks CRUD ---
  app.post('/api/webhooks', async (req, res) => {
    try {
      const { url, name, filters, signing_secret } = req.body;
      if (!url) {
        res.status(400).json({ error: 'url is required' });
        return;
      }
      const webhook = await db.createWebhook({ url, name, filters, signing_secret });
      res.status(201).json(webhook);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/webhooks', async (_req, res) => {
    try {
      const webhooks = await db.getWebhooks();
      res.json(webhooks);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.put('/api/webhooks/:id', async (req, res) => {
    try {
      const { url, name, filters, is_active } = req.body;
      const webhook = await db.updateWebhook(req.params.id, { url, name, filters, is_active });
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }
      res.json(webhook);
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/api/webhooks/:id', async (req, res) => {
    try {
      const deleted = await db.deleteWebhook(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // --- Legacy Dashboard (HTML) ---
  app.get('/', async (req, res) => {
    try {
      const query = req.query as Record<string, string>;
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = 20;
      const offset = (page - 1) * limit;

      const { listings, total } = await db.getListings({
        limit,
        offset,
        listingType: query.type,
        district: query.district,
        minPrice: query.min_price ? parseFloat(query.min_price) : undefined,
        maxPrice: query.max_price ? parseFloat(query.max_price) : undefined,
        source: query.source,
      });

      const totalPages = Math.ceil(total / limit);
      const stats = await db.getStats();

      res.send(renderDashboard(listings, stats, { page, totalPages, total, query }));
    } catch {
      res.status(500).send('Internal Server Error');
    }
  });

  app.listen(port, '0.0.0.0');
}

// Normalize a listing for JSON API output
function normalizeListing(l: any): Record<string, unknown> {
  return {
    ...l,
    images: l.images ?? [],
    amenities: l.amenities ?? [],
    price: l.price != null ? Number(l.price) : null,
    area_sqm: l.area_sqm != null ? Number(l.area_sqm) : null,
    price_per_sqm: l.price_per_sqm != null ? Number(l.price_per_sqm) : null,
  };
}

// --- HTML Dashboard (kept for backward compat) ---

function renderDashboard(
  listings: any[],
  stats: Awaited<ReturnType<typeof db.getStats>>,
  opts: { page: number; totalPages: number; total: number; query: Record<string, string> },
): string {
  const listingCards = listings.map((l: any) => {
    const images = Array.isArray(l.images) ? l.images : [];
    const firstImage = images[0]?.url ?? '';
    const badge = l.listing_type === 'rent'
      ? '<span class="badge rent">FOR RENT</span>'
      : '<span class="badge sale">FOR SALE</span>';
    const price = l.price != null
      ? `&euro;${Number(l.price).toLocaleString('en-US')}${l.listing_type === 'rent' ? '/mo' : ''}`
      : 'Price on request';

    return `
      <div class="card">
        ${firstImage ? `<img src="${firstImage}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="no-image">No Image</div>'}
        <div class="card-body">
          ${badge}
          <h3><a href="${l.url}" target="_blank">${escapeHtml(l.title)}</a></h3>
          <div class="price">${price}</div>
          <div class="details">
            ${l.location ? `<span>&#x1F4CD; ${escapeHtml(l.location)}</span>` : ''}
            ${l.bedrooms != null ? `<span>${l.bedrooms} bed</span>` : ''}
            ${l.bathrooms != null ? `<span>${l.bathrooms} bath</span>` : ''}
            ${l.area_sqm != null ? `<span>${l.area_sqm} m&sup2;</span>` : ''}
          </div>
          <div class="source">${escapeHtml(l.source)} &middot; ${l.first_seen_at ? new Date(l.first_seen_at).toISOString().slice(0, 10) : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  const pagination = opts.totalPages > 1 ? `
    <div class="pagination">
      ${opts.page > 1 ? `<a href="?page=${opts.page - 1}&${buildQuery(opts.query)}">&larr; Prev</a>` : ''}
      <span>Page ${opts.page} of ${opts.totalPages} (${opts.total} listings)</span>
      ${opts.page < opts.totalPages ? `<a href="?page=${opts.page + 1}&${buildQuery(opts.query)}">Next &rarr;</a>` : ''}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyprus Rental Agent</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .header { background: #1a73e8; color: white; padding: 20px; }
    .header h1 { font-size: 24px; }
    .stats { display: flex; gap: 20px; margin-top: 10px; font-size: 14px; opacity: 0.9; }
    .filters { padding: 15px 20px; background: white; border-bottom: 1px solid #ddd; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .filters select, .filters input { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    .filters button { padding: 6px 16px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; padding: 20px; }
    .card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card img { width: 100%; height: 200px; object-fit: cover; }
    .no-image { width: 100%; height: 200px; background: #eee; display: flex; align-items: center; justify-content: center; color: #999; }
    .card-body { padding: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-bottom: 6px; }
    .badge.rent { background: #e3f2fd; color: #1565c0; }
    .badge.sale { background: #fce4ec; color: #c62828; }
    .card h3 { font-size: 16px; margin-bottom: 6px; }
    .card h3 a { color: #1a73e8; text-decoration: none; }
    .price { font-size: 20px; font-weight: 700; color: #2e7d32; margin-bottom: 6px; }
    .details { display: flex; gap: 10px; font-size: 13px; color: #666; flex-wrap: wrap; }
    .source { font-size: 12px; color: #999; margin-top: 8px; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 20px; }
    .pagination a { color: #1a73e8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>&#x1F3E0; Cyprus Rental Agent</h1>
    <div class="stats">
      <span>Total: ${stats.total}</span>
      <span>Active: ${stats.active}</span>
      ${Object.entries(stats.bySource).map(([s, c]) => `<span>${s}: ${c}</span>`).join('')}
    </div>
  </div>
  <form class="filters" method="GET" action="/">
    <select name="type">
      <option value="">All Types</option>
      <option value="rent" ${opts.query.type === 'rent' ? 'selected' : ''}>Rent</option>
      <option value="sale" ${opts.query.type === 'sale' ? 'selected' : ''}>Sale</option>
    </select>
    <select name="district">
      <option value="">All Districts</option>
      ${['limassol', 'paphos', 'nicosia', 'larnaca', 'famagusta'].map(d =>
        `<option value="${d}" ${opts.query.district === d ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`
      ).join('')}
    </select>
    <input type="number" name="min_price" placeholder="Min &euro;" value="${opts.query.min_price ?? ''}" style="width:80px">
    <input type="number" name="max_price" placeholder="Max &euro;" value="${opts.query.max_price ?? ''}" style="width:80px">
    <button type="submit">Filter</button>
  </form>
  <div class="grid">${listingCards || '<p style="padding:20px;grid-column:1/-1">No listings found.</p>'}</div>
  ${pagination}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildQuery(query: Record<string, string>): string {
  return Object.entries(query)
    .filter(([k]) => k !== 'page')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}
