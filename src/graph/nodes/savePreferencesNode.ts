import type { Runtime } from '@langchain/langgraph';
import type { GraphState } from '../graph.ts';
import { PreferencesService } from '../../services/preferencesService.ts';

export function createSavePreferencesNode(preferencesService: PreferencesService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    if (!state.extractedPreferences) {
      console.info('No extracted preferences found in state. Skipping savePreferencesNode.');
      return {};
    }

    const userId = String(runtime?.context?.userId || state.userId || 'unknown');
    await preferencesService.mergePreferences(userId, state.extractedPreferences);

    console.info(`Preferences for user ${userId} have been saved successfully.`);

    return {
      extractedPreferences: undefined, // Clear extracted preferences after saving
    };
  };
}
