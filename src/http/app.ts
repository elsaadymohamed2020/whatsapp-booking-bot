import { DEMO_PAGE } from '../web/page';
import express, { type Express, type Request } from 'express';
import type { BookingBot } from '../bot';
import type { Config } from '../config';
import { logger } from '../logger';
import type { MessageSender } from '../whatsapp/client';
import { parseIncomingTexts, verifySignature } from '../whatsapp/webhook';

export interface AppDeps {
  config: Config;
  bot: BookingBot;
  sender: MessageSender;
  /** Enables POST /dev/chat for local demos without WhatsApp. Never enable in production. */
  enableDevChat?: boolean;
}

type RawRequest = Request & { rawBody?: Buffer };

/** Remembers recent message ids: Meta retries deliveries, and we must not book twice. */
class RecentIds {
  private readonly ids = new Set<string>();
  constructor(private readonly max = 5000) {}
  seen(id: string): boolean {
    if (this.ids.has(id)) return true;
    this.ids.add(id);
    if (this.ids.size > this.max) this.ids.delete(this.ids.values().next().value as string);
    return false;
  }
}

export function createApp({ config, bot, sender, enableDevChat }: AppDeps): Express {
  const app = express();
  const recent = new RecentIds();

  // Keep the raw bytes: the signature is computed over them, not over re-serialized JSON.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as RawRequest).rawBody = buf;
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Webhook verification handshake (Meta calls this once when you register the webhook).
  app.get('/webhook', (req, res) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (
      mode === 'subscribe' &&
      token === config.whatsapp.verifyToken &&
      typeof challenge === 'string'
    ) {
      res.status(200).type('text/plain').send(challenge);
      return;
    }
    res.sendStatus(403);
  });

  // Incoming messages.
  app.post('/webhook', (req: RawRequest, res) => {
    const secret = config.whatsapp.appSecret;
    if (
      secret &&
      !verifySignature(req.rawBody ?? Buffer.alloc(0), req.header('x-hub-signature-256'), secret)
    ) {
      logger.warn('Rejected webhook with bad signature');
      res.sendStatus(401);
      return;
    }

    // Acknowledge immediately. WhatsApp retries if we take too long.
    res.sendStatus(200);

    for (const msg of parseIncomingTexts(req.body)) {
      if (recent.seen(msg.id)) continue;
      void (async () => {
        try {
          const reply = await bot.handleMessage(msg.from, msg.text);
          if (reply) await sender.sendText(msg.from, reply);
        } catch (err) {
          logger.error('Failed to handle message', { id: msg.id, error: (err as Error).message });
        }
      })();
    }
  });

  if (enableDevChat) {
    // curl -X POST localhost:3000/dev/chat -H 'content-type: application/json' \
    //   -d '{"from":"201000000000","text":"hi"}'
    app.set('trust proxy', 1);
    app.get('/', (_req, res) => {
      res.type('html').send(DEMO_PAGE);
    });
    const hits = new Map<string, { n: number; reset: number }>();
    app.post('/dev/chat', async (req, res) => {
      // Light protection for a public demo: 40 messages per minute per IP, 300 characters each.
      const now = Date.now();
      const key = req.ip ?? 'unknown';
      const hit = hits.get(key);
      if (!hit || hit.reset < now) hits.set(key, { n: 1, reset: now + 60_000 });
      else if (++hit.n > 40) {
        res.status(429).json({ error: 'too many messages' });
        return;
      }
      if (hits.size > 5000) hits.clear();
      const { from, text } = (req.body ?? {}) as { from?: string; text?: string };
      if (!from || !text || typeof from !== 'string' || typeof text !== 'string') {
        res.status(400).json({ error: 'from and text are required' });
        return;
      }
      if (text.length > 300 || from.length > 64) {
        res.status(400).json({ error: 'message too long' });
        return;
      }
      res.json({ reply: await bot.handleMessage(from, text) });
    });
  }

  return app;
}
