import mongoose, { Schema, type Model } from 'mongoose';
import type { Booking, Session } from '../domain/types';
import type { Interval } from '../domain/slots';
import {
  SlotTakenError,
  type BookingRepository,
  type Repositories,
  type SessionRepository,
} from './types';

const bookingSchema = new Schema<Booking>(
  {
    code: { type: String, required: true, unique: true },
    phone: { type: String, required: true, index: true },
    serviceId: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
// Fast overlap queries, and a hard guarantee against two bookings with the same start time.
bookingSchema.index({ start: 1, end: 1 });
bookingSchema.index(
  { start: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } },
);

const sessionSchema = new Schema<Session>(
  {
    phone: { type: String, required: true, unique: true },
    state: { type: String, required: true },
    serviceId: String,
    date: String,
    offeredDays: [String],
    offeredSlots: [String],
    slot: String,
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
// Abandoned conversations disappear after 24h.
sessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const BookingModel =
  (mongoose.models.Booking as Model<Booking> | undefined) ??
  mongoose.model<Booking>('Booking', bookingSchema);
const SessionModel =
  (mongoose.models.Session as Model<Session> | undefined) ??
  mongoose.model<Session>('Session', sessionSchema);

const clean = <T>(doc: unknown): T => {
  const { _id, ...rest } = doc as Record<string, unknown>;
  void _id;
  return rest as T;
};

class MongoBookingRepository implements BookingRepository {
  async create(booking: Booking): Promise<Booking> {
    const clash = await BookingModel.exists({
      status: 'confirmed',
      start: { $lt: booking.end },
      end: { $gt: booking.start },
    });
    if (clash) throw new SlotTakenError();
    try {
      await BookingModel.create(booking);
    } catch (err) {
      // Duplicate key: a concurrent request won the race between exists() and create().
      if ((err as { code?: number }).code === 11000) throw new SlotTakenError();
      throw err;
    }
    return booking;
  }

  async cancel(code: string, phone: string): Promise<Booking | null> {
    const doc = await BookingModel.findOneAndUpdate(
      { code: code.toUpperCase(), phone, status: 'confirmed' },
      { status: 'cancelled' },
      { new: true, lean: true },
    );
    return doc ? clean<Booking>(doc) : null;
  }

  async listUpcoming(phone: string, from: Date): Promise<Booking[]> {
    const docs = await BookingModel.find({ phone, status: 'confirmed', end: { $gt: from } })
      .sort({ start: 1 })
      .lean();
    return docs.map((d) => clean<Booking>(d));
  }

  async busyBetween(from: Date, to: Date): Promise<Interval[]> {
    const docs = await BookingModel.find({
      status: 'confirmed',
      start: { $lt: to },
      end: { $gt: from },
    })
      .select('start end')
      .lean();
    return docs.map((d) => ({ start: d.start as Date, end: d.end as Date }));
  }
}

class MongoSessionRepository implements SessionRepository {
  async get(phone: string): Promise<Session | null> {
    const doc = await SessionModel.findOne({ phone }).lean();
    return doc ? clean<Session>(doc) : null;
  }

  async save(session: Session): Promise<void> {
    await SessionModel.updateOne({ phone: session.phone }, session, { upsert: true });
  }
}

export async function createMongoRepositories(uri: string): Promise<Repositories> {
  await mongoose.connect(uri);
  await Promise.all([BookingModel.init(), SessionModel.init()]);
  return {
    bookings: new MongoBookingRepository(),
    sessions: new MongoSessionRepository(),
    close: async () => {
      await mongoose.disconnect();
    },
  };
}
