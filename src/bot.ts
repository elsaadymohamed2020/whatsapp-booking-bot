import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import type { NluProvider } from './ai/types';
import type { BusinessHours } from './config';
import { SERVICES, findService } from './domain/catalog';
import { detectLang, msgs, serviceName, type Lang } from './i18n';
import { makeFormatter } from './domain/format';
import { availableDays, generateSlots } from './domain/slots';
import { step, type Action, type Availability } from './domain/stateMachine';
import type { Booking, Service, Session } from './domain/types';
import type { Repositories } from './repositories/types';
import { SlotTakenError } from './repositories/types';

export interface BotDeps {
  repos: Repositories;
  nlu: NluProvider;
  hours: BusinessHours;
  services?: readonly Service[];
  clock?: () => Date;
  /** Language used until the customer writes something recognisable. */
  defaultLang?: Lang;
}

/** Orchestrates one inbound message: load session -> understand -> state machine -> side effects. */
export class BookingBot {
  private readonly services: readonly Service[];
  private readonly clock: () => Date;
  private readonly fmt;
  private readonly fmtAr;

  constructor(private readonly deps: BotDeps) {
    this.services = deps.services ?? SERVICES;
    this.clock = deps.clock ?? (() => new Date());
    this.fmt = makeFormatter(deps.hours.timezone);
    this.fmtAr = makeFormatter(deps.hours.timezone, 'ar-u-nu-latn');
  }

  async handleMessage(phone: string, text: string): Promise<string> {
    const now = this.clock();
    const { repos, nlu, hours } = this.deps;

    const stored: Session = (await repos.sessions.get(phone)) ?? {
      phone,
      state: 'IDLE',
      updatedAt: now,
    };
    // Reply in the language the customer writes in. Arabic is the default for the demo.
    const lang: Lang = detectLang(text, stored.lang, this.deps.defaultLang ?? 'ar');
    const session: Session = { ...stored, lang };

    const understood = await nlu.interpret(text, {
      services: this.services,
      today: DateTime.fromJSDate(now, { zone: hours.timezone }).toISODate() ?? '',
      timezone: hours.timezone,
      state: session.state,
    });

    const result = await step(session, understood, this.availability(now), now);
    await repos.sessions.save(result.session);

    const actionReply = result.action ? await this.perform(result.action, phone, now, lang) : '';
    return [result.reply, actionReply].filter(Boolean).join('\n\n');
  }

  private availability(now: Date): Availability {
    const { repos, hours } = this.deps;
    const horizonEnd = DateTime.fromJSDate(now)
      .plus({ days: hours.horizonDays + 1 })
      .toJSDate();

    return {
      services: this.services,
      fmt: this.fmt,
      fmtAr: this.fmtAr,
      daysFor: async (serviceId) => {
        const service = findService(serviceId, this.services);
        if (!service) return [];
        const busy = await repos.bookings.busyBetween(now, horizonEnd);
        return availableDays({ hours, service, busy, now });
      },
      slotsFor: async (serviceId, date) => {
        const service = findService(serviceId, this.services);
        if (!service) return [];
        const dayStart = DateTime.fromISO(date, { zone: hours.timezone }).startOf('day');
        const busy = await repos.bookings.busyBetween(
          dayStart.toJSDate(),
          dayStart.plus({ days: 1 }).toJSDate(),
        );
        return generateSlots({ hours, service, date, busy, now }).map((d) => d.toISOString());
      },
    };
  }

  private async perform(
    action: Action,
    phone: string,
    now: Date,
    lang: Lang,
  ): Promise<string> {
    const { bookings } = this.deps.repos;
    const m = msgs(lang);
    const fmt = lang === 'ar' ? this.fmtAr : this.fmt;

    switch (action.type) {
      case 'create_booking': {
        const service = findService(action.serviceId, this.services);
        if (!service) return m.serviceGone;
        const start = new Date(action.start);
        const booking: Booking = {
          code: crypto.randomBytes(3).toString('hex').toUpperCase(),
          phone,
          serviceId: service.id,
          start,
          end: new Date(start.getTime() + service.durationMinutes * 60_000),
          status: 'confirmed',
          createdAt: now,
        };
        try {
          await bookings.create(booking);
        } catch (err) {
          if (err instanceof SlotTakenError) {
            return m.slotTaken;
          }
          throw err;
        }
        return m.booked(serviceName(service, lang), fmt.dateTime(start), booking.code);
      }

      case 'cancel_booking': {
        const cancelled = await bookings.cancel(action.code, phone);
        return cancelled
          ? m.cancelled(cancelled.code)
          : m.notFound(action.code.toUpperCase());
      }

      case 'list_bookings': {
        const upcoming = await bookings.listUpcoming(phone, now);
        if (upcoming.length === 0) return m.noBookings;
        const lines = upcoming.map((b) => {
          const svc = findService(b.serviceId, this.services);
          const name = svc ? serviceName(svc, lang) : b.serviceId;
          return m.bookingLine(name, fmt.dateTime(b.start), b.code);
        });
        return m.upcoming(lines, Boolean(action.cancelHint));
      }
    }
  }
}
