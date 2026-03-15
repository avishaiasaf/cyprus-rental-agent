import cron from 'node-cron';
import type { Orchestrator } from '../scraper/orchestrator.js';
import type { Logger } from 'pino';

export function startCron(
  intervalMinutes: number,
  orchestrator: Orchestrator,
  logger: Logger,
): cron.ScheduledTask {
  // Convert interval to cron expression
  // For intervals that divide evenly into 60, use */N
  // Otherwise use a fixed schedule
  let cronExpr: string;
  if (intervalMinutes <= 60 && 60 % intervalMinutes === 0) {
    cronExpr = `*/${intervalMinutes} * * * *`;
  } else if (intervalMinutes <= 1440) {
    // For longer intervals, run at fixed times
    const hours = Math.floor(intervalMinutes / 60);
    const mins = intervalMinutes % 60;
    if (hours > 0) {
      cronExpr = `${mins} */${hours} * * *`;
    } else {
      cronExpr = `*/${mins} * * * *`;
    }
  } else {
    // Daily at midnight
    cronExpr = '0 0 * * *';
  }

  logger.info({ cronExpr, intervalMinutes }, 'Scheduling scrape cron');

  const task = cron.schedule(cronExpr, async () => {
    logger.info('Cron triggered scrape cycle');
    try {
      const result = await orchestrator.runFullCycle();
      logger.info(result, 'Cron scrape cycle completed');
    } catch (err) {
      logger.error(err, 'Cron scrape cycle failed');
    }
  });

  return task;
}
