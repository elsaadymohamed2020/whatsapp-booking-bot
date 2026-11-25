import { describe, expect, it } from 'vitest';
import { SERVICES } from '../src/domain/catalog';
import { makeFormatter } from '../src/domain/format';
import { step, type Availability } from '../src/domain/stateMachine';
import type { Nlu, Session } from '../src/domain/types';

const SLOTS = ['2026-12-01T07:00:00.000Z', '2026-12-01T08:00:00.000Z']; // 09:00 and 10:00 Cairo
const deps: Availability = {
  services: SERVICES,
  fmt: makeFormatter('Africa/Cairo'),
  daysFor: async () => ['2026-12-01', '2026-12-02'],
  slotsFor: async (_s, date) => (date === '2026-12-01' ? SLOTS : []),
};

const fresh = (): Session => ({ phone: '1', state: 'IDLE', updatedAt: new Date() });
const say = (s: Session, nlu: Nlu) => step(s, nlu, deps);

describe('booking state machine', () => {
  it('walks greet -> service -> day -> slot -> confirm -> create', async () => {
    let r = await say(fresh(), { intent: 'greet' });
    expect(r.session.state).toBe('IDLE');
    expect(r.reply).toContain('Book an appointment');

    r = await say(r.session, { intent: 'book' });
    expect(r.session.state).toBe('PICK_SERVICE');

    r = await say(r.session, { intent: 'unknown', optionNumber: 2 });
    expect(r.session.serviceId).toBe('haircut');
    expect(r.session.state).toBe('PICK_DAY');

    r = await say(r.session, { intent: 'unknown', optionNumber: 1 });
    expect(r.session.date).toBe('2026-12-01');
    expect(r.session.state).toBe('PICK_SLOT');
    expect(r.reply).toContain('09:00');

    r = await say(r.session, { intent: 'unknown', optionNumber: 2 });
    expect(r.session.state).toBe('CONFIRM');
    expect(r.reply).toContain('10:00');

    r = await say(r.session, { intent: 'yes' });
    expect(r.action).toEqual({ type: 'create_booking', serviceId: 'haircut', start: SLOTS[1] });
    expect(r.session.state).toBe('IDLE');
  });

  it('jumps straight to confirmation when one message has everything', async () => {
    const r = await say(fresh(), {
      intent: 'book',
      serviceId: 'haircut',
      date: '2026-12-01',
      time: '09:00',
    });
    expect(r.session.state).toBe('CONFIRM');
    expect(r.session.slot).toBe(SLOTS[0]);
  });

  it('treats "1" from the idle menu as "book", not as the first service', async () => {
    const r = await say(fresh(), { intent: 'unknown', optionNumber: 1 });
    expect(r.session.state).toBe('PICK_SERVICE');
    expect(r.session.serviceId).toBeUndefined();
  });

  it('re-asks for a day when the requested day is full', async () => {
    const r = await say(fresh(), { intent: 'book', serviceId: 'haircut', date: '2026-12-02' });
    expect(r.session.state).toBe('PICK_DAY');
    expect(r.reply).toContain('Nothing is free');
  });

  it('goes back to day selection on NO at confirmation, keeping the service', async () => {
    let r = await say(fresh(), {
      intent: 'book',
      serviceId: 'haircut',
      date: '2026-12-01',
      time: '09:00',
    });
    r = await say(r.session, { intent: 'no' });
    expect(r.session.state).toBe('PICK_DAY');
    expect(r.session.serviceId).toBe('haircut');
    expect(r.session.slot).toBeUndefined();
  });

  it('rejects an out-of-range option without losing progress', async () => {
    let r = await say(fresh(), { intent: 'book', serviceId: 'haircut' });
    r = await say(r.session, { intent: 'unknown', optionNumber: 9 });
    expect(r.session.state).toBe('PICK_DAY');
    expect(r.reply).toContain('Please pick one of the days');
  });

  it('cancels a booking by code from any state', async () => {
    const r = await say(
      { ...fresh(), state: 'PICK_SLOT' },
      { intent: 'cancel', bookingCode: 'ABC123' },
    );
    expect(r.action).toEqual({ type: 'cancel_booking', code: 'ABC123' });
    expect(r.session.state).toBe('IDLE');
  });

  it('restart clears the flow', async () => {
    const r = await say(
      { ...fresh(), state: 'PICK_SLOT', serviceId: 'haircut' },
      { intent: 'restart' },
    );
    expect(r.session.state).toBe('IDLE');
    expect(r.session.serviceId).toBeUndefined();
  });
});
