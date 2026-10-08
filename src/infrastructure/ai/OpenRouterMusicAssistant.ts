import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent, providerStrategy } from 'langchain';
import type { z } from 'zod/v3';
import type { Message, MusicAssistant } from '../../application/ports.ts';
import type { ConversationSummary } from '../../domain/profile.ts';
import { ChatResponseSchema, getSystemPrompt, getUserPromptTemplate } from './prompts/v1/chatResponse.ts';
import { SummarySchema, getSummarizationSystemPrompt, getSummarizationUserPrompt } from './prompts/v1/summarization.ts';

export type OpenRouterOptions = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;
  models: string[];
  temperature: number;
  provider: { sort: { by: string; partition: string } };
};

export class OpenRouterMusicAssistant implements MusicAssistant {
  private readonly model: ChatOpenAI;

  constructor(options: OpenRouterOptions) {
    this.model = new ChatOpenAI({
      apiKey: options.apiKey,
      modelName: options.models[0],
      temperature: options.temperature,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': options.httpReferer, 'X-Title': options.xTitle },
      },
      modelKwargs: { models: options.models.slice(1), provider: options.provider },
    });
  }

  async respond(messages: Message[], userContext?: string) {
    const history = messages.map(m => `${m.role === 'user' ? 'Human' : 'AI'}: ${m.content}`).join('\n');
    return this.generate(getSystemPrompt(userContext), getUserPromptTemplate(messages.at(-1)?.content ?? '', history), ChatResponseSchema);
  }

  async summarize(messages: Message[], previousSummary?: ConversationSummary) {
    const history = messages.map(m => ({ role: m.role === 'user' ? 'User' : 'AI', content: m.content }));
    return this.generate(getSummarizationSystemPrompt(), getSummarizationUserPrompt(history, previousSummary), SummarySchema);
  }

  private async generate<T>(systemPrompt: string, userPrompt: string, schema: z.ZodSchema<T>): Promise<T> {
    const agent = createAgent({ model: this.model, tools: [], responseFormat: providerStrategy(schema) });
    const result = await agent.invoke({ messages: [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)] });
    return schema.parse(result.structuredResponse);
  }
}
