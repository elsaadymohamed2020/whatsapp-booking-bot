import type { Service } from './domain/types';

export type Lang = 'ar' | 'en';

export const isLang = (v: unknown): v is Lang => v === 'ar' || v === 'en';

/** Picks the reply language: the script of the message wins, digits-only messages keep the session's. */
export function detectLang(text: string, current: Lang | undefined, fallback: Lang): Lang {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[a-z]/i.test(text)) return 'en';
  return current ?? fallback;
}

export const serviceName = (s: Service, lang: Lang): string =>
  lang === 'ar' ? (s.nameAr ?? s.name) : s.name;

export const servicePrice = (s: Service, lang: Lang): string =>
  lang === 'ar' ? (s.priceAr ?? s.price) : s.price;

const numbered = (items: string[]) => items.map((t, i) => `${i + 1}. ${t}`).join('\n');

const en = {
  menu: [
    'I can help you with:',
    '1. Book an appointment',
    '2. See my bookings',
    '',
    'Just tell me what you need, for example "book a haircut tomorrow at 2pm".',
  ].join('\n'),
  hello: 'Hi! 👋 Welcome.',
  didntCatch: 'Sorry, I did not catch that.',
  cleared: 'No problem, I cleared that.',
  replyYesNo: 'Please reply YES to confirm or NO to pick another time.',
  pickService: 'Please pick one of the options.',
  askService: (list: string[]) => `Which service would you like?\n${numbered(list)}`,
  serviceLine: (name: string, minutes: number, price: string) =>
    `${name} (${minutes} min, ${price})`,
  pickDay: 'Please pick one of the days.',
  askDay: (days: string[]) => `Which day works for you?\n${numbered(days)}`,
  noAvailability: 'Sorry, there is no availability in the coming days. Please try again later.',
  nothingFree: (day: string, days: string[]) =>
    `Nothing is free on ${day}. Pick another day:\n${numbered(days)}`,
  confirm: (name: string, when: string) =>
    `Please confirm:\n${name}, ${when}\n\nReply YES to book or NO to change.`,
  notAvailable: 'That time is not available.',
  freeTimes: (day: string, times: string[]) =>
    `Free times on ${day}:\n${numbered(times)}\n\nReply with a number.`,
  serviceGone: 'Sorry, that service no longer exists.',
  slotTaken: 'Sorry, someone just took that time. Say "book" to pick another one.',
  booked: (name: string, when: string, code: string) =>
    [
      `You're booked ✅`,
      `${name}, ${when}`,
      `Booking code: ${code}`,
      `To cancel, send: cancel ${code}`,
    ].join('\n'),
  cancelled: (code: string) =>
    `Booking ${code} is cancelled. Say "book" any time to make a new one.`,
  notFound: (code: string) =>
    `I could not find an active booking with code ${code} on your number.`,
  noBookings: 'You have no upcoming bookings. Say "book" to make one.',
  upcoming: (lines: string[], hint: boolean) =>
    `Your upcoming bookings:\n${lines.join('\n')}${hint ? '\n\nTo cancel, send: cancel <code>' : ''}`,
  bookingLine: (name: string, when: string, code: string) => `• ${name}, ${when} (code ${code})`,
};

const ar: typeof en = {
  menu: [
    'أقدر أساعدك في:',
    '1. حجز موعد',
    '2. شوف حجوزاتي',
    '',
    'قولّي عايز إيه، مثلاً: "عايز أحجز قص شعر بكرة الساعة 2 العصر".',
  ].join('\n'),
  hello: 'أهلاً وسهلاً 👋',
  didntCatch: 'معلش، ما فهمتش قصدك.',
  cleared: 'تمام، مسحت اللي فات.',
  replyYesNo: 'ابعت "نعم" للتأكيد أو "لا" لاختيار ميعاد تاني.',
  pickService: 'اختار واحدة من الخدمات اللي قدامك.',
  askService: (list) => `تحب تحجز إيه؟\n${numbered(list)}`,
  serviceLine: (name, minutes, price) => `${name} (${minutes} دقيقة، ${price})`,
  pickDay: 'اختار يوم من اللي قدامك.',
  askDay: (days) => `أنهي يوم يناسبك؟\n${numbered(days)}`,
  noAvailability: 'معلش، مفيش مواعيد فاضية في الأيام الجاية. جرّب بعدين.',
  nothingFree: (day, days) => `مفيش مواعيد فاضية يوم ${day}. اختار يوم تاني:\n${numbered(days)}`,
  confirm: (name, when) => `تأكيد الحجز:\n${name}، ${when}\n\nابعت "نعم" للتأكيد أو "لا" للتغيير.`,
  notAvailable: 'الميعاد ده مش متاح.',
  freeTimes: (day, times) => `المواعيد الفاضية يوم ${day}:\n${numbered(times)}\n\nابعت رقم الميعاد.`,
  serviceGone: 'معلش، الخدمة دي مش موجودة.',
  slotTaken: 'معلش، حد لسه حاجز الميعاد ده. ابعت "احجز" واختار ميعاد تاني.',
  booked: (name, when, code) =>
    [
      'تم الحجز ✅',
      `${name}، ${when}`,
      `كود الحجز: ${code}`,
      `للإلغاء ابعت: الغي ${code}`,
    ].join('\n'),
  cancelled: (code) => `تم إلغاء الحجز ${code}. ابعت "احجز" في أي وقت لحجز جديد.`,
  notFound: (code) => `ملقيتش حجز شغال بالكود ${code} على رقمك.`,
  noBookings: 'مفيش عندك حجوزات جاية. ابعت "احجز" لحجز موعد.',
  upcoming: (lines, hint) =>
    `حجوزاتك الجاية:\n${lines.join('\n')}${hint ? '\n\nللإلغاء ابعت: الغي <الكود>' : ''}`,
  bookingLine: (name, when, code) => `• ${name}، ${when} (كود ${code})`,
};

export const messages = { en, ar };
export const msgs = (lang: Lang | undefined) => messages[lang ?? 'en'];
