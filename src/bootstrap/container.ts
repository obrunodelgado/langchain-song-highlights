import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { createUseCases } from '../application/useCases.ts';
import { OpenRouterMusicAssistant } from '../infrastructure/ai/OpenRouterMusicAssistant.ts';
import { PostgresUserProfileRepository } from '../infrastructure/persistence/PostgresUserProfileRepository.ts';
import { buildChatGraph } from '../infrastructure/langgraph/graph.ts';
import { createConversationAdapter } from '../infrastructure/langgraph/conversationAdapter.ts';
import { loadConfig, type AppConfig } from './config.ts';

export async function buildApplication(config: AppConfig = loadConfig()) {
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    const profiles = new PostgresUserProfileRepository(pool);
    const checkpointer = new PostgresSaver(pool);
    await profiles.setup();
    await checkpointer.setup();
    const useCases = createUseCases({
      assistant: new OpenRouterMusicAssistant(config.model), profiles,
      maxMessagesToSummary: config.maxMessagesToSummary,
    });
    const graph = buildChatGraph(useCases, checkpointer);
    return { graph, profiles, conversation: createConversationAdapter(graph, useCases), close: () => pool.end() };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

let applicationPromise: ReturnType<typeof buildApplication> | undefined;
export async function graph() {
  applicationPromise ??= buildApplication().catch(error => {
    applicationPromise = undefined;
    throw error;
  });
  return (await applicationPromise).graph;
}
