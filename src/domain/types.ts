export interface Service {
  id: string;
  name: string;
  /** Arabic display name, used when the customer writes in Arabic. */
  nameAr?: string;
  durationMinutes: number;
  price: string;
  priceAr?: string;
}

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  /** Short human-friendly code the customer uses to cancel, e.g. "A1B2C3". */
  code: string;
  /** Customer's WhatsApp number (wa_id). */
  phone: string;
  serviceId: string;
  /** Always stored in UTC; rendered in the business timezone. */
  start: Date;
  end: Date;
  status: BookingStatus;
  createdAt: Date;
}

export type ConversationState = 'IDLE' | 'PICK_SERVICE' | 'PICK_DAY' | 'PICK_SLOT' | 'CONFIRM';

export interface Session {
  phone: string;
  state: ConversationState;
  serviceId?: string;
  /** Local calendar day in the business timezone, yyyy-MM-dd. */
  date?: string;
  /** Options currently shown to the customer so "2" means the right thing. */
  offeredDays?: string[];
  /** UTC ISO strings. */
  offeredSlots?: string[];
  /** The slot chosen, awaiting confirmation. UTC ISO string. */
  slot?: string;
  /** Language the customer is writing in; replies follow it. */
  lang?: 'ar' | 'en';
  updatedAt: Date;
}

export type Intent =
  'greet' | 'book' | 'list' | 'cancel' | 'help' | 'restart' | 'yes' | 'no' | 'unknown';

/** What the NLU layer (OpenAI or the rule-based fallback) extracts from one message. */
export interface Nlu {
  intent: Intent;
  serviceId?: string;
  /** yyyy-MM-dd in the business timezone. */
  date?: string;
  /** HH:mm, 24h, business timezone. */
  time?: string;
  /** A bare number the user typed, used to pick from a numbered list. */
  optionNumber?: number;
  bookingCode?: string;
}
