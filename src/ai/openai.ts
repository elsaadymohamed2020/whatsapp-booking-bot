import { z } from 'zod';
import type { Nlu } from '../domain/types';
import { logger } from '../logger';
import type { NluContext, NluProvider } from './types';

/** The function the model is forced to call. Its arguments are our structured NLU result. */
const TOOL = {
  type: 'function',
  function: {
    name: 'interpret_message',
    description: 'Record what the customer wants from their latest WhatsApp message.',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['greet', 'book', 'list', 'cancel', 'help', 'restart', 'yes', 'no', 'unknown'],
        },
        serviceId: {
          type: 'string',
          description: 'One of the service ids, only if the user named a service.',
        },
        date: {
          type: 'string',
          description: 'yyyy-MM-dd. Resolve relative days like "tomorrow" using today.',
        },
        time: { type: 'string', description: 'HH:mm, 24-hour clock.' },
        optionNumber: {
          type: 'integer',
          description: 'Set only if the message is just a list choice number.',
        },
        bookingCode: {
          type: 'string',
          description: '6-character code when cancelling a specific booking.',
        },
      },
      required: ['intent'],
      additionalProperties: false,
    },
  },
} as const;

const resultSchema = z.object({
  intent: z.enum(['greet', 'book', 'list', 'cancel', 'help', 'restart', 'yes', 'no', 'unknown']),
  serviceId: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  optionNumber: z.number().int().optional(),
  bookingCode: z.string().optional(),
});

export class OpenAiNlu implements NluProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fallback: NluProvider,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async interpret(text: string, ctx: NluContext): Promise<Nlu> {
    const system = [
      'You are the language-understanding step of an appointment-booking WhatsApp bot.',
      'Extract the customer intent and any booking details by calling interpret_message.',
      `Today is ${ctx.today} (${ctx.timezone}). The conversation state is ${ctx.state}.`,
      `Services: ${ctx.services.map((s) => `${s.id} = ${s.name}`).join('; ')}.`,
      'Never invent details the customer did not give. Messages may be in English or Arabic.',
    ].join('\n');

    try {
      const res = await this.fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text },
          ],
          tools: [TOOL],
          tool_choice: { type: 'function', function: { name: 'interpret_message' } },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);

      const body = (await res.json()) as {
        choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
      };
      const args = body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) throw new Error('No tool call in OpenAI response');

      const parsed = resultSchema.parse(JSON.parse(args));
      const valid = ctx.services.some((s) => s.id === parsed.serviceId);
      return { ...parsed, serviceId: valid ? parsed.serviceId : undefined };
    } catch (err) {
      // The bot must keep working if the AI provider is down or returns junk.
      logger.warn('OpenAI NLU failed, using rule-based fallback', {
        error: (err as Error).message,
      });
      return this.fallback.interpret(text, ctx);
    }
  }
}
