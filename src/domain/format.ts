import { DateTime } from 'luxon';

/** Presentation helpers. Everything is rendered in the business timezone. */
export function makeFormatter(timezone: string, locale = 'en') {
  return {
    day(date: string): string {
      return DateTime.fromISO(date, { zone: timezone }).setLocale(locale).toFormat('ccc d LLL');
    },
    time(iso: string | Date): string {
      const dt = typeof iso === 'string' ? DateTime.fromISO(iso) : DateTime.fromJSDate(iso);
      return dt.setZone(timezone).setLocale(locale).toFormat('HH:mm');
    },
    dateTime(iso: string | Date): string {
      const dt = typeof iso === 'string' ? DateTime.fromISO(iso) : DateTime.fromJSDate(iso);
      return dt.setZone(timezone).setLocale(locale).toFormat('ccc d LLL, HH:mm');
    },
  };
}

export type Formatter = ReturnType<typeof makeFormatter>;
