import { describeProfile, mergePreferences, mergeSummary } from '../domain/profile.ts';
import type { ConversationSummary, UserPreferences } from '../domain/profile.ts';
import type { Message, MusicAssistant, UserProfileRepository } from './ports.ts';

export function createUseCases(deps: {
  assistant: MusicAssistant;
  profiles: UserProfileRepository;
  maxMessagesToSummary: number;
}) {
  if (!Number.isInteger(deps.maxMessagesToSummary) || deps.maxMessagesToSummary < 1) {
    throw new Error('maxMessagesToSummary must be a positive integer');
  }
  const getUserContext = async (userId: string) => describeProfile(await deps.profiles.findByUserId(userId));
  return {
    getUserContext,
    async respondToMessage(userId: string, messages: Message[]) {
      const result = await deps.assistant.respond(messages, await getUserContext(userId));
      return {
        message: result.message,
        extractedPreferences: result.shouldSavePreferences ? result.preferences : undefined,
        needsSummarization: messages.length >= deps.maxMessagesToSummary,
      };
    },
    async savePreferences(userId: string, preferences: UserPreferences) {
      await deps.profiles.update(userId, current => mergePreferences(current, preferences));
    },
    async summarizeConversation(userId: string, messages: Message[], previousSummary?: ConversationSummary) {
      const previous = previousSummary ?? await deps.profiles.findByUserId(userId) ?? undefined;
      const summary = await deps.assistant.summarize(messages, previous);
      await deps.profiles.update(userId, current => mergeSummary(current, summary));
      return summary;
    },
  };
}

export type UseCases = ReturnType<typeof createUseCases>;
