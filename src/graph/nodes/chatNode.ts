import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';
import { ChatResponseSchema, getSystemPrompt, getUserPromptTemplate } from '../../prompts/v1/chatResponse.ts';
import { AIMessage, HumanMessage } from 'langchain';
import { PreferencesService } from '../../services/preferencesService.ts';
import { config } from '../../config.ts';

export function createChatNode(llmClient: OpenRouterService, preferencesService: PreferencesService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    const userId = String(runtime?.context?.userId || state.userId || 'unknown');
    const userContext = state.userContext ?? await preferencesService.getBasicInfo(userId);
    const systemPrompt = getSystemPrompt(userContext);
    
    const conversationHistory = state.messages
    .map(msg => `${HumanMessage.isInstance(msg) ? 'Human' : 'AI'}: ${msg.content}`)
    .join('\n');

    const userMessage = state.messages.at(-1)?.content as string;
    const userPrompt = getUserPromptTemplate(userMessage, conversationHistory);

    const response = await llmClient.generateStructured(
      systemPrompt,
      userPrompt,
      ChatResponseSchema
    );

    if (!response.success || !response.data) {
      console.error('Falha ao gerar resposta estruturada:', response);
      return {
        messages: [new AIMessage('Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.')],
      };
    }

    const result = response.data;

    const totalMessages = state.messages.length
    const needsSummarization = totalMessages >= config.maxMessagesToSummary;

    return {
      messages: [new AIMessage(result.message)],
      extractedPreferences: result.shouldSavePreferences ? result.preferences : undefined,
      needsSummarization,
    };
  }
}
