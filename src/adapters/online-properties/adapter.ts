import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { buildFilteredUrl } from './constants.js';
import { parseIndexPage, parseDetailPage } from './parser.js';
import { sleep } from '../../utils/sleep.js';

export class OnlinePropertiesAdapter extends BaseAdapter {
  readonly name = 'online-properties';
  readonly requiresBrowser = false;

  async *discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined> {
    const listingTypes: Array<'rent' | 'sale'> = ['rent', 'sale'];

    for (const listingType of listingTypes) {
      let page = 1;
      const maxPages = ctx.sourceConfig.max_pages;

      while (page <= maxPages) {
        if (ctx.signal.aborted) return;

        await ctx.rateLimiter.wait();

        const url = buildFilteredUrl(listingType, page, {});

        ctx.logger.info({ source: this.name, page, url }, 'Fetching index page');

        try {
          const $ = await this.fetchAndParse(url);
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

    ctx.logger.debug({ source: this.name, url }, 'Scraping detail page');

    const $ = await this.fetchAndParse(url);
    return parseDetailPage($, url, externalId, this.name);
  }
}
