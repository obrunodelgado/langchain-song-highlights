export type UserPreferences = {
  name?: string;
  age?: number;
  favoriteGenres?: string[];
  favoriteBands?: string[];
  mood?: string;
  listeningContext?: string;
  additionalInfo?: string;
};

export type ConversationSummary = {
  name?: string;
  age?: number;
  favoriteGenres?: string[];
  favoriteBands?: string[];
  keyPreferences: string;
  importantContext?: string;
};

export type UserProfile = ConversationSummary;

export function mergePreferences(current: UserProfile | null, incoming: UserPreferences): UserProfile {
  const context = [current?.importantContext,
    incoming.mood && `Mood: ${incoming.mood}`,
    incoming.listeningContext && `Context: ${incoming.listeningContext}`,
    incoming.additionalInfo].filter(Boolean);
  return {
    name: incoming.name || current?.name,
    age: incoming.age ?? current?.age,
    favoriteGenres: [...new Set([...(current?.favoriteGenres ?? []), ...(incoming.favoriteGenres ?? [])])],
    favoriteBands: [...new Set([...(current?.favoriteBands ?? []), ...(incoming.favoriteBands ?? [])])],
    keyPreferences: current?.keyPreferences ?? '',
    importantContext: context.length ? [...new Set(context)].join('. ') : undefined,
  };
}

export function mergeSummary(current: UserProfile | null, summary: ConversationSummary): UserProfile {
  const combined = mergePreferences(current, summary);
  return {
    ...combined,
    keyPreferences: summary.keyPreferences || combined.keyPreferences,
    importantContext: summary.importantContext || combined.importantContext,
  };
}

export function describeProfile(profile: UserProfile | null): string | undefined {
  if (!profile) return undefined;
  const parts = [
    profile.name && `Nome: ${profile.name}`,
    profile.age !== undefined && `Idade: ${profile.age}`,
    profile.favoriteGenres?.length && `Gêneros Favoritos: ${profile.favoriteGenres.join(', ')}`,
    profile.favoriteBands?.length && `Artistas/Bandas Favoritas: ${profile.favoriteBands.join(', ')}`,
    profile.keyPreferences && `Preferências: ${profile.keyPreferences}`,
    profile.importantContext && `Contexto: ${profile.importantContext}`,
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
}
