import type { SourceAdapter, AdapterContext, DiscoveredListing } from '../types/adapter.js';
import type { RawListing } from '../types/listing.js';
import { load as cheerioLoad, type CheerioAPI } from 'cheerio';

const DISTRICTS = ['limassol', 'paphos', 'nicosia', 'larnaca', 'famagusta', 'kyrenia'] as const;

export abstract class BaseAdapter implements SourceAdapter {
  abstract readonly name: string;
  abstract readonly requiresBrowser: boolean;

  protected ctx!: AdapterContext;

  async init(ctx: AdapterContext): Promise<void> {
    this.ctx = ctx;
  }

  abstract discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined>;
  abstract scrapeDetail(url: string, externalId: string, ctx: AdapterContext): Promise<RawListing>;

  async dispose(): Promise<void> {
    // Override in subclasses if cleanup needed
  }

  // --- Shared Utilities ---

  protected parsePrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  protected normalizeDistrict(location: string): string | undefined {
    const lower = location.toLowerCase();
    // Handle common alternative names
    const aliases: Record<string, string> = {
      'lemesos': 'limassol',
      'lefkosia': 'nicosia',
      'pafos': 'paphos',
      'larnaka': 'larnaca',
      'ammochostos': 'famagusta',
      'keryneia': 'kyrenia',
    };

    for (const [alias, canonical] of Object.entries(aliases)) {
      if (lower.includes(alias)) return canonical;
    }

    return DISTRICTS.find(d => lower.includes(d));
  }

  protected async fetchAndParse(url: string): Promise<CheerioAPI> {
    const html = await this.ctx.httpClient.get(url);
    return cheerioLoad(html);
  }

  protected async fetchWithBrowser(url: string): Promise<string> {
    if (!this.ctx.browser) throw new Error(`Browser not available for ${this.name}`);
    const context = await this.ctx.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'Europe/Nicosia',
    });

    // Stealth: override navigator.webdriver
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(globalThis, 'chrome', { value: { runtime: {} }, writable: true });
    });

    const page = await context.newPage();
    try {
      // Block unnecessary resources to save memory
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', route => route.abort());

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.ctx.globalConfig.browser.timeout_ms,
      });

      // Wait a bit for any dynamic content to load
      await page.waitForTimeout(2000);

      return await page.content();
    } finally {
      await page.close();
      await context.close();
    }
  }

  /**
   * Enhanced browser fetch for detail pages: returns both HTML and in-browser extracted data.
   * Uses page.evaluate() to extract price/description directly from the live DOM,
   * which catches dynamically-rendered content that Cheerio may miss.
   */
  protected async fetchDetailWithBrowser(url: string): Promise<{
    html: string;
    extracted: { price?: string | null; description?: string | null };
  }> {
    if (!this.ctx.browser) throw new Error(`Browser not available for ${this.name}`);
    const context = await this.ctx.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'Europe/Nicosia',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(globalThis, 'chrome', { value: { runtime: {} }, writable: true });
    });

    const page = await context.newPage();
    try {
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', route => route.abort());

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.ctx.globalConfig.browser.timeout_ms,
      });

      // Wait for price element specifically (up to 5s), then fallback to generic wait
      try {
        await page.waitForSelector(
          '.announcement-price, .announcement__price, [data-price], meta[itemprop="price"]',
          { timeout: 5000 },
        );
      } catch {
        // Price element didn't appear, continue with generic wait
        await page.waitForTimeout(2000);
      }

      // Extract price and description directly from the live DOM via page.evaluate()
      // The function runs in browser context so it has access to `document`.
      const extracted = await page.evaluate(`
        (() => {
          let price = null;
          let description = null;

          // Price extraction strategies
          const priceSelectors = [
            '.announcement-price__cost',
            '.announcement-price .actual-price',
            '.announcement-price',
            '.announcement__price .actual-price',
            '.announcement__price',
          ];
          for (const sel of priceSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              const text = (el.textContent || '').trim();
              if (text && /[\\d]/.test(text)) {
                price = text;
                break;
              }
            }
          }

          // Try data-price attribute
          if (!price) {
            const dpEl = document.querySelector('[data-price]');
            if (dpEl) price = dpEl.getAttribute('data-price');
          }

          // Try meta itemprop price
          if (!price) {
            const metaEl = document.querySelector('meta[itemprop="price"]');
            if (metaEl && metaEl.content) price = metaEl.content;
          }

          // Description extraction strategies
          const descSelectors = [
            '.announcement-description .js-description',
            '.announcement-description',
            '.announcement__description .js-description',
            '.announcement__description',
            '[itemprop="description"]',
          ];
          for (const sel of descSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              const text = (el.textContent || '').trim();
              if (text && text.length > 10) {
                description = text;
                break;
              }
            }
          }

          // Fallback to og:description
          if (!description) {
            const ogEl = document.querySelector('meta[property="og:description"]');
            if (ogEl && ogEl.content) description = ogEl.content;
          }

          return { price, description };
        })()
      `) as { price: string | null; description: string | null };

      const html = await page.content();
      return { html, extracted };
    } finally {
      await page.close();
      await context.close();
    }
  }

  protected matchesFilters(listing: Partial<RawListing>): boolean {
    const filters = this.ctx.globalConfig.filters;

    // Check listing type
    if (filters.listing_type !== 'any' && listing.listingType) {
      const filterType = filters.listing_type === 'buy' ? 'sale' : filters.listing_type;
      if (listing.listingType !== filterType) return false;
    }

    // Check location
    if (filters.locations.length > 0 && listing.location) {
      const loc = listing.location.toLowerCase();
      const matches = filters.locations.some(l => loc.includes(l.toLowerCase()));
      if (!matches) return false;
    }

    // Check price
    if (listing.price != null) {
      if (filters.min_price_eur != null && listing.price < filters.min_price_eur) return false;
      if (filters.max_price_eur != null && listing.price > filters.max_price_eur) return false;
    }

    // Check bedrooms
    if (listing.bedrooms != null) {
      if (filters.min_bedrooms != null && listing.bedrooms < filters.min_bedrooms) return false;
      if (filters.max_bedrooms != null && listing.bedrooms > filters.max_bedrooms) return false;
    }

    // Check keywords
    if (listing.description) {
      const desc = listing.description.toLowerCase();

      if (filters.keywords_include.length > 0) {
        const hasInclude = filters.keywords_include.some(kw => desc.includes(kw.toLowerCase()));
        if (!hasInclude) return false;
      }

      if (filters.keywords_exclude.length > 0) {
        const hasExclude = filters.keywords_exclude.some(kw => desc.includes(kw.toLowerCase()));
        if (hasExclude) return false;
      }
    }

    return true;
  }
}
