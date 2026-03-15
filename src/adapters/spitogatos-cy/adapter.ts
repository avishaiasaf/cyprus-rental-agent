import { BaseAdapter } from '../base-adapter.js';
import { load as cheerioLoad } from 'cheerio';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { buildFilteredUrl } from './constants.js';
import { parseIndexPage, parseDetailPage } from './parser.js';
import { sleep } from '../../utils/sleep.js';

/**
 * Spitogatos.cy adapter — uses Playwright because the site is a React SPA
 * that requires JavaScript for rendering property listings.
 */
export class SpitogatosCyAdapter extends BaseAdapter {
  readonly name = 'spitogatos-cy';
  readonly requiresBrowser = true;

  async *discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined> {
    const listingTypes: Array<'rent' | 'sale'> = ['rent', 'sale'];

    for (const listingType of listingTypes) {
      let page = 1;
      const maxPages = ctx.sourceConfig.max_pages;

      while (page <= maxPages) {
        if (ctx.signal.aborted) return;

        await ctx.rateLimiter.wait();

        const url = buildFilteredUrl(listingType, page, {});

        ctx.logger.info({ source: this.name, page, url }, 'Fetching index page (browser)');

        try {
          const html = await this.fetchWithBrowser(url);
          const $ = cheerioLoad(html);
          const listings = parseIndexPage($, listingType);

          if (listings.length === 0) {
            ctx.logger.info({ source: this.name, page }, 'No more listings found');
            break;
          }

          ctx.logger.info({ source: this.name, page, count: listings.length }, 'Parsed listings from index');

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

    ctx.logger.debug({ source: this.name, url }, 'Scraping detail page (browser)');

    const html = await this.fetchWithBrowser(url);
    const $ = cheerioLoad(html);
    return parseDetailPage($, url, externalId, this.name);
  }
}
