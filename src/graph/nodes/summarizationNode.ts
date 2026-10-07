import { AIMessage, HumanMessage, RemoveMessage } from '@langchain/core/messages';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';
import { type ConversationSummary, getSummarizationSystemPrompt, getSummarizationUserPrompt, SummarySchema } from '../../prompts/v1/summarization.ts';
import { type Runtime } from '@langchain/langgraph';
import { PreferencesService } from '../../services/preferencesService.ts';

export function createSummarizationNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
    return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
        const conversationHistory = state.messages.map(msg => ({
            role: HumanMessage.isInstance(msg) ? 'User' : 'AI',
            content: msg.text
        }));
        const previousSummary = state.conversationSummary as ConversationSummary | undefined;
        const userPrompt = getSummarizationUserPrompt(conversationHistory, previousSummary);
        const systemPrompt = getSummarizationSystemPrompt();
        
        const result = await llmClient.generateStructured(
            systemPrompt,
            userPrompt,
            SummarySchema
        );

        if (result.error || !result.success || !result.data) {
            console.error('Failed to generate structured summary:', result);
            return {
                messages: [new AIMessage('Sorry, there was an error summarizing the conversation. Please try again later.')],
            };
        }

        const userId = String(runtime?.context?.userId || state.userId || 'unknown');
        
        await preferencesService.storeSummary(userId, result.data);
        const deleteOldMessages = state.messages
            .slice(0, -2)
            .map(m => new RemoveMessage({ id: m.id as string }));
        
        return {
          messages: deleteOldMessages,
          conversationSummary: result.data,
          needsSummarization: false,
        };
    };
}
