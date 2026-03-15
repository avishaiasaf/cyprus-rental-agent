import { describe, it, expect } from 'vitest';
import { TelegramQueue } from '../../src/telegram/queue.js';

describe('TelegramQueue', () => {
  it('should execute enqueued actions', async () => {
    const queue = new TelegramQueue(100);
    let executed = false;
    await queue.enqueue(async () => { executed = true; });
    expect(executed).toBe(true);
  });

  it('should execute actions in order', async () => {
    const queue = new TelegramQueue(100);
    const order: number[] = [];
    await Promise.all([
      queue.enqueue(async () => { order.push(1); }),
      queue.enqueue(async () => { order.push(2); }),
      queue.enqueue(async () => { order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('should track pending count', () => {
    const queue = new TelegramQueue(100);
    expect(queue.pending).toBe(0);
  });

  it('should propagate errors', async () => {
    const queue = new TelegramQueue(100);
    await expect(
      queue.enqueue(async () => { throw new Error('test error'); }),
    ).rejects.toThrow('test error');
  });
});
