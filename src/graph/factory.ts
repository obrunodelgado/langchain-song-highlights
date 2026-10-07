import { OpenRouterService } from '../services/openrouterService.ts';
import { config } from '../config.ts';
import { buildChatGraph } from './graph.ts';
import { createMemoryService } from '../services/memoryService.ts';
import { PreferencesService } from '../services/preferencesService.ts';

let graphPromise: ReturnType<typeof buildGraph> | undefined;

export const graph = async () => {
  if (!graphPromise) {
    graphPromise = buildGraph();
  }
  return graphPromise;
}

export async function buildGraph(dbPath: string = './preferences.db') {
  const llmClient = new OpenRouterService(config);
  const preferencesService = await new PreferencesService(dbPath);
  const memoryService = await createMemoryService();

  const graph = buildChatGraph(
    llmClient,
    preferencesService,
    memoryService
  );

  return {
    graph,
    preferencesService,
    memoryService
  };
}

export default graph;
