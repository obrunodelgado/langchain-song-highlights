import type { UserProfile } from '../../src/domain/profile.ts';
import type { UserProfileRepository, MusicAssistant, ChatResponse } from '../../src/application/ports.ts';

export class InMemoryProfiles implements UserProfileRepository {
  readonly data = new Map<string, UserProfile>();
  async findByUserId(userId: string) { return structuredClone(this.data.get(userId) ?? null); }
  async update(userId: string, transform: (profile: UserProfile | null) => UserProfile) {
    this.data.set(userId, structuredClone(transform(await this.findByUserId(userId))));
  }
}

export function fakeAssistant(response: ChatResponse = { message: 'Recomendo uma música!', shouldSavePreferences: false }): MusicAssistant {
  return {
    async respond() { return response; },
    async summarize() { return { keyPreferences: 'Gosta de rock' }; },
  };
}
