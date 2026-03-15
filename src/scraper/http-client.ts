import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici';
import { getRandomUserAgent } from '../utils/user-agents.js';
import { retry } from '../utils/retry.js';
import type { ProxyConfig } from '../config/schema.js';

export class HttpClient {
  private proxyIndex = 0;

  constructor(
    private proxyConfig?: ProxyConfig,
    private defaultTimeout: number = 30000,
  ) {}

  async get(url: string, headers?: Record<string, string>): Promise<string> {
    return retry(
      async () => {
        const dispatcher = this.getDispatcher();
        const response = await undiciFetch(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            ...headers,
          },
          signal: AbortSignal.timeout(this.defaultTimeout),
          dispatcher,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
        }

        return response.text();
      },
      {
        maxRetries: 2,
        baseDelayMs: 2000,
      },
    );
  }

  async getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const text = await this.get(url, {
      'Accept': 'application/json',
      ...headers,
    });
    return JSON.parse(text) as T;
  }

  async downloadBuffer(url: string): Promise<Buffer> {
    return retry(
      async () => {
        const dispatcher = this.getDispatcher();
        const response = await undiciFetch(url, {
          headers: { 'User-Agent': getRandomUserAgent() },
          signal: AbortSignal.timeout(this.defaultTimeout),
          dispatcher,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} downloading ${url}`);
        }

        return Buffer.from(await response.arrayBuffer());
      },
      { maxRetries: 2, baseDelayMs: 1000 },
    );
  }

  private getDispatcher(): Dispatcher | undefined {
    if (!this.proxyConfig?.enabled || this.proxyConfig.urls.length === 0) {
      return undefined;
    }

    const proxyUrl = this.getNextProxy();
    return new ProxyAgent(proxyUrl);
  }

  private getNextProxy(): string {
    const urls = this.proxyConfig!.urls;
    if (this.proxyConfig!.rotate_strategy === 'random') {
      return urls[Math.floor(Math.random() * urls.length)];
    }
    // round-robin
    const url = urls[this.proxyIndex % urls.length];
    this.proxyIndex++;
    return url;
  }
}
