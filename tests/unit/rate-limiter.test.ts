import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../src/scraper/rate-limiter.js';

describe('RateLimiter', () => {
  it('should not delay the first request', async () => {
    const limiter = new RateLimiter(1000);
    const start = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('should delay subsequent requests', async () => {
    const limiter = new RateLimiter(200);
    await limiter.wait();
    const start = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - start;
    // Should wait at least 200ms (delay) but could be up to +500ms (jitter)
    expect(elapsed).toBeGreaterThanOrEqual(150); // allow small timing variance
  });

  it('should not delay if enough time has passed', async () => {
    const limiter = new RateLimiter(50);
    await limiter.wait();
    await new Promise(r => setTimeout(r, 100)); // wait longer than delay
    const start = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
