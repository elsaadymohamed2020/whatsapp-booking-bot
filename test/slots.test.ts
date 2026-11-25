import { describe, expect, it } from 'vitest';
import { availableDays, generateSlots } from '../src/domain/slots';
import type { Service } from '../src/domain/types';
import { HOURS } from './helpers';

const service: Service = { id: 'haircut', name: 'Haircut', durationMinutes: 60, price: 'x' };
// Cairo is UTC+2 in winter. 2026-12-01 is a Tuesday.
const earlyMorning = new Date('2026-12-01T00:00:00Z');

const times = (slots: Date[]) => slots.map((d) => d.toISOString().slice(11, 16));

describe('generateSlots', () => {
  it('lays out back-to-back slots inside business hours, returned as UTC', () => {
    const slots = generateSlots({
      hours: HOURS,
      service,
      date: '2026-12-01',
      busy: [],
      now: earlyMorning,
    });
    // 09:00-17:00 Cairo = 07:00-15:00 UTC, last slot starts 16:00 Cairo = 14:00 UTC
    expect(times(slots)).toEqual([
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
    ]);
  });

  it('returns nothing on non-business days', () => {
    // 2026-12-05 is a Saturday
    expect(
      generateSlots({ hours: HOURS, service, date: '2026-12-05', busy: [], now: earlyMorning }),
    ).toEqual([]);
  });

  it('removes slots that overlap an existing booking', () => {
    const busy = [
      { start: new Date('2026-12-01T08:30:00Z'), end: new Date('2026-12-01T09:30:00Z') },
    ];
    const slots = generateSlots({
      hours: HOURS,
      service,
      date: '2026-12-01',
      busy,
      now: earlyMorning,
    });
    expect(times(slots)).not.toContain('08:00');
    expect(times(slots)).not.toContain('09:00');
    expect(times(slots)).toContain('10:00');
  });

  it('respects the minimum lead time', () => {
    // 10:30 Cairo = 08:30 UTC. With a 60 min lead, the first slot is 12:00 Cairo (10:00 UTC).
    const now = new Date('2026-12-01T08:30:00Z');
    const slots = generateSlots({ hours: HOURS, service, date: '2026-12-01', busy: [], now });
    expect(times(slots)[0]).toBe('10:00');
  });

  it('never offers a slot that would run past closing time', () => {
    const long: Service = { ...service, durationMinutes: 90 };
    const slots = generateSlots({
      hours: HOURS,
      service: long,
      date: '2026-12-01',
      busy: [],
      now: earlyMorning,
    });
    // 8h / 1.5h = 5 slots, the remaining 30 minutes is not enough
    expect(slots).toHaveLength(5);
  });

  it('handles daylight saving time (Europe/Berlin, 2026-03-29 clocks go forward)', () => {
    const berlin = { ...HOURS, timezone: 'Europe/Berlin', days: [1, 2, 3, 4, 5, 6, 7] };
    const slots = generateSlots({
      hours: berlin,
      service,
      date: '2026-03-29',
      busy: [],
      now: new Date('2026-03-01T00:00:00Z'),
    });
    // 09:00 local is CEST (UTC+2) on that day, so 07:00 UTC, not 08:00
    expect(times(slots)[0]).toBe('07:00');
  });
});

describe('availableDays', () => {
  it('skips weekends and returns at most `limit` days', () => {
    // Friday 2026-12-04 evening, after closing: first bookable day is Monday 2026-12-07
    const now = new Date('2026-12-04T16:00:00Z');
    const days = availableDays({ hours: HOURS, service, busy: [], now }, 3);
    expect(days).toEqual(['2026-12-07', '2026-12-08', '2026-12-09']);
  });
});
