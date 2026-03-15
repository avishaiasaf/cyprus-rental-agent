import type { Browser } from 'patchright';
import type { RawListing } from './listing.js';
import type { AppConfig, SourceConfig } from '../config/schema.js';
import type { HttpClient } from '../scraper/http-client.js';
import type { RateLimiter } from '../scraper/rate-limiter.js';
import type { Logger } from 'pino';

export interface AdapterContext {
  browser: Browser | null;
  httpClient: HttpClient;
  rateLimiter: RateLimiter;
  sourceConfig: SourceConfig;
  globalConfig: AppConfig;
  logger: Logger;
  signal: AbortSignal;
}

export interface SourceAdapter {
  readonly name: string;
  readonly requiresBrowser: boolean;

  init(ctx: AdapterContext): Promise<void>;
  discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined>;
  scrapeDetail(url: string, externalId: string, ctx: AdapterContext): Promise<RawListing>;
  dispose(): Promise<void>;
}

export interface DiscoveredListing {
  externalId: string;
  url: string;
  listingType: 'rent' | 'sale';
  partial?: Partial<RawListing>;
}
