/**
 * Standalone crawler entry point for GitHub Actions.
 * Runs a single full scrape cycle then exits.
 * No Express server, no cron — just crawl and done.
 */
import { loadConfig } from './config/loader.js';
import { initDb, closeDb } from './db/client.js';
import * as db from './db/queries.js';
import { createLogger } from './utils/logger.js';
import { Orchestrator } from './scraper/orchestrator.js';
import { TelegramNotifier } from './telegram/notifier.js';
import { createBot } from './telegram/bot.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<void> {
  const logger = createLogger();
  logger.info('Starting crawler (one-shot mode)...');

  const config = loadConfig();
  logger.info({ sources: config.sources.filter(s => s.enabled).map(s => s.name) }, 'Config loaded');

  // Initialize database
  await initDb(config.database.connection_string);
  logger.info('Database initialized');

  // Clean up stale runs from previous crashes
  const staleCleanup = await db.cleanupStaleRuns();
  if (staleCleanup > 0) {
    logger.info({ count: staleCleanup }, 'Cleaned up stale scrape runs');
  }

  // Create Telegram bot and notifier
  const bot = createBot(config.telegram);
  const notifier = new TelegramNotifier(bot, config.telegram);

  // Create orchestrator
  const orchestrator = new Orchestrator(config, notifier, logger);

  // Start Telegram bot (needed for notifications during scrape)
  bot.start({
    onStart: () => logger.info('Telegram bot started'),
  });

  // Run single full cycle
  try {
    const result = await orchestrator.runFullCycle();
    logger.info(result, 'Scrape cycle completed');
  } catch (err) {
    logger.error(err, 'Scrape cycle failed');
    process.exitCode = 1;
  }

  // Clean shutdown
  await bot.stop();
  await closeDb();
  logger.info('Crawler finished, exiting.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
