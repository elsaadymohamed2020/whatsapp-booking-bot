/**
 * Browser build of the bot for the static demo (GitHub Pages): the same booking engine and
 * rule-based NLU, with in-memory storage, running inside the visitor's tab. No server needed.
 */
import { RuleBasedNlu } from '../ai/rules';
import { BookingBot } from '../bot';
import { createMemoryRepositories } from '../repositories/memory';

const bot = new BookingBot({
  repos: createMemoryRepositories(),
  nlu: new RuleBasedNlu(),
  hours: {
    timezone: 'Africa/Cairo',
    days: [1, 2, 3, 4, 5, 6, 7],
    open: '10:00',
    close: '20:00',
    minLeadMinutes: 60,
    horizonDays: 14,
    slotStepMinutes: 30,
  },
});

(window as unknown as { ELSA_LOCAL: (from: string, text: string) => Promise<string> }).ELSA_LOCAL = (
  from,
  text,
) => bot.handleMessage(from, text.slice(0, 300));
