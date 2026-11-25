import type { Config } from '../config';
import { logger } from '../logger';
import { OpenAiNlu } from './openai';
import { RuleBasedNlu } from './rules';
import type { NluProvider } from './types';

export function createNlu(config: Config): NluProvider {
  const rules = new RuleBasedNlu();
  if (!config.openai.apiKey) {
    logger.info('OPENAI_API_KEY not set: using rule-based NLU (demo mode)');
    return rules;
  }
  return new OpenAiNlu(config.openai.apiKey, config.openai.model, rules);
}
