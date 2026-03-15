interface QueueItem {
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class TelegramQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private sentTimestamps: number[] = [];

  constructor(private maxPerMinute: number = 20) {}

  enqueue(action: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute: action, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.sentTimestamps = this.sentTimestamps.filter(t => now - t < 60_000);

      if (this.sentTimestamps.length >= this.maxPerMinute) {
        const waitMs = 60_000 - (now - this.sentTimestamps[0]) + 100;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      const item = this.queue.shift()!;
      try {
        await item.execute();
        this.sentTimestamps.push(Date.now());
        item.resolve();
      } catch (err) {
        item.reject(err as Error);
      }

      // Small delay between sends
      await new Promise(r => setTimeout(r, 200));
    }

    this.processing = false;
  }

  get pending(): number {
    return this.queue.length;
  }
}
