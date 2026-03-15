import { loadConfig } from './config/loader.js';
import { initDb, closeDb } from './db/client.js';
import { createLogger } from './utils/logger.js';
import { Orchestrator } from './scraper/orchestrator.js';
import { TelegramNotifier } from './telegram/notifier.js';
import { createBot } from './telegram/bot.js';
import { startCron } from './scheduler/cron.js';
import { startHealthServer } from './health/server.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<void> {
  const logger = createLogger();
  logger.info('Starting Cyprus Rental Agent...');

  // Load configuration
  const config = loadConfig();
  logger.info({ sources: config.sources.filter(s => s.enabled).map(s => s.name) }, 'Config loaded');

  // Initialize database
  await initDb(config.database.connection_string);
  logger.info('Database initialized');

  // Create Telegram bot and notifier
  const bot = createBot(config.telegram);
  const notifier = new TelegramNotifier(bot, config.telegram);

  // Create orchestrator
  const orchestrator = new Orchestrator(config, notifier, logger);

  // Start Telegram bot (non-blocking)
  bot.start({
    onStart: () => logger.info('Telegram bot started'),
  });

  // Start health check server
  if (config.health_check.enabled) {
    startHealthServer(config.health_check.port, config);
    logger.info({ port: config.health_check.port }, 'Health check server started');
  }

  // Run initial scrape
  logger.info('Running initial scrape cycle...');
  try {
    const result = await orchestrator.runFullCycle();
    logger.info(result, 'Initial scrape cycle completed');
  } catch (err) {
    logger.error(err, 'Initial scrape cycle failed');
  }

  // Start scheduled scraping
  startCron(config.scrape_interval_minutes, orchestrator, logger);
  logger.info({ intervalMinutes: config.scrape_interval_minutes }, 'Cron scheduler started');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    orchestrator.stop();
    await bot.stop();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
