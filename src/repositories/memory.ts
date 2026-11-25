import type { Booking, Session } from '../domain/types';
import type { Interval } from '../domain/slots';
import {
  SlotTakenError,
  type BookingRepository,
  type Repositories,
  type SessionRepository,
} from './types';

const overlaps = (a: Interval, b: Interval) =>
  a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();

export class MemoryBookingRepository implements BookingRepository {
  private readonly items: Booking[] = [];

  async create(booking: Booking): Promise<Booking> {
    const clash = this.items.some((b) => b.status === 'confirmed' && overlaps(b, booking));
    if (clash) throw new SlotTakenError();
    this.items.push({ ...booking });
    return booking;
  }

  async cancel(code: string, phone: string): Promise<Booking | null> {
    const found = this.items.find(
      (b) => b.code === code.toUpperCase() && b.phone === phone && b.status === 'confirmed',
    );
    if (!found) return null;
    found.status = 'cancelled';
    return { ...found };
  }

  async listUpcoming(phone: string, from: Date): Promise<Booking[]> {
    return this.items
      .filter((b) => b.phone === phone && b.status === 'confirmed' && b.end > from)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((b) => ({ ...b }));
  }

  async busyBetween(from: Date, to: Date): Promise<Interval[]> {
    return this.items
      .filter((b) => b.status === 'confirmed' && overlaps(b, { start: from, end: to }))
      .map(({ start, end }) => ({ start, end }));
  }
}

export class MemorySessionRepository implements SessionRepository {
  private readonly items = new Map<string, Session>();

  async get(phone: string): Promise<Session | null> {
    const s = this.items.get(phone);
    return s ? { ...s } : null;
  }

  async save(session: Session): Promise<void> {
    this.items.set(session.phone, { ...session });
  }
}

export function createMemoryRepositories(): Repositories {
  return {
    bookings: new MemoryBookingRepository(),
    sessions: new MemorySessionRepository(),
    close: async () => undefined,
  };
}
