import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RuleBasedNlu } from '../src/ai/rules';
import { BookingBot } from '../src/bot';
import { loadConfig } from '../src/config';
import { createApp } from '../src/http/app';
import { createMemoryRepositories } from '../src/repositories/memory';
import { CaptureSender } from '../src/whatsapp/client';
import { parseIncomingTexts } from '../src/whatsapp/webhook';
import { HOURS } from './helpers';

// Monday 2026-11-30, 08:00 Cairo
const NOW = new Date('2026-11-30T06:00:00Z');

function setup() {
  const bot = new BookingBot({
    repos: createMemoryRepositories(),
    nlu: new RuleBasedNlu(),
    hours: HOURS,
    clock: () => NOW,
  });
  return bot;
}

describe('bot end to end (rule-based NLU, in-memory storage)', () => {
  it('books, lists and cancels through plain messages', async () => {
    const bot = setup();
    await bot.handleMessage('201', 'hi');
    const confirm = await bot.handleMessage('201', 'book a consultation tomorrow at 10:00');
    expect(confirm).toContain('Please confirm');

    const booked = await bot.handleMessage('201', 'yes');
    const code = booked.match(/Booking code: ([A-F0-9]{6})/)?.[1];
    expect(code).toBeDefined();

    expect(await bot.handleMessage('201', 'my bookings')).toContain(code!);

    // A different customer cannot cancel it.
    expect(await bot.handleMessage('999', `cancel ${code}`)).toContain('could not find');
    expect(await bot.handleMessage('201', `cancel ${code}`)).toContain('is cancelled');
    expect(await bot.handleMessage('201', 'my bookings')).toContain('no upcoming');
  });

  it('does not double-book the same time', async () => {
    const bot = setup();
    for (const phone of ['a', 'b']) {
      await bot.handleMessage(phone, 'book a consultation tomorrow at 10:00');
    }
    expect(await bot.handleMessage('a', 'yes')).toContain("You're booked");
    // 'b' is still sitting on the confirmation step for the same slot
    expect(await bot.handleMessage('b', 'yes')).toContain('someone just took that time');
  });
});

describe('webhook', () => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ id: 'wamid.1', from: '201', type: 'text', text: { body: 'hi' } }],
            },
          },
        ],
      },
    ],
  };

  it('parses text messages and ignores everything else', () => {
    expect(parseIncomingTexts(body)).toEqual([{ id: 'wamid.1', from: '201', text: 'hi' }]);
    expect(parseIncomingTexts({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual(
      [],
    );
    expect(parseIncomingTexts(null)).toEqual([]);
  });

  it('answers the verification handshake only with the right token', async () => {
    const config = loadConfig({ WHATSAPP_VERIFY_TOKEN: 'secret' });
    const app = createApp({ config, bot: setup(), sender: new CaptureSender() });
    const ok = await request(app)
      .get('/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'secret', 'hub.challenge': '123' });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('123');
    const bad = await request(app)
      .get('/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '123' });
    expect(bad.status).toBe(403);
  });

  it('rejects unsigned posts when an app secret is set, and replies to signed ones', async () => {
    const config = loadConfig({ WHATSAPP_APP_SECRET: 's3cret' });
    const sender = new CaptureSender();
    const app = createApp({ config, bot: setup(), sender });
    const raw = JSON.stringify(body);

    const unsigned = await request(app)
      .post('/webhook')
      .set('content-type', 'application/json')
      .send(raw);
    expect(unsigned.status).toBe(401);

    const sig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(raw).digest('hex');
    const signed = await request(app)
      .post('/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(raw);
    expect(signed.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe('201');
  });
});
