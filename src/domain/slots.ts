import { DateTime } from 'luxon';
import type { BusinessHours } from '../config';
import type { Service } from './types';

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotQuery {
  hours: BusinessHours;
  service: Service;
  /** Local calendar day, yyyy-MM-dd, in hours.timezone. */
  date: string;
  /** Intervals that are already taken (confirmed bookings). */
  busy: Interval[];
  now: Date;
}

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

/**
 * Generates bookable start times for one local day.
 *
 * - Slots are laid out back to back, every `service.durationMinutes`, from opening to closing.
 * - A slot must fit entirely before closing time.
 * - Slots in the past, or closer than `minLeadMinutes`, are dropped.
 * - Slots overlapping an existing booking are dropped.
 *
 * Computation happens in the business timezone, so DST changes are handled by Luxon.
 * Returned values are UTC instants.
 */
export function generateSlots(q: SlotQuery): Date[] {
  const { hours, service, date, busy, now } = q;
  const day = DateTime.fromISO(date, { zone: hours.timezone });
  if (!day.isValid || !hours.days.includes(day.weekday)) return [];

  const open = day.set({ ...parseHm(hours.open), second: 0, millisecond: 0 });
  const close = day.set({ ...parseHm(hours.close), second: 0, millisecond: 0 });
  const earliest = DateTime.fromJSDate(now).plus({ minutes: hours.minLeadMinutes });

  const slots: Date[] = [];
  for (
    let start = open;
    start.plus({ minutes: service.durationMinutes }) <= close;
    start = start.plus({ minutes: service.durationMinutes })
  ) {
    const end = start.plus({ minutes: service.durationMinutes });
    if (start < earliest) continue;
    const clash = busy.some(
      (b) => start.toMillis() < b.end.getTime() && end.toMillis() > b.start.getTime(),
    );
    if (!clash) slots.push(start.toUTC().toJSDate());
  }
  return slots;
}

/** Local days (yyyy-MM-dd) within the booking horizon that have at least one free slot. */
export function availableDays(q: Omit<SlotQuery, 'date'>, limit = 5): string[] {
  const today = DateTime.fromJSDate(q.now, { zone: q.hours.timezone }).startOf('day');
  const days: string[] = [];
  for (let i = 0; i <= q.hours.horizonDays && days.length < limit; i++) {
    const date = today.plus({ days: i }).toISODate();
    if (date && generateSlots({ ...q, date }).length > 0) days.push(date);
  }
  return days;
}
