import type { Formatter } from './format';
import type { Nlu, Service, Session } from './types';

/** Side effects the machine asks the caller to perform. Keeps the machine itself pure and testable. */
export type Action =
  | { type: 'create_booking'; serviceId: string; start: string }
  | { type: 'cancel_booking'; code: string }
  | { type: 'list_bookings'; cancelHint?: boolean };

export interface StepResult {
  session: Session;
  /** Text to send now. May be empty when an action produces the reply. */
  reply: string;
  action?: Action;
}

/** Read-only lookups the machine needs. Implemented against the repositories in production. */
export interface Availability {
  services: readonly Service[];
  daysFor(serviceId: string): Promise<string[]>;
  slotsFor(serviceId: string, date: string): Promise<string[]>;
  fmt: Formatter;
}

const MENU = [
  'I can help you with:',
  '1. Book an appointment',
  '2. See my bookings',
  '',
  'Just tell me what you need, for example "book a haircut tomorrow at 2pm".',
].join('\n');

const numbered = (items: string[]) => items.map((t, i) => `${i + 1}. ${t}`).join('\n');

const reset = (s: Session): Session => ({ phone: s.phone, state: 'IDLE', updatedAt: s.updatedAt });

/**
 * Conversation flow:  IDLE -> PICK_SERVICE -> PICK_DAY -> PICK_SLOT -> CONFIRM -> IDLE
 *
 * The NLU layer may fill several fields in one message ("haircut tomorrow 2pm"), so the machine
 * is slot-filling: it applies whatever it was given, then asks for the first thing still missing.
 */
export async function step(
  session: Session,
  nlu: Nlu,
  deps: Availability,
  now: Date = new Date(),
): Promise<StepResult> {
  let s: Session = { ...session, updatedAt: now };

  // Global commands work from any state.
  if (nlu.intent === 'list')
    return { session: reset(s), reply: '', action: { type: 'list_bookings' } };
  if (nlu.intent === 'cancel' && nlu.bookingCode) {
    return {
      session: reset(s),
      reply: '',
      action: { type: 'cancel_booking', code: nlu.bookingCode },
    };
  }
  if (nlu.intent === 'restart' || (nlu.intent === 'cancel' && s.state !== 'IDLE')) {
    return { session: reset(s), reply: `No problem, I cleared that.\n\n${MENU}` };
  }
  if (nlu.intent === 'cancel') {
    return { session: reset(s), reply: '', action: { type: 'list_bookings', cancelHint: true } };
  }

  if (s.state === 'IDLE') {
    const wantsBooking = nlu.intent === 'book' || nlu.serviceId || nlu.date;
    if (!wantsBooking) {
      if (nlu.optionNumber === 2)
        return { session: s, reply: '', action: { type: 'list_bookings' } };
      if (nlu.optionNumber !== 1) {
        const hello = nlu.intent === 'greet' ? 'Hi! 👋 Welcome.' : 'Sorry, I did not catch that.';
        return { session: s, reply: `${hello}\n\n${MENU}` };
      }
    }
    s = { ...s, state: 'PICK_SERVICE' };
  }

  if (s.state === 'CONFIRM') {
    if (nlu.intent === 'yes' && s.serviceId && s.slot) {
      return {
        session: reset(s),
        reply: '',
        action: { type: 'create_booking', serviceId: s.serviceId, start: s.slot },
      };
    }
    if (nlu.intent === 'no') {
      // Keep the service, let the customer choose another time.
      s = { ...s, state: 'PICK_DAY', date: undefined, slot: undefined, offeredSlots: undefined };
    } else {
      return { session: s, reply: 'Please reply YES to confirm or NO to pick another time.' };
    }
  }

  // ---- Apply whatever the message told us ----
  // A number typed from the IDLE menu selects a menu entry, not a service.
  const byNumber = session.state === 'IDLE' ? undefined : nlu.optionNumber;

  if (nlu.serviceId && deps.services.some((x) => x.id === nlu.serviceId)) {
    s = { ...s, serviceId: nlu.serviceId };
  } else if (s.state === 'PICK_SERVICE' && byNumber) {
    const chosen = deps.services[byNumber - 1];
    if (chosen) s = { ...s, serviceId: chosen.id };
  }

  if (s.serviceId) {
    if (nlu.date) {
      s = { ...s, date: nlu.date };
    } else if (s.state === 'PICK_DAY' && byNumber) {
      const chosen = s.offeredDays?.[byNumber - 1];
      if (chosen) s = { ...s, date: chosen };
    }
  }

  // ---- Ask for the first missing piece ----
  if (!s.serviceId) {
    const list = numbered(
      deps.services.map((x) => `${x.name} (${x.durationMinutes} min, ${x.price})`),
    );
    const retry =
      session.state !== 'IDLE' && (byNumber || nlu.intent === 'unknown')
        ? 'Please pick one of the options.\n\n'
        : '';
    return {
      session: { ...s, state: 'PICK_SERVICE' },
      reply: `${retry}Which service would you like?\n${list}`,
    };
  }

  if (!s.date) {
    const days = await deps.daysFor(s.serviceId);
    if (days.length === 0) {
      return {
        session: reset(s),
        reply: 'Sorry, there is no availability in the coming days. Please try again later.',
      };
    }
    const retry =
      s.state === 'PICK_DAY' && (byNumber || nlu.intent === 'unknown')
        ? 'Please pick one of the days.\n\n'
        : '';
    return {
      session: { ...s, state: 'PICK_DAY', offeredDays: days },
      reply: `${retry}Which day works for you?\n${numbered(days.map((d) => deps.fmt.day(d)))}`,
    };
  }

  const slots = await deps.slotsFor(s.serviceId, s.date);
  if (slots.length === 0) {
    const days = await deps.daysFor(s.serviceId);
    return {
      session: { ...s, state: 'PICK_DAY', date: undefined, offeredDays: days },
      reply: `Nothing is free on ${deps.fmt.day(s.date)}. Pick another day:\n${numbered(days.map((d) => deps.fmt.day(d)))}`,
    };
  }

  let chosen: string | undefined;
  if (s.state === 'PICK_SLOT' && byNumber) chosen = s.offeredSlots?.[byNumber - 1];
  if (!chosen && nlu.time) chosen = slots.find((iso) => deps.fmt.time(iso) === nlu.time);

  if (chosen && slots.includes(chosen)) {
    const service = deps.services.find((x) => x.id === s.serviceId);
    return {
      session: { ...s, state: 'CONFIRM', slot: chosen },
      reply: `Please confirm:\n${service?.name ?? s.serviceId}, ${deps.fmt.dateTime(chosen)}\n\nReply YES to book or NO to change.`,
    };
  }

  const retry =
    s.state === 'PICK_SLOT' && (byNumber || nlu.time) ? 'That time is not available.\n\n' : '';
  return {
    session: { ...s, state: 'PICK_SLOT', offeredSlots: slots },
    reply: `${retry}Free times on ${deps.fmt.day(s.date)}:\n${numbered(slots.map((iso) => deps.fmt.time(iso)))}\n\nReply with a number.`,
  };
}
