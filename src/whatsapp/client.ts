import { logger } from '../logger';

/** Outbound messaging port. The bot only knows this interface. */
export interface MessageSender {
  sendText(to: string, body: string): Promise<void>;
}

export interface WhatsAppClientOptions {
  token: string;
  phoneNumberId: string;
  graphVersion: string;
  fetchFn?: typeof fetch;
}

/** Sends messages through the WhatsApp Cloud API (Meta Graph API). */
export class WhatsAppClient implements MessageSender {
  constructor(private readonly opts: WhatsAppClientOptions) {}

  async sendText(to: string, body: string): Promise<void> {
    const { token, phoneNumberId, graphVersion, fetchFn = fetch } = this.opts;
    const res = await fetchFn(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body, preview_url: false },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 300)}`);
    }
  }
}

/** Used when no token is configured: prints replies instead of sending them. */
export class DryRunSender implements MessageSender {
  async sendText(to: string, body: string): Promise<void> {
    logger.info('[dry-run] would send WhatsApp message', { to, body });
  }
}

/** Captures messages in memory. Used by tests and the local chat endpoint. */
export class CaptureSender implements MessageSender {
  readonly sent: { to: string; body: string }[] = [];
  async sendText(to: string, body: string): Promise<void> {
    this.sent.push({ to, body });
  }
}
