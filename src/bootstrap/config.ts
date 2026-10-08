import type { OpenRouterOptions } from '../infrastructure/ai/OpenRouterMusicAssistant.ts';

export type AppConfig = { databaseUrl: string; maxMessagesToSummary: number; model: OpenRouterOptions };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const maxMessagesToSummary = Number(env.MAX_MESSAGES_TO_SUMMARY ?? 3);
  if (!Number.isInteger(maxMessagesToSummary) || maxMessagesToSummary < 1) {
    throw new Error('MAX_MESSAGES_TO_SUMMARY must be a positive integer');
  }
  return {
    databaseUrl: env.DATABASE_URL,
    maxMessagesToSummary,
    model: {
      apiKey: env.OPENROUTER_API_KEY,
      httpReferer: env.OPENROUTER_HTTP_REFERER ?? '',
      xTitle: env.OPENROUTER_X_TITLE ?? 'Song-Recommender',
      models: ['apodex/apodex-1.1-mini:free', 'dots-studio/dots-3-note-preview:free', 'nvidia/nemotron-3-super-120b-a12b:free'],
      temperature: 0.7,
      provider: { sort: { by: 'throughput', partition: 'none' } },
    },
  };
}
