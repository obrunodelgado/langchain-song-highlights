import { HumanMessage } from '@langchain/core/messages';
import type { Conversation, ConversationSession } from '../../application/ports.ts';
import type { UseCases } from '../../application/useCases.ts';
import type { buildChatGraph } from './graph.ts';

export function createConversationAdapter(graph: ReturnType<typeof buildChatGraph>, useCases: UseCases): Conversation {
  async function send(session: ConversationSession, text: string): Promise<string> {
    const result = await graph.invoke({ messages: [new HumanMessage(text)], userId: session.userId }, {
      configurable: { thread_id: session.threadId },
    });
    return result.messages.at(-1)?.text ?? '';
  }
  return {
    send,
    async greet(session) {
      const context = await useCases.getUserContext(session.userId);
      return send(session, context
        ? 'Inicie a conversa de forma casual mencionando o que você sabe sobre mim e recomende uma música!'
        : 'Olá! Me apresente de forma amigável e pergunte sobre meu nome e preferências musicais.');
    },
  };
}
