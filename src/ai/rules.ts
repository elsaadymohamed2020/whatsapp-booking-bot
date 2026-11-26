import { DateTime } from 'luxon';
import type { Intent, Nlu } from '../domain/types';
import type { NluContext, NluProvider } from './types';

const SERVICE_WORDS: Record<string, RegExp> = {
  consultation: /consult|استشار/i,
  haircut: /hair\s?cut|trim|قص(?![\u0600-\u06FF])|قصه|قصة|حلاق|تقصير/i,
  blowdry: /blow\s?-?dry|سيشوار|برش|بلو\s?دراي/i,
  color: /colou?r|dye|صبغ|لون/i,
  keratin: /keratin|كيراتين|بروتين/i,
  manicure: /mani|nails?|مانيكير|اضافر|ضوافر|أظافر/i,
};

const AR = /[\u0600-\u06FF]/;
const NOT_AR = '(?![\\u0600-\\u06FF])';

/** Arabic-Indic digits to Western, diacritics removed, common letter variants merged. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

const AR_WEEKDAYS = [
  /الاثنين|الاتنين/,
  /الثلاثاء|التلات|الثلاثا/,
  /الاربعاء|الاربعا/,
  /الخميس/,
  /الجمعه/,
  /السبت/,
  /الاحد|الحد/,
];

function parseArabicDate(t: string, ctx: NluContext): string | undefined {
  const today = DateTime.fromISO(ctx.today, { zone: ctx.timezone });
  if (/بعد\s?بكر[هاة]|بعد\s?غد/.test(t)) return today.plus({ days: 2 }).toISODate() ?? undefined;
  if (/بكر[هاة]|غدا|غد(?![\u0600-\u06FF])/.test(t)) return today.plus({ days: 1 }).toISODate() ?? undefined;
  if (/النهارد[هاة]|اليوم|انهارده/.test(t)) return today.toISODate() ?? undefined;
  const idx = AR_WEEKDAYS.findIndex((re) => re.test(t));
  if (idx >= 0) {
    const ahead = (idx + 1 - today.weekday + 7) % 7 || 7;
    return today.plus({ days: ahead }).toISODate() ?? undefined;
  }
  return undefined;
}

function parseArabicTime(t: string): string | undefined {
  const withWord = new RegExp(
    `(\\d{1,2})(?::(\\d{2}))?\\s*(صباحا|الصبح|صبح|ص|مساء|العصر|عصر|المغرب|بالليل|الليل|م|الظهر|ظهر)${NOT_AR}`,
  ).exec(t);
  const bare = /الساعه\s*(\d{1,2})(?::(\d{2}))?/.exec(t);
  const m = withWord ?? bare;
  if (!m?.[1]) return undefined;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const word = withWord ? m[3] : undefined;
  if (hour > 23 || minute > 59) return undefined;
  if (word) {
    const am = /^(صباحا|الصبح|صبح|ص)$/.test(word);
    const noon = /ظهر/.test(word);
    if (am) {
      if (hour === 12) hour = 0;
    } else if (noon) {
      if (hour < 7) hour += 12;
    } else if (hour < 12) hour += 12;
  } else if (hour >= 1 && hour <= 8) {
    hour += 12; // salon hours: "الساعة 2" means 2 pm
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

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
    const raw = text.trim();
    const t = normalizeArabic(raw);
    const ar = AR.test(raw);
    const nlu: Nlu = { intent: 'unknown' };

    const bare = t.match(/^\s*(\d{1,2})\s*[.)]?\s*$/);
    if (bare?.[1]) nlu.optionNumber = Number(bare[1]);

    const hasCancelWord = /\bcancel\b|\bdelete\b|الغ[يا]|الغاء|كنسل/i.test(t);
    const code = t.match(/(?:\bcancel|\bdelete|الغ\S*|كنسل)\s+#?([A-Z0-9]{6})\b/i);
    if (code?.[1]) nlu.bookingCode = code[1].toUpperCase();

    for (const [id, re] of Object.entries(SERVICE_WORDS)) {
      if (re.test(t) && ctx.services.some((s) => s.id === id)) nlu.serviceId = id;
    }
    const date = parseDate(t, ctx) ?? (ar ? parseArabicDate(t, ctx) : undefined);
    if (date) nlu.date = date;
    const time = (ar ? parseArabicTime(t) : undefined) ?? parseTime(t);
    if (time) nlu.time = time;

    let intent: Intent = 'unknown';
    const arStart = (words: string) => ar && new RegExp(`^(${words})${NOT_AR}`).test(t);
    if (/^(stop|restart|reset|menu|start over)\b/i.test(t) || arStart('ابدا|من الاول|رجوع|القائمه|المنيو|وقف|ريستارت')) intent = 'restart';
    else if (hasCancelWord) intent = 'cancel';
    else if (/\b(my bookings?|my appointments?|upcoming|list)\b/i.test(t) || (ar && /حجوزات|مواعيدي|ميعادي/.test(t))) intent = 'list';
    else if (/^(y|yes|yeah|yep|ok|okay|confirm|sure)\b/i.test(t) || arStart('نعم|ايوه|ايوا|اه|تمام|موافق|اكد|اكيد|ماشي|اوك|يلا')) intent = 'yes';
    else if (/^(n|no|nope|change)\b/i.test(t) || arStart('لا|لاء|غير|مش')) intent = 'no';
    else if (/\b(book|appointment|reserve|schedule)\b/i.test(t) || nlu.serviceId || (ar && /احجز|حجز|موعد|ميعاد|عايز|عاوز|عايزه|عاوزه|اريد|ابغي|ابي/.test(t))) intent = 'book';
    else if (/^(hi|hello|hey|good (morning|evening)|salam)/i.test(t) || arStart('السلام|سلام|مرحبا|اهلا|هلا|صباح|مساء الخير|ازيك|هاي'))
      intent = 'greet';
    else if (/\b(help|\?)/i.test(t)) intent = 'help';
    nlu.intent = intent;
    return nlu;
  }
}
