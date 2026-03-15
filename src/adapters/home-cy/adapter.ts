import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { buildIndexUrl } from './constants.js';
import { parseIndexPage, parseDetailPage } from './parser.js';
import { sleep } from '../../utils/sleep.js';

export class HomeCyAdapter extends BaseAdapter {
  readonly name = 'home-cy';
  readonly requiresBrowser = true; // SPA requires JavaScript rendering

  async *discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined> {
    const listingTypes: Array<'rent' | 'sale'> = ['rent', 'sale'];

    for (const listingType of listingTypes) {
      let page = 1;
      const maxPages = ctx.sourceConfig.max_pages;

      while (page <= maxPages) {
        if (ctx.signal.aborted) return;

        await ctx.rateLimiter.wait();
        const url = buildIndexUrl(listingType, page, {});

          ctx.logger.info({ source: this.name, page, url }, 'Fetching index page');

          try {
            const html = await this.fetchWithBrowser(url);
            const listings = parseIndexPage(html, listingType);

            if (listings.length === 0) break;

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
    const html = await this.fetchWithBrowser(url);
    return parseDetailPage(html, url, externalId, this.name);
  }
}
