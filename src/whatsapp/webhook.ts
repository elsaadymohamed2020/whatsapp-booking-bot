import crypto from 'node:crypto';

export interface IncomingText {
  /** Message id (wamid...), used for de-duplication. */
  id: string;
  /** Sender's WhatsApp number. */
  from: string;
  text: string;
}

/**
 * Extracts text messages from a WhatsApp Cloud API webhook payload.
 * Status updates, images, reactions etc. are ignored on purpose. The payload is untrusted,
 * so every access is defensive.
 */
export function parseIncomingTexts(payload: unknown): IncomingText[] {
  const out: IncomingText[] = [];
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const m of messages) {
        const msg = m as { id?: string; from?: string; type?: string; text?: { body?: string } };
        if (msg.type === 'text' && msg.id && msg.from && typeof msg.text?.body === 'string') {
          out.push({ id: msg.id, from: msg.from, text: msg.text.body });
        }
      }
    }
  }
  return out;
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = header.slice('sha256='.length);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
