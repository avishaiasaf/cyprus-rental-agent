import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { buildIndexUrl } from './constants.js';
import { parseIndexPage, parseDetailPage, isAntiBot, type BrowserExtracted } from './parser.js';
import { sleep } from '../../utils/sleep.js';
import type { BrowserContext, Page } from 'patchright';

export class BazarakiAdapter extends BaseAdapter {
  readonly name = 'bazaraki';
  readonly requiresBrowser = true;

  // Single shared browser context — index pages establish anti-bot cookies
  // that are then reused for detail pages
  private sharedContext: BrowserContext | null = null;
  private sharedPage: Page | null = null;

  /**
   * Get or create a persistent browser context shared across ALL page loads.
   * This ensures anti-bot cookies set during index page loads carry over to detail pages.
   */
  private async getSharedPage(): Promise<Page> {
    if (this.sharedPage && !this.sharedPage.isClosed()) {
      return this.sharedPage;
    }

    if (!this.ctx.browser) throw new Error('Browser not available for bazaraki');

    // Close old context if exists
    if (this.sharedContext) {
      try { await this.sharedContext.close(); } catch { /* ignore */ }
    }

    this.sharedContext = await this.ctx.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'Europe/Nicosia',
    });

    await this.sharedContext.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(globalThis, 'chrome', { value: { runtime: {} }, writable: true });
    });

    this.sharedPage = await this.sharedContext.newPage();

    // Block heavy resources to save bandwidth, but keep images for detail pages
    await this.sharedPage.route('**/*.{woff,woff2,ttf,eot}', route => route.abort());

    return this.sharedPage;
  }

  /**
   * Navigate the shared page to a URL and return the HTML content.
   * Handles anti-bot challenge detection and waiting.
   */
  private async navigateSharedPage(url: string, waitTimeout = 3000): Promise<string> {
    const page = await this.getSharedPage();

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.ctx.globalConfig.browser.timeout_ms,
      });

      await page.waitForTimeout(waitTimeout);

      let html = await page.content();

      // If anti-bot page, wait up to 10 more seconds for auto-resolution
      if (isAntiBot(html)) {
        this.ctx.logger.info({ source: this.name, url }, 'Anti-bot challenge, waiting for auto-resolution...');
        try {
          await page.waitForSelector(
            'h1.announcement-title, h1.announcement__title, .announcement-price, .announcement-container, a[href*="/adv/"]',
            { timeout: 10000 },
          );
          html = await page.content();
        } catch {
          // Still blocked
          this.ctx.logger.warn({ source: this.name, url }, 'Anti-bot challenge did not resolve');
        }
      }

      return html;
    } catch (err) {
      // Page navigation failed — try to recover
      this.ctx.logger.warn({ source: this.name, url, err }, 'Page navigation failed, resetting page');
      try {
        if (this.sharedPage && !this.sharedPage.isClosed()) {
          await this.sharedPage.close();
        }
      } catch { /* ignore */ }
      this.sharedPage = null;
      throw err;
    }
  }

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
          // Use shared browser context — cookies established here carry to detail pages
          const html = await this.navigateSharedPage(url);

          if (isAntiBot(html)) {
            ctx.logger.warn({ source: this.name, page, listingType }, 'Index page blocked by anti-bot');
            break;
          }

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

  async scrapeDetail(url: string, externalId: string, ctx: AdapterContext): Promise<RawListing> {
    await ctx.rateLimiter.wait();

    ctx.logger.debug({ source: this.name, url }, 'Scraping detail page');

    // Use the shared browser context (has anti-bot cookies from index page loads)
    const html = await this.navigateSharedPage(url, 2000);

    // If anti-bot blocked this page, return minimal listing
    if (isAntiBot(html)) {
      return parseDetailPage(html, url, externalId, this.name, undefined, ctx.logger);
    }

    // Extract data via page.evaluate() in browser context
    const page = await this.getSharedPage();
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
  }

  async dispose(): Promise<void> {
    try {
      if (this.sharedPage && !this.sharedPage.isClosed()) {
        await this.sharedPage.close();
      }
    } catch { /* ignore */ }

    try {
      if (this.sharedContext) {
        await this.sharedContext.close();
      }
    } catch { /* ignore */ }

    this.sharedPage = null;
    this.sharedContext = null;
  }
}
