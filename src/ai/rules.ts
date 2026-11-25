import { DateTime } from 'luxon';
import type { Intent, Nlu } from '../domain/types';
import type { NluContext, NluProvider } from './types';

const SERVICE_WORDS: Record<string, RegExp> = {
  consultation: /consult/i,
  haircut: /hair\s?cut|trim/i,
  'full-session': /full|session/i,
};

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function parseDate(text: string, ctx: NluContext): string | undefined {
  const today = DateTime.fromISO(ctx.today, { zone: ctx.timezone });
  if (/\btoday\b/i.test(text)) return today.toISODate() ?? undefined;
  if (/\btomorrow\b/i.test(text)) return today.plus({ days: 1 }).toISODate() ?? undefined;
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return iso[1];
  const idx = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`, 'i').test(text));
  if (idx >= 0) {
    const ahead = (idx + 1 - today.weekday + 7) % 7 || 7;
    return today.plus({ days: ahead }).toISODate() ?? undefined;
  }
  return undefined;
}

function parseTime(text: string): string | undefined {
  const m =
    text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ??
    text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m?.[1]) return undefined;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Deterministic NLU used when OPENAI_API_KEY is not set (demo mode) and as a fallback if the
 * API call fails. Understands the flow's own prompts plus simple natural phrases.
 */
export class RuleBasedNlu implements NluProvider {
  readonly name = 'rules';

  async interpret(text: string, ctx: NluContext): Promise<Nlu> {
    const t = text.trim();
    const nlu: Nlu = { intent: 'unknown' };

    const bare = t.match(/^\s*(\d{1,2})\s*[.)]?\s*$/);
    if (bare?.[1]) nlu.optionNumber = Number(bare[1]);

    const hasCancelWord = /\bcancel\b|\bdelete\b/i.test(t);
    const code = t.match(/\b(?:cancel|delete)\s+#?([A-Z0-9]{6})\b/i);
    if (code?.[1]) nlu.bookingCode = code[1].toUpperCase();

    for (const [id, re] of Object.entries(SERVICE_WORDS)) {
      if (re.test(t) && ctx.services.some((s) => s.id === id)) nlu.serviceId = id;
    }
    const date = parseDate(t, ctx);
    if (date) nlu.date = date;
    const time = parseTime(t);
    if (time) nlu.time = time;

    let intent: Intent = 'unknown';
    if (/^(stop|restart|reset|menu|start over)\b/i.test(t)) intent = 'restart';
    else if (hasCancelWord) intent = 'cancel';
    else if (/\b(my bookings?|my appointments?|upcoming|list)\b/i.test(t)) intent = 'list';
    else if (/^(y|yes|yeah|yep|ok|okay|confirm|sure|نعم|اه|تمام)\b/i.test(t)) intent = 'yes';
    else if (/^(n|no|nope|change)\b/i.test(t)) intent = 'no';
    else if (/\b(book|appointment|reserve|schedule)\b/i.test(t) || nlu.serviceId) intent = 'book';
    else if (/^(hi|hello|hey|good (morning|evening)|salam|السلام|مرحبا|اهلا)/i.test(t))
      intent = 'greet';
    else if (/\b(help|\?)/i.test(t)) intent = 'help';
    nlu.intent = intent;
    return nlu;
  }
}
