import { createHmac } from 'node:crypto';
import type { Logger } from 'pino';
import type { StoredListing } from '../types/listing.js';
import type { PriceChange } from '../types/listing.js';
import type { WebhookPayload, WebhookFilters } from './types.js';
import { matchesWebhookFilters } from './matcher.js';
import * as db from '../db/queries.js';

const MAX_RETRIES = 3;
const MAX_FAILURES_BEFORE_DISABLE = 10;

export class WebhookDispatcher {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'webhook-dispatcher' });
  }

  /**
   * Dispatch a new listing to all matching webhook subscribers.
   */
  async dispatchNewListing(listing: StoredListing, priceChange?: PriceChange | null): Promise<void> {
    const webhooks = await db.getActiveWebhooks();
    if (webhooks.length === 0) return;

    const event = priceChange ? 'listing.price_changed' : 'listing.new';

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      listing,
      ...(priceChange ? {
        price_change: {
          old_price: priceChange.oldPrice,
          new_price: priceChange.newPrice,
        },
      } : {}),
    };

    for (const webhook of webhooks) {
      const filters = (webhook.filters ?? {}) as WebhookFilters;

      // Skip if filters don't match (empty filters = match all)
      if (Object.keys(filters).length > 0 && !matchesWebhookFilters(listing, filters)) {
        continue;
      }

      // Fire and don't await (don't block the scrape loop)
      this.sendWithRetry(webhook.id, webhook.url, webhook.signing_secret, payload).catch(() => {
        // Error already logged in sendWithRetry
      });
    }
  }

  private async sendWithRetry(
    webhookId: string,
    url: string,
    signingSecret: string | null,
    payload: WebhookPayload,
  ): Promise<void> {
    const body = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CyprusRentalAgent-Webhook/1.0',
    };

    if (signingSecret) {
      const signature = createHmac('sha256', signingSecret)
        .update(body)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) {
          await db.resetWebhookFailure(webhookId);
          this.logger.debug({ webhookId, url, status: response.status }, 'Webhook delivered');
          return;
        }

        this.logger.warn(
          { webhookId, url, status: response.status, attempt },
          'Webhook delivery failed with HTTP error',
        );
      } catch (err) {
        this.logger.warn(
          { webhookId, url, err, attempt },
          'Webhook delivery failed with network error',
        );
      }

      // Exponential backoff before retry
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    // All retries exhausted
    await db.incrementWebhookFailure(webhookId);

    // Check if we should disable
    const webhooks = await db.getActiveWebhooks();
    const webhook = webhooks.find(w => w.id === webhookId);
    if (webhook && webhook.failure_count >= MAX_FAILURES_BEFORE_DISABLE) {
      await db.disableWebhook(webhookId);
      this.logger.error(
        { webhookId, url, failureCount: webhook.failure_count },
        'Webhook auto-disabled after too many failures',
      );
    }
  }
}
