import type { Browser } from 'playwright';
import type { FacebookPost } from './parser.js';
import type { Logger } from 'pino';
import { readFile } from 'node:fs/promises';

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface PlaywrightScraperOptions {
  browser: Browser;
  cookieFile: string;
  logger: Logger;
  timeoutMs?: number;
  maxPosts?: number;
  signal?: AbortSignal;
}

/**
 * Scrape Facebook group posts using Playwright with stored cookies.
 *
 * Requires the user to manually export cookies from a logged-in Facebook
 * session (e.g. via a browser extension) and save them as a JSON file.
 */
export async function scrapeGroupWithPlaywright(
  groupUrl: string,
  opts: PlaywrightScraperOptions,
): Promise<FacebookPost[]> {
  const { browser, cookieFile, logger, signal } = opts;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxPosts = opts.maxPosts ?? 100;

  // Load cookies
  let cookies: Cookie[];
  try {
    const raw = await readFile(cookieFile, 'utf-8');
    cookies = JSON.parse(raw);
  } catch (err) {
    logger.error({ err, cookieFile }, 'Failed to read Facebook cookie file');
    throw new Error(`Cannot read cookie file: ${cookieFile}`);
  }

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'Europe/Nicosia',
  });

  // Stealth tweaks
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(globalThis, 'chrome', {
      value: { runtime: {} },
      writable: true,
    });
  });

  // Set cookies
  const fbCookies = cookies
    .filter((c) => c.domain.includes('facebook.com'))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expires,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? true,
      sameSite: (c.sameSite || 'None') as 'Strict' | 'Lax' | 'None',
    }));

  await context.addCookies(fbCookies);

  const page = await context.newPage();

  try {
    // Block heavy resources
    await page.route('**/*.{woff,woff2,ttf,eot}', (route) => route.abort());

    // Navigate to group with sorting by new
    const sortedUrl = groupUrl.replace(/\/?$/, '/') + '?sorting_setting=CHRONOLOGICAL';
    logger.info({ url: sortedUrl }, 'Navigating to Facebook group');

    await page.goto(sortedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Wait for feed to render
    await page.waitForSelector('[role="article"], [role="feed"]', {
      timeout: timeoutMs,
    });

    // Scroll to load more posts
    const posts: FacebookPost[] = [];
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(maxPosts / 5); // ~5 posts per scroll

    while (posts.length < maxPosts && scrollAttempts < maxScrolls) {
      if (signal?.aborted) break;

      // Extract posts currently visible (runs in browser context)
      const newPosts: Array<{
        text: string;
        postUrl: string;
        images: string[];
        authorName: string;
        timestamp: string;
      }> = await page.evaluate(`(() => {
        const articles = document.querySelectorAll('[role="article"]');
        const results = [];

        for (const article of articles) {
          if (article.getAttribute('data-scraped')) continue;
          article.setAttribute('data-scraped', '1');

          const textEl =
            article.querySelector('[data-ad-preview="message"]') ||
            article.querySelector('[data-ad-comet-above-more-section]') ||
            article.querySelector('.x1iorvi4');
          const text = textEl?.textContent?.trim() || '';
          if (!text || text.length < 15) continue;

          const links = article.querySelectorAll('a[href*="/groups/"]');
          let postUrl = '';
          for (const link of links) {
            const href = link.href;
            if (href.includes('/posts/') || href.includes('/permalink/')) {
              postUrl = href.split('?')[0];
              break;
            }
          }

          const images = [];
          const imgs = article.querySelectorAll('img[src*="scontent"]');
          for (const img of imgs) {
            const src = img.src;
            if (src && !src.includes('emoji') && !src.includes('profile')) {
              images.push(src);
            }
          }

          const authorEl = article.querySelector('h3 a, h4 a, strong a');
          const authorName = authorEl?.textContent?.trim() || '';

          const timeEl = article.querySelector('abbr, [data-utime], time');
          const timestamp =
            timeEl?.getAttribute('data-utime') ||
            timeEl?.getAttribute('datetime') ||
            timeEl?.getAttribute('title') ||
            '';

          results.push({ text, postUrl, images, authorName, timestamp });
        }

        return results;
      })()`);

      for (const raw of newPosts) {
        if (posts.length >= maxPosts) break;

        posts.push({
          text: raw.text,
          postUrl: raw.postUrl,
          images: raw.images,
          authorName: raw.authorName,
          timestamp: raw.timestamp,
        });
      }

      if (newPosts.length === 0) {
        scrollAttempts++;
      }

      // Scroll down
      await page.evaluate('window.scrollBy(0, window.innerHeight * 2)');
      await page.waitForTimeout(1500 + Math.random() * 1000);
      scrollAttempts++;
    }

    logger.info({ count: posts.length }, 'Extracted posts from Facebook group via Playwright');
    return posts;
  } finally {
    await page.close();
    await context.close();
  }
}
