import { createNlu } from './ai';
import { BookingBot } from './bot';
import { loadConfig } from './config';
import { createApp } from './http/app';
import { logger } from './logger';
import { createMemoryRepositories } from './repositories/memory';
import { createMongoRepositories } from './repositories/mongo';
import { DryRunSender, WhatsAppClient } from './whatsapp/client';

async function main(): Promise<void> {
  const config = loadConfig();

  const repos = config.mongoUri
    ? await createMongoRepositories(config.mongoUri)
    : createMemoryRepositories();
  logger.info(
    config.mongoUri ? 'Using MongoDB storage' : 'Using in-memory storage (data is lost on restart)',
  );

  const sender = config.whatsapp.token
    ? new WhatsAppClient({
        token: config.whatsapp.token,
        phoneNumberId: config.whatsapp.phoneNumberId,
        graphVersion: config.whatsapp.graphVersion,
      })
    : new DryRunSender();

  const bot = new BookingBot({ repos, nlu: createNlu(config), hours: config.business });
  // The dev chat endpoint is only exposed when WhatsApp is not connected.
  const app = createApp({ config, bot, sender, enableDevChat: !config.whatsapp.token });

  const server = app.listen(config.port, () => logger.info(`Listening on :${config.port}`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void repos.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message });
  process.exit(1);
});
