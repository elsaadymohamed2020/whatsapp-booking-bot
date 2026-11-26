import 'dotenv/config';
import { z } from 'zod';

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm');

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().default(''),
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default('change-me'),
  WHATSAPP_APP_SECRET: z.string().default(''),
  GRAPH_API_VERSION: z.string().default('v21.0'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  BUSINESS_TIMEZONE: z.string().default('Africa/Cairo'),
  BUSINESS_DAYS: z.string().default('1,2,3,4,5'),
  BUSINESS_OPEN: timeOfDay.default('09:00'),
  BUSINESS_CLOSE: timeOfDay.default('17:00'),
  MIN_LEAD_MINUTES: z.coerce.number().int().min(0).default(60),
  SLOT_STEP_MINUTES: z.coerce.number().int().min(0).default(0),
  BOOKING_HORIZON_DAYS: z.coerce.number().int().min(1).max(60).default(14),
});

export interface BusinessHours {
  timezone: string;
  /** Luxon weekday numbers, 1 = Monday ... 7 = Sunday. */
  days: number[];
  open: string;
  close: string;
  minLeadMinutes: number;
  horizonDays: number;
  /** Gap between offered start times. 0 means back to back (the service duration). */
  slotStepMinutes?: number;
}

export interface Config {
  port: number;
  mongoUri: string;
  whatsapp: {
    token: string;
    phoneNumberId: string;
    verifyToken: string;
    appSecret: string;
    graphVersion: string;
  };
  openai: { apiKey: string; model: string };
  business: BusinessHours;
}

/** Parses and validates environment variables once, failing fast with a readable error. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  const days = e.BUSINESS_DAYS.split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (days.length === 0) throw new Error('BUSINESS_DAYS must list at least one weekday (1-7)');

  return {
    port: e.PORT,
    mongoUri: e.MONGODB_URI,
    whatsapp: {
      token: e.WHATSAPP_TOKEN,
      phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID,
      verifyToken: e.WHATSAPP_VERIFY_TOKEN,
      appSecret: e.WHATSAPP_APP_SECRET,
      graphVersion: e.GRAPH_API_VERSION,
    },
    openai: { apiKey: e.OPENAI_API_KEY, model: e.OPENAI_MODEL },
    business: {
      timezone: e.BUSINESS_TIMEZONE,
      days,
      open: e.BUSINESS_OPEN,
      close: e.BUSINESS_CLOSE,
      minLeadMinutes: e.MIN_LEAD_MINUTES,
      horizonDays: e.BOOKING_HORIZON_DAYS,
      slotStepMinutes: e.SLOT_STEP_MINUTES,
    },
  };
}
