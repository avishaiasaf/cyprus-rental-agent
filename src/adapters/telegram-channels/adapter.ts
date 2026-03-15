import { BaseAdapter } from '../base-adapter.js';
import type { AdapterContext, DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { DEFAULT_MESSAGE_LIMIT } from './constants.js';
import {
  parseMessageToDiscovered,
  messageToRawListing,
  type TelegramMessage,
} from './parser.js';

/**
 * Telegram Channels adapter.
 *
 * Uses the `telegram` npm package (MTProto client) to read public channel history.
 * Completely separate from the grammY notification bot (different library).
 *
 * Cache pattern: discoverListings() fetches all messages and caches them,
 * then scrapeDetail() reads from the cache (no second API call needed).
 */
export class TelegramChannelsAdapter extends BaseAdapter {
  readonly name = 'telegram-channels';
  readonly requiresBrowser = false;

  // Cache: externalId -> { message, channelUsername, channelName }
  private messageCache = new Map<string, {
    msg: TelegramMessage;
    channelUsername: string;
    channelName: string | undefined;
  }>();

  // MTProto client instance
  private client: any = null;

  async init(ctx: AdapterContext): Promise<void> {
    await super.init(ctx);
    this.messageCache.clear();
  }

  async *discoverListings(ctx: AdapterContext): AsyncGenerator<DiscoveredListing, void, undefined> {
    const tgConfig = ctx.globalConfig.telegram_channels;

    if (!tgConfig?.channels || tgConfig.channels.length === 0) {
      ctx.logger.warn({ source: this.name }, 'No Telegram channels configured, skipping');
      return;
    }

    if (!tgConfig.api_id || !tgConfig.api_hash) {
      ctx.logger.warn(
        { source: this.name },
        'Telegram API credentials (api_id, api_hash) not configured, skipping',
      );
      return;
    }

    // Lazy import telegram package
    let TelegramClient: any;
    let StringSession: any;
    try {
      const mod = await import('telegram');
      TelegramClient = mod.TelegramClient;
      const sessionMod = await import('telegram/sessions/index.js');
      StringSession = sessionMod.StringSession;
    } catch {
      ctx.logger.error(
        { source: this.name },
        'telegram package not installed. Run: npm install telegram',
      );
      return;
    }

    // Create MTProto client using bot token
    try {
      const session = new StringSession('');
      this.client = new TelegramClient(
        session,
        tgConfig.api_id,
        tgConfig.api_hash,
        {
          connectionRetries: 3,
          baseLogger: { // Suppress telegram lib logging
            _log: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            error: (msg: string) => ctx.logger.error({ source: this.name }, `MTProto: ${msg}`),
          },
        },
      );

      // Start as bot using the notification bot token
      await this.client.start({
        botAuthToken: ctx.globalConfig.telegram.bot_token,
      });

      ctx.logger.info({ source: this.name }, 'MTProto client connected');
    } catch (err) {
      ctx.logger.error(
        { source: this.name, err },
        'Failed to connect MTProto client',
      );
      return;
    }

    for (const channel of tgConfig.channels) {
      if (ctx.signal.aborted) return;

      ctx.logger.info(
        { source: this.name, channel: channel.username },
        'Reading Telegram channel history',
      );

      try {
        const messages = await this.fetchChannelMessages(
          channel.username,
          DEFAULT_MESSAGE_LIMIT,
          ctx,
        );

        ctx.logger.info(
          { source: this.name, channel: channel.username, count: messages.length },
          'Fetched messages from Telegram channel',
        );

        for (const msg of messages) {
          const discovered = parseMessageToDiscovered(msg, channel.username);
          if (!discovered) continue;

          // Cache for scrapeDetail()
          this.messageCache.set(discovered.externalId, {
            msg,
            channelUsername: channel.username,
            channelName: channel.name,
          });

          yield discovered;
        }
      } catch (err) {
        ctx.logger.error(
          { source: this.name, channel: channel.username, err },
          'Failed to read Telegram channel',
        );
      }

      // Delay between channels
      if (tgConfig.channels.indexOf(channel) < tgConfig.channels.length - 1) {
        await ctx.rateLimiter.wait();
      }
    }
  }

  async scrapeDetail(url: string, externalId: string, ctx: AdapterContext): Promise<RawListing> {
    // Read from cache
    const cached = this.messageCache.get(externalId);

    if (cached) {
      const listing = messageToRawListing(
        cached.msg,
        cached.channelUsername,
        cached.channelName,
        externalId,
        this.name,
      );
      this.messageCache.delete(externalId); // Free memory
      return listing;
    }

    // Fallback
    ctx.logger.warn(
      { source: this.name, externalId },
      'Message not found in cache, returning minimal listing',
    );

    return {
      externalId,
      source: this.name,
      url,
      title: 'Telegram Post',
      listingType: 'rent',
      price: null,
      currency: 'EUR',
      location: '',
      images: [],
    };
  }

  async dispose(): Promise<void> {
    this.messageCache.clear();
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.client = null;
    }
  }

  // --- Private helpers ---

  private async fetchChannelMessages(
    channelUsername: string,
    limit: number,
    ctx: AdapterContext,
  ): Promise<TelegramMessage[]> {
    if (!this.client) throw new Error('MTProto client not initialized');

    try {
      const entity = await this.client.getEntity(channelUsername);
      const messages: TelegramMessage[] = [];

      for await (const msg of this.client.iterMessages(entity, { limit })) {
        if (msg.message || msg.text) {
          messages.push({
            id: msg.id,
            message: msg.message || msg.text,
            date: msg.date,
            media: msg.media,
            fromId: msg.fromId,
            peerId: msg.peerId,
          });
        }
      }

      return messages;
    } catch (err) {
      ctx.logger.error(
        { source: this.name, channel: channelUsername, err },
        'Failed to fetch channel messages',
      );
      throw err;
    }
  }
}
