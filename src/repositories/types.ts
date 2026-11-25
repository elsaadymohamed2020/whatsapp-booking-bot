import type { Booking, Session } from '../domain/types';
import type { Interval } from '../domain/slots';

/**
 * Storage contracts. The bot only depends on these interfaces, so MongoDB, Postgres or the
 * in-memory implementation are interchangeable.
 */
export interface BookingRepository {
  /** Fails with SlotTakenError if the interval overlaps a confirmed booking. */
  create(booking: Booking): Promise<Booking>;
  /** Cancels a booking owned by `phone`. Returns the booking, or null if not found / not owned. */
  cancel(code: string, phone: string): Promise<Booking | null>;
  listUpcoming(phone: string, from: Date): Promise<Booking[]>;
  /** Confirmed bookings that overlap [from, to). */
  busyBetween(from: Date, to: Date): Promise<Interval[]>;
}

export interface SessionRepository {
  get(phone: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
}

export interface Repositories {
  bookings: BookingRepository;
  sessions: SessionRepository;
  close(): Promise<void>;
}

export class SlotTakenError extends Error {
  constructor() {
    super('That time was just taken.');
    this.name = 'SlotTakenError';
  }
}
