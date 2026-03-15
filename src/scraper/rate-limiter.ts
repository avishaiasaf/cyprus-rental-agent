import { sleep } from '../utils/sleep.js';

export class RateLimiter {
  private lastRequest = 0;

  constructor(private minDelayMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minDelayMs) {
      const jitter = Math.random() * 500;
      await sleep(this.minDelayMs - elapsed + jitter);
    }
    this.lastRequest = Date.now();
  }
}
