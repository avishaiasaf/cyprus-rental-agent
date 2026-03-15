import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { buildIndexUrl } from './constants.js';
import { parseIndexPage, parseDetailPage, isAntiBot, type BrowserExtracted } from './parser.js';
import { sleep } from '../../utils/sleep.js';
import type { BrowserContext, Page } from 'playwright';

export class BazarakiAdapter extends BaseAdapter {
  readonly name = 'bazaraki';
  readonly requiresBrowser = true;

  // Persistent browser context for detail pages (reduces anti-bot triggers)
  private detailContext: BrowserContext | null = null;
  private detailPage: Page | null = null;

  async *discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined> {
    const listingTypes: Array<'rent' | 'sale'> = ['rent', 'sale'];

    for (const listingType of listingTypes) {
      let page = 1;
      const maxPages = ctx.sourceConfig.max_pages;

      while (page <= maxPages) {
        if (ctx.signal.aborted) return;

        await ctx.rateLimiter.wait();

        const url = buildIndexUrl(listingType, page, {});

        ctx.logger.info({ source: this.name, page, listingType, url }, 'Fetching index page');

          try {
            const html = await this.fetchWithBrowser(url);
            const listings = parseIndexPage(html, listingType);

            if (listings.length === 0) {
              ctx.logger.info({ source: this.name, page }, 'No more listings found');
              break;
            }

            ctx.logger.info({ source: this.name, page, count: listings.length }, 'Parsed listings');

            for (const listing of listings) {
              yield listing;
            }

            page++;
            await sleep(ctx.sourceConfig.delay_between_pages_ms);
          } catch (err) {
            ctx.logger.error({ source: this.name, page, err }, 'Failed to fetch index page');
            break;
          }
        }
    }
  }

  /**
   * Get or create a persistent browser context for detail pages.
   * Reusing one context across multiple page loads keeps cookies/session state,
   * which helps pass anti-bot challenges that often rely on cookie checks.
   */
  private async getDetailPage(): Promise<Page> {
    if (this.detailPage && !this.detailPage.isClosed()) {
      return this.detailPage;
    }

    if (!this.ctx.browser) throw new Error('Browser not available for bazaraki');

    // Close old context if exists
    if (this.detailContext) {
      try { await this.detailContext.close(); } catch { /* ignore */ }
    }

    this.detailContext = await this.ctx.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'Europe/Nicosia',
    });

    await this.detailContext.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(globalThis, 'chrome', { value: { runtime: {} }, writable: true });
    });

    this.detailPage = await this.detailContext.newPage();

    // Don't block images on detail pages — they're needed for listing images
    // But block fonts and other unnecessary resources
    await this.detailPage.route('**/*.{woff,woff2,ttf,eot}', route => route.abort());

    return this.detailPage;
  }

  async scrapeDetail(url: string, externalId: string, ctx: AdapterContext): Promise<RawListing> {
    await ctx.rateLimiter.wait();

    ctx.logger.debug({ source: this.name, url }, 'Scraping detail page');

    const page = await this.getDetailPage();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: ctx.globalConfig.browser.timeout_ms,
      });

      // Wait for the price element (real listing page) or for the challenge to resolve
      try {
        await page.waitForSelector(
          '.announcement-price, .announcement__price, [data-price], h1.announcement-title, h1.announcement__title',
          { timeout: 8000 },
        );
      } catch {
        // Element didn't appear — might be anti-bot page, wait longer
        await page.waitForTimeout(5000);
      }

      let html = await page.content();

      // If it's an anti-bot page, wait up to 15 more seconds for it to resolve
      if (isAntiBot(html)) {
        ctx.logger.info({ source: this.name, url }, 'Anti-bot challenge detected, waiting for resolution...');
        try {
          await page.waitForSelector('h1.announcement-title, h1.announcement__title, .announcement-price', {
            timeout: 15000,
          });
          html = await page.content();
        } catch {
          // Still blocked — return minimal listing
          ctx.logger.warn({ source: this.name, url }, 'Anti-bot challenge did not resolve, skipping');
          return parseDetailPage(html, url, externalId, this.name, undefined, ctx.logger);
        }
      }

      // Extract data via page.evaluate() in browser context
      const extracted = await page.evaluate(`
        (() => {
          let price = null;
          let description = null;

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

          if (!price) {
            const dpEl = document.querySelector('[data-price]');
            if (dpEl) price = dpEl.getAttribute('data-price');
          }

          if (!price) {
            const metaEl = document.querySelector('meta[itemprop="price"]');
            if (metaEl && metaEl.content) price = metaEl.content;
          }

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

          if (!description) {
            const ogEl = document.querySelector('meta[property="og:description"]');
            if (ogEl && ogEl.content) description = ogEl.content;
          }

          return { price, description };
        })()
      `) as { price: string | null; description: string | null };

      const browserData: BrowserExtracted = {
        price: extracted.price,
        description: extracted.description,
      };

      return parseDetailPage(html, url, externalId, this.name, browserData, ctx.logger);
    } catch (err) {
      // If page navigation fails, try to recover by creating a new page
      ctx.logger.warn({ source: this.name, url, err }, 'Detail page load failed, resetting page');
      try {
        if (this.detailPage && !this.detailPage.isClosed()) {
          await this.detailPage.close();
        }
      } catch { /* ignore */ }
      this.detailPage = null;
      throw err;
    }
  }

  async dispose(): Promise<void> {
    try {
      if (this.detailPage && !this.detailPage.isClosed()) {
        await this.detailPage.close();
      }
    } catch { /* ignore */ }

    try {
      if (this.detailContext) {
        await this.detailContext.close();
      }
    } catch { /* ignore */ }

    this.detailPage = null;
    this.detailContext = null;
  }
}
