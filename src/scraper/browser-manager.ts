import { chromium, type Browser, type BrowserContext } from 'playwright';
import { getRandomUserAgent } from '../utils/user-agents.js';
import type { BrowserConfig, ProxyConfig } from '../config/schema.js';

export class BrowserManager {
  private browser: Browser | null = null;

  constructor(
    private config: BrowserConfig,
    private proxyConfig?: ProxyConfig,
  ) {}

  async launch(): Promise<void> {
    if (this.browser) return;

    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    };

    // Set proxy if configured
    if (this.proxyConfig?.enabled && this.proxyConfig.urls.length > 0) {
      const proxyUrl = this.getProxy();
      launchOptions.proxy = { server: proxyUrl };
    }

    this.browser = await chromium.launch(launchOptions);
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  async newStealthContext(): Promise<BrowserContext> {
    if (!this.browser) throw new Error('Browser not launched');

    const context = await this.browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'Europe/Nicosia',
      javaScriptEnabled: true,
    });

    // Stealth: override navigator.webdriver
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Override chrome.runtime to pass automation detection
      Object.defineProperty(globalThis, 'chrome', { value: { runtime: {} }, writable: true });
    });

    return context;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private proxyIndex = 0;

  private getProxy(): string {
    const urls = this.proxyConfig!.urls;
    if (this.proxyConfig!.rotate_strategy === 'random') {
      return urls[Math.floor(Math.random() * urls.length)];
    }
    const url = urls[this.proxyIndex % urls.length];
    this.proxyIndex++;
    return url;
  }
}
