import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import type { TelegramConfig } from '../config/schema.js';
import * as db from '../db/queries.js';

export function createBot(config: TelegramConfig): Bot {
  const bot = new Bot(config.bot_token);

  // Auto-retry on rate limit errors
  bot.api.config.use(autoRetry());

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '🏠 <b>Cyprus Property Listing Agent</b>\n\n' +
      'I monitor Cyprus property websites and send you new listings.\n\n' +
      'Commands:\n' +
      '/status - Show scraper stats\n' +
      '/latest - Show last 5 listings\n' +
      '/search &lt;query&gt; - Search listings',
      { parse_mode: 'HTML' },
    );
  });

  // /status command
  bot.command('status', async (ctx) => {
    const stats = await db.getStats();
    const lines = [
      '<b>📊 Scraper Status</b>',
      '',
      `Total listings: ${stats.total}`,
      `Active listings: ${stats.active}`,
      '',
      '<b>By Source:</b>',
      ...Object.entries(stats.bySource).map(([s, c]) => `  • ${s}: ${c}`),
    ];
    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // /latest command
  bot.command('latest', async (ctx) => {
    const { listings } = await db.getListings({ limit: 5 });
    if (listings.length === 0) {
      await ctx.reply('No listings found yet.');
      return;
    }

    const lines = listings.map(l => {
      const badge = l.listing_type === 'rent' ? '🏠' : '💰';
      const price = l.price != null
        ? `€${l.price.toLocaleString('en-US')}${l.listing_type === 'rent' ? '/mo' : ''}`
        : 'Price on request';
      return `${badge} <a href="${l.url}">${escapeHtml(l.title)}</a>\n   ${price} · ${l.location ?? 'N/A'}`;
    });

    await ctx.reply(lines.join('\n\n'), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  // Handle inline button callbacks
  bot.callbackQuery(/^react:(\d+):(interested|not_interested)$/, async (ctx) => {
    const match = ctx.callbackQuery.data.match(/^react:(\d+):(interested|not_interested)$/);
    if (!match) return;

    const listingId = parseInt(match[1], 10);
    const reaction = match[2] as 'interested' | 'not_interested';
    const userId = ctx.from.id.toString();

    await db.saveReaction(listingId, userId, reaction);

    const emoji = reaction === 'interested' ? '👍' : '👎';
    await ctx.answerCallbackQuery({
      text: `${emoji} Marked as ${reaction.replace('_', ' ')}`,
    });
  });

  return bot;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
