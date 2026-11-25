import type { Nlu, Service } from '../domain/types';

export interface NluContext {
  services: readonly Service[];
  /** Today's date in the business timezone (yyyy-MM-dd), so "tomorrow" can be resolved. */
  today: string;
  timezone: string;
  /** Where the user is in the booking flow. Helps disambiguate a bare "2". */
  state: string;
}

/** Turns a free-text message into structured intent + entities. */
export interface NluProvider {
  readonly name: string;
  interpret(text: string, ctx: NluContext): Promise<Nlu>;
}
