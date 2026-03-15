import { Bot, InputFile, InlineKeyboard } from 'grammy';
import type { InputMediaPhoto } from 'grammy/types';
import type { RawListing, PriceChange } from '../types/listing.js';
import type { TelegramConfig } from '../config/schema.js';
import { TelegramQueue } from './queue.js';
import { buildListingMessage, buildPriceChangeMessage } from './message-builder.js';
import fs from 'node:fs';

export class TelegramNotifier {
  private queue: TelegramQueue;

  constructor(
    private bot: Bot,
    private config: TelegramConfig,
  ) {
    this.queue = new TelegramQueue(config.max_messages_per_minute);
  }

  async notifyNewListing(listing: RawListing, dbId: number): Promise<void> {
    const message = buildListingMessage(listing);
    const keyboard = new InlineKeyboard()
      .text('👍 Interested', `react:${dbId}:interested`)
      .text('👎 Not Interested', `react:${dbId}:not_interested`);

    await this.queue.enqueue(async () => {
      if (this.config.send_images && listing.images.length > 0) {
        await this.sendWithImages(listing, message, keyboard);
      } else {
        await this.bot.api.sendMessage(this.config.channel_id, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });
      }
    });
  }

  async notifyPriceChange(listing: RawListing, change: PriceChange): Promise<void> {
    const message = buildPriceChangeMessage(listing, change);

    await this.queue.enqueue(async () => {
      await this.bot.api.sendMessage(this.config.channel_id, message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    });
  }

  private async sendWithImages(
    listing: RawListing,
    caption: string,
    keyboard: InlineKeyboard,
  ): Promise<void> {
    const images = listing.images.slice(0, this.config.max_images_per_listing);

    if (images.length === 1) {
      const source = this.getImageSource(images[0]);
      await this.bot.api.sendPhoto(this.config.channel_id, source, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      // Media group doesn't support inline keyboards
      // Send media group first, then a text message with the keyboard
      const mediaGroup: InputMediaPhoto[] = images.map((img, i) => ({
        type: 'photo' as const,
        media: this.getImageSource(img),
        ...(i === 0 ? { caption, parse_mode: 'HTML' as const } : {}),
      }));

      await this.bot.api.sendMediaGroup(this.config.channel_id, mediaGroup);

      // Send keyboard as a separate message
      await this.bot.api.sendMessage(
        this.config.channel_id,
        '👆 React to this listing:',
        { reply_markup: keyboard },
      );
    }
  }

  private getImageSource(img: { localPath?: string; url: string }): string | InputFile {
    if (img.localPath && fs.existsSync(img.localPath)) {
      return new InputFile(img.localPath);
    }
    return img.url;
  }

  async sendStatusMessage(text: string): Promise<void> {
    await this.queue.enqueue(async () => {
      await this.bot.api.sendMessage(this.config.channel_id, text, {
        parse_mode: 'HTML',
      });
    });
  }
}
