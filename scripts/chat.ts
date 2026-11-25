/**
 * Terminal chat with the bot. No WhatsApp, no database, no API key needed.
 *   npm run chat
 */
import readline from 'node:readline/promises';
import { createNlu } from '../src/ai';
import { BookingBot } from '../src/bot';
import { loadConfig } from '../src/config';
import { createMemoryRepositories } from '../src/repositories/memory';

async function main() {
  const config = loadConfig();
  const bot = new BookingBot({
    repos: createMemoryRepositories(),
    nlu: createNlu(config),
    hours: config.business,
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('WhatsApp Booking Bot, terminal demo. Type a message, Ctrl+C to quit.\n');
  for (;;) {
    const text = (await rl.question('you > ')).trim();
    if (!text) continue;
    console.log(
      `\nbot > ${(await bot.handleMessage('demo-user', text)).replace(/\n/g, '\n      ')}\n`,
    );
  }
}

void main();
