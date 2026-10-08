import { StateGraph, START, END, MessagesZodMeta, type BaseCheckpointSaver } from '@langchain/langgraph';
import { withLangGraph } from '@langchain/langgraph/zod';
import { AIMessage, HumanMessage, RemoveMessage, type BaseMessage } from '@langchain/core/messages';
import { z } from 'zod/v3';
import type { UseCases } from '../../application/useCases.ts';
import type { Message } from '../../application/ports.ts';
import type { ConversationSummary, UserPreferences } from '../../domain/profile.ts';

const State = z.object({
  messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
  userId: z.string(),
  extractedPreferences: z.custom<UserPreferences>().optional(),
  needsSummarization: z.boolean().optional(),
  conversationSummary: z.custom<ConversationSummary>().optional(),
});

export type GraphState = z.infer<typeof State>;
const messagesFrom = (state: GraphState): Message[] => state.messages
  .filter(m => HumanMessage.isInstance(m) || AIMessage.isInstance(m))
  .map(m => ({ role: HumanMessage.isInstance(m) ? 'user' : 'assistant', content: m.text }));

export function buildChatGraph(useCases: UseCases, checkpointer?: BaseCheckpointSaver) {
  return new StateGraph(State)
    .addNode('chat', async (state): Promise<Partial<GraphState>> => {
      const result = await useCases.respondToMessage(state.userId, messagesFrom(state));
      return {
        messages: [new AIMessage(result.message)],
        extractedPreferences: result.extractedPreferences,
        needsSummarization: result.needsSummarization,
      };
    })
    .addNode('savePreferences', async (state): Promise<Partial<GraphState>> => {
      if (state.extractedPreferences) await useCases.savePreferences(state.userId, state.extractedPreferences);
      return { extractedPreferences: undefined };
    })
    .addNode('summarize', async (state): Promise<Partial<GraphState>> => {
      const summary = await useCases.summarizeConversation(state.userId, messagesFrom(state), state.conversationSummary);
      return {
        conversationSummary: summary,
        needsSummarization: false,
        messages: state.messages.slice(0, -2).map(m => {
          if (!m.id) throw new Error('Cannot remove a conversation message without an id');
          return new RemoveMessage({ id: m.id });
        }),
      };
    })
    .addEdge(START, 'chat')
    .addConditionalEdges('chat', state => state.extractedPreferences ? 'savePreferences' : state.needsSummarization ? 'summarize' : 'end',
      { savePreferences: 'savePreferences', summarize: 'summarize', end: END })
    .addConditionalEdges('savePreferences', state => state.needsSummarization ? 'summarize' : 'end',
      { summarize: 'summarize', end: END })
    .addEdge('summarize', END)
    .compile({ checkpointer });
}
