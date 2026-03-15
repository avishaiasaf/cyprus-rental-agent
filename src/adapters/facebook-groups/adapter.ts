import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { APIFY_ACTOR_ID, FALLBACK_ACTOR_IDS, DEFAULT_ACTOR_INPUT } from './constants.js';
import { parsePostToDiscovered, postToRawListing, type FacebookPost } from './parser.js';
import { scrapeGroupWithPlaywright } from './playwright-scraper.js';

/**
 * Facebook Groups adapter.
 *
 * Fallback chain: Apify API → Playwright with cookies → skip with warning.
 * Implements a cache pattern: discoverListings() fetches all posts and caches them,
 * then scrapeDetail() reads from the cache (no second API call needed).
 */
export class FacebookGroupsAdapter extends BaseAdapter {
  readonly name = 'facebook-groups';
  readonly requiresBrowser = false; // true only when Playwright fallback kicks in

  // Cache: externalId -> FacebookPost (populated during discovery, consumed during detail)
  private postCache = new Map<string, FacebookPost>();

  async init(ctx: AdapterContext): Promise<void> {
    await super.init(ctx);
    this.postCache.clear();
  }

  async *discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined> {
    const apifyConfig = ctx.globalConfig.apify;
    const fbConfig = ctx.globalConfig.facebook_groups;

    if (!fbConfig?.groups || fbConfig.groups.length === 0) {
      ctx.logger.warn({ source: this.name }, 'No Facebook groups configured, skipping');
      return;
    }

    // Decide scraping strategy: Apify → Playwright → skip
    const useApify = !!apifyConfig?.api_token;
    const usePlaywright = !useApify && !!fbConfig.cookie_file && !!ctx.browser;

    if (!useApify && !usePlaywright) {
      ctx.logger.warn(
        { source: this.name },
        'Neither Apify API token nor Playwright cookie_file + browser configured, skipping Facebook groups',
      );
      return;
    }

    // Lazy import apify-client only if needed
    let apifyClient: any = null;
    if (useApify) {
      try {
        const mod = await import('apify-client');
        apifyClient = new mod.ApifyClient({ token: apifyConfig!.api_token });
      } catch {
        ctx.logger.error(
          { source: this.name },
          'apify-client package not installed. Run: npm install apify-client',
        );
        // Fall through to Playwright if possible
        if (!fbConfig.cookie_file || !ctx.browser) return;
      }
    }

    for (const group of fbConfig.groups) {
      if (ctx.signal.aborted) return;

      let posts: FacebookPost[] = [];

      // Strategy 1: Apify
      if (apifyClient) {
        try {
          ctx.logger.info(
            { source: this.name, group: group.name || group.url },
            'Scraping Facebook group via Apify',
          );
          posts = await this.fetchGroupPosts(apifyClient, group.url, apifyConfig!, ctx);
        } catch (err) {
          ctx.logger.warn(
            { source: this.name, group: group.name || group.url, err },
            'Apify failed, trying Playwright fallback',
          );
        }
      }

      // Strategy 2: Playwright fallback
      if (posts.length === 0 && fbConfig.cookie_file && ctx.browser) {
        try {
          ctx.logger.info(
            { source: this.name, group: group.name || group.url },
            'Scraping Facebook group via Playwright',
          );
          posts = await scrapeGroupWithPlaywright(group.url, {
            browser: ctx.browser,
            cookieFile: fbConfig.cookie_file,
            logger: ctx.logger,
            timeoutMs: ctx.globalConfig.browser.timeout_ms,
            maxPosts: apifyConfig?.max_posts_per_group ?? 100,
            signal: ctx.signal,
          });
        } catch (err) {
          ctx.logger.error(
            { source: this.name, group: group.name || group.url, err },
            'Playwright fallback failed for Facebook group',
          );
        }
      }

      if (posts.length > 0) {
        ctx.logger.info(
          { source: this.name, group: group.name || group.url, count: posts.length },
          'Fetched posts from Facebook group',
        );

        for (const post of posts) {
          const discovered = parsePostToDiscovered(post);
          if (!discovered) continue;

          this.postCache.set(discovered.externalId, post);
          yield discovered;
        }
      }

      // Delay between groups
      if (fbConfig.groups.indexOf(group) < fbConfig.groups.length - 1) {
        await ctx.rateLimiter.wait();
      }
    }
  }

  async scrapeDetail(url: string, externalId: string, ctx: AdapterContext): Promise<RawListing> {
    // Read from cache — no additional API call needed
    const cachedPost = this.postCache.get(externalId);

    if (cachedPost) {
      const listing = postToRawListing(cachedPost, externalId, this.name);
      this.postCache.delete(externalId); // Free memory
      return listing;
    }

    // Fallback: create minimal listing from what we know
    ctx.logger.warn(
      { source: this.name, externalId },
      'Post not found in cache, returning minimal listing',
    );

    return {
      externalId,
      source: this.name,
      url,
      title: 'Facebook Post',
      listingType: 'rent',
      price: null,
      currency: 'EUR',
      location: '',
      images: [],
    };
  }

  async dispose(): Promise<void> {
    this.postCache.clear();
  }

  // --- Private helpers ---

  private async fetchGroupPosts(
    client: any,
    groupUrl: string,
    apifyConfig: NonNullable<typeof this.ctx.globalConfig.apify>,
    ctx: AdapterContext,
  ): Promise<FacebookPost[]> {
    const input = {
      ...DEFAULT_ACTOR_INPUT,
      startUrls: [{ url: groupUrl }],
      resultsLimit: apifyConfig.max_posts_per_group,
    };

    // Try the primary actor first, then fallbacks
    const actorIds = [APIFY_ACTOR_ID, ...FALLBACK_ACTOR_IDS];
    let lastError: Error | null = null;

    for (const actorId of actorIds) {
      try {
        ctx.logger.debug(
          { source: this.name, actorId, groupUrl },
          'Running Apify actor',
        );

        const run = await client.actor(actorId).call(input, {
          timeoutSecs: apifyConfig.timeout_seconds,
          waitSecs: apifyConfig.timeout_seconds,
        });

        if (!run?.defaultDatasetId) {
          ctx.logger.warn({ source: this.name, actorId }, 'Actor run returned no dataset');
          continue;
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        return (items || []) as FacebookPost[];
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        ctx.logger.debug(
          { source: this.name, actorId, err: lastError.message },
          'Actor failed, trying next',
        );
      }
    }

    throw lastError || new Error('All Apify actors failed');
  }
}
