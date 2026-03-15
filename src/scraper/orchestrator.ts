import type { SourceAdapter, AdapterContext } from '../types/adapter.js';
import type { AppConfig } from '../config/schema.js';
import { BrowserManager } from './browser-manager.js';
import { HttpClient } from './http-client.js';
import { RateLimiter } from './rate-limiter.js';
import { createAdapter } from '../adapters/index.js';
import * as db from '../db/queries.js';
import { ImageDownloader } from '../images/downloader.js';
import type { TelegramNotifier } from '../telegram/notifier.js';
import { WebhookDispatcher } from '../webhooks/dispatcher.js';
import type { Logger } from 'pino';

export interface CycleResult {
  startedAt: Date;
  completedAt?: Date;
  sources: Record<string, SourceResult>;
}

export interface SourceResult {
  success: boolean;
  error?: string;
  newListings: number;
  updatedListings: number;
  priceChanges: number;
  skippedDuplicates: number;
}

export class Orchestrator {
  private browserManager: BrowserManager;
  private httpClient: HttpClient;
  private imageDownloader: ImageDownloader;
  private notifier: TelegramNotifier;
  private webhookDispatcher: WebhookDispatcher;
  private logger: Logger;
  private abortController: AbortController;
  private running = false;

  constructor(
    private config: AppConfig,
    notifier: TelegramNotifier,
    logger: Logger,
  ) {
    this.browserManager = new BrowserManager(config.browser, config.proxies);
    this.httpClient = new HttpClient(config.proxies, config.browser.timeout_ms);
    this.imageDownloader = new ImageDownloader(
      './data/images',
      this.httpClient,
      config.telegram.max_images_per_listing,
    );
    this.notifier = notifier;
    this.webhookDispatcher = new WebhookDispatcher(logger);
    this.logger = logger;
    this.abortController = new AbortController();
  }

  isRunning(): boolean {
    return this.running;
  }

  async runFullCycle(): Promise<CycleResult> {
    if (this.running) {
      this.logger.warn('Scrape cycle already running, skipping');
      return { startedAt: new Date(), sources: {} };
    }

    this.running = true;
    this.abortController = new AbortController();
    const result: CycleResult = { startedAt: new Date(), sources: {} };
    const runId = await db.startScrapeRun();
    let totalNew = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    const enabledSources = this.config.sources.filter(s => s.enabled);

    // Check if any adapter needs a browser
    const adapters = enabledSources.map(s => ({
      config: s,
      adapter: createAdapter(s.name),
    }));
    const needsBrowser = adapters.some(a => a.adapter.requiresBrowser);

    if (needsBrowser) {
      try {
        await this.browserManager.launch();
        this.logger.info('Browser launched');
      } catch (err) {
        this.logger.error(err, 'Failed to launch browser');
      }
    }

    try {
      for (const { config: sourceConfig, adapter } of adapters) {
        if (this.abortController.signal.aborted) break;

        try {
          const sourceResult = await this.runSource(adapter, sourceConfig);
          result.sources[sourceConfig.name] = sourceResult;
          totalNew += sourceResult.newListings;
          totalUpdated += sourceResult.updatedListings;
        } catch (err) {
          this.logger.error({ source: sourceConfig.name, err }, 'Source failed');
          totalErrors++;
          result.sources[sourceConfig.name] = {
            success: false,
            error: (err as Error).message,
            newListings: 0,
            updatedListings: 0,
            priceChanges: 0,
            skippedDuplicates: 0,
          };
        }
      }

      // Mark stale listings
      for (const source of enabledSources) {
        const staleCount = await db.markStaleListingsInactive(source.name, 48);
        if (staleCount > 0) {
          this.logger.info({ source: source.name, staleCount }, 'Marked listings as inactive');
        }
      }
    } finally {
      await this.browserManager.close();
    }

    result.completedAt = new Date();
    await db.completeScrapeRun(runId, {
      newListings: totalNew,
      updatedListings: totalUpdated,
      errors: totalErrors,
    });

    this.running = false;
    this.logger.info(
      { totalNew, totalUpdated, totalErrors, durationMs: result.completedAt.getTime() - result.startedAt.getTime() },
      'Scrape cycle completed',
    );

    return result;
  }

  private async runSource(
    adapter: SourceAdapter,
    sourceConfig: AppConfig['sources'][number],
  ): Promise<SourceResult> {
    const rateLimiter = new RateLimiter(sourceConfig.delay_between_requests_ms);
    const ctx: AdapterContext = {
      browser: this.browserManager.getBrowser(),
      httpClient: this.httpClient,
      rateLimiter,
      sourceConfig,
      globalConfig: this.config,
      logger: this.logger,
      signal: this.abortController.signal,
    };

    this.logger.info({ source: adapter.name }, 'Starting source scrape');
    await adapter.init(ctx);

    let newCount = 0;
    let updatedCount = 0;
    let priceChanges = 0;
    let skippedDuplicates = 0;

    try {
      // Discover listings from index pages
      const discovered = [];
      for await (const listing of adapter.discoverListings(ctx)) {
        discovered.push(listing);
        if (this.abortController.signal.aborted) break;
      }

      this.logger.info({ source: adapter.name, count: discovered.length }, 'Discovered listings');

      // Filter to new listings + existing listings missing details
      const newListings = [];
      const rescrapeListings = [];
      for (const d of discovered) {
        if (!(await db.listingExists(adapter.name, d.externalId))) {
          newListings.push(d);
        } else if (await db.listingNeedsRescrape(adapter.name, d.externalId)) {
          rescrapeListings.push(d);
        }
      }
      this.logger.info(
        { source: adapter.name, newCount: newListings.length, rescrapeCount: rescrapeListings.length },
        'Listings to scrape',
      );

      // Scrape detail pages
      for (const disc of newListings) {
        if (this.abortController.signal.aborted) break;

        try {
          const listing = await adapter.scrapeDetail(disc.url, disc.externalId, ctx);

          // Check cross-source duplicates
          const duplicate = await db.findDuplicate(listing);
          if (duplicate) {
            this.logger.debug(
              { source: adapter.name, externalId: disc.externalId, duplicateOf: duplicate.id },
              'Skipping cross-source duplicate',
            );
            skippedDuplicates++;
            // Still store it but don't notify
            await db.upsertListing(listing);
            continue;
          }

          // Download images
          if (this.config.telegram.send_images && listing.images.length > 0) {
            await this.imageDownloader.downloadAll(listing);
          }

          // Upsert and check for price changes
          const { id, priceChanged } = await db.upsertListing(listing);

          // Fetch the stored listing for webhook/notification payloads
          const storedListing = await db.getListingById(id);

          if (priceChanged) {
            priceChanges++;
            this.logger.info(
              { source: adapter.name, id, oldPrice: priceChanged.oldPrice, newPrice: priceChanged.newPrice },
              'Price change detected',
            );
            await this.notifier.notifyPriceChange(listing, priceChanged);
            await db.markNotified(id);
            if (storedListing) {
              this.webhookDispatcher.dispatchNewListing(storedListing, priceChanged);
            }
          } else {
            // Notify new listing
            await this.notifier.notifyNewListing(listing, id);
            await db.markNotified(id);
            newCount++;
            if (storedListing) {
              this.webhookDispatcher.dispatchNewListing(storedListing);
            }
          }
        } catch (err) {
          this.logger.error({ source: adapter.name, url: disc.url, err }, 'Failed to scrape detail');
        }
      }

      // Re-scrape existing listings that are missing details (price, description)
      for (const disc of rescrapeListings) {
        if (this.abortController.signal.aborted) break;

        try {
          const listing = await adapter.scrapeDetail(disc.url, disc.externalId, ctx);
          await db.upsertListing(listing);
          updatedCount++;
          this.logger.info({ source: adapter.name, externalId: disc.externalId }, 'Re-scraped listing with missing details');
        } catch (err) {
          this.logger.error({ source: adapter.name, url: disc.url, err }, 'Failed to re-scrape detail');
        }
      }

      // Touch all discovered listings (update last_seen_at)
      for (const d of discovered) {
        await db.touchListing(adapter.name, d.externalId);
      }
      updatedCount += discovered.length - newListings.length - rescrapeListings.length;

      return {
        success: true,
        newListings: newCount,
        updatedListings: updatedCount,
        priceChanges,
        skippedDuplicates,
      };
    } finally {
      await adapter.dispose();
    }
  }

  stop(): void {
    this.abortController.abort();
    this.running = false;
  }
}
