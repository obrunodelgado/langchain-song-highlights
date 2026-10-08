import type { ConversationSummary, UserPreferences, UserProfile } from '../domain/profile.ts';

export type Message = { role: 'user' | 'assistant'; content: string };
export type ChatResponse = { message: string; shouldSavePreferences: boolean; preferences?: UserPreferences };

export interface MusicAssistant {
  respond(messages: Message[], userContext?: string): Promise<ChatResponse>;
  summarize(messages: Message[], previousSummary?: ConversationSummary): Promise<ConversationSummary>;
}

export interface UserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  // The adapter serializes concurrent updates for the same user.
  update(userId: string, transform: (current: UserProfile | null) => UserProfile): Promise<void>;
}

export type ConversationSession = { userId: string; threadId: string };
export interface Conversation {
  greet(session: ConversationSession): Promise<string>;
  send(session: ConversationSession, text: string): Promise<string>;
}
