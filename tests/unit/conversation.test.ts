import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { createUseCases } from '../../src/application/useCases.ts';
import { buildChatGraph } from '../../src/infrastructure/langgraph/graph.ts';
import { createConversationAdapter } from '../../src/infrastructure/langgraph/conversationAdapter.ts';
import { InMemoryProfiles, fakeAssistant } from '../helpers/fakes.ts';

for (const save of [false, true]) {
  for (const summarize of [false, true]) {
    test(`grafo: salvar=${save}, resumir=${summarize}`, async () => {
      const profiles = new InMemoryProfiles();
      const assistant = fakeAssistant({ message: 'Olá Ana', shouldSavePreferences: save, preferences: { name: 'Ana', favoriteGenres: ['rock'] } });
      const events: string[] = [];
      assistant.summarize = async () => {
        if (save) assert.equal((await profiles.findByUserId('ana'))?.name, 'Ana');
        events.push('summary');
        return { keyPreferences: 'Gosta de rock' };
      };
      const useCases = createUseCases({ profiles, assistant, maxMessagesToSummary: summarize ? 1 : 100 });
      const graph = buildChatGraph(useCases, new MemorySaver());
      const state = await graph.invoke({ userId: 'ana', messages: [new HumanMessage('Oi')] }, { configurable: { thread_id: 'ana' } });
      assert.equal(state.messages.at(-1)?.text, 'Olá Ana');
      assert.equal(state.extractedPreferences, undefined);
      assert.equal(events.length, summarize ? 1 : 0);
      assert.equal((await profiles.findByUserId('ana'))?.name, save ? 'Ana' : undefined);
      if (!save && !summarize) assert.equal(await profiles.findByUserId('ana'), null);
    });
  }
}

test('resumo remove mensagens antigas e recupera perfil em outra thread do mesmo usuário', async () => {
  const profiles = new InMemoryProfiles();
  const contexts: Array<string | undefined> = [];
  const assistant = fakeAssistant();
  assistant.respond = async (_messages, context) => {
    contexts.push(context);
    return { message: 'Resposta', shouldSavePreferences: true, preferences: { name: 'Ana' } };
  };
  const useCases = createUseCases({ profiles, assistant, maxMessagesToSummary: 3 });
  const graph = buildChatGraph(useCases, new MemorySaver());
  const conversation = createConversationAdapter(graph, useCases);
  const session = { userId: 'ana', threadId: 'thread-1' };
  await conversation.send(session, 'Sou Ana');
  await conversation.send(session, 'Quero rock');
  const state = await graph.getState({ configurable: { thread_id: session.threadId } });
  assert.equal(state.values.messages.length, 2);
  assert.equal(state.values.messages[0].text, 'Quero rock');
  assert.equal(state.values.conversationSummary.keyPreferences, 'Gosta de rock');
  await conversation.greet({ userId: 'ana', threadId: 'thread-2' });
  assert.match(contexts.at(-1)!, /Ana/);
  assert.match(contexts.at(-1)!, /Gosta de rock/);
  await conversation.send({ userId: 'outro', threadId: 'thread-3' }, 'Oi');
  assert.equal(contexts.at(-1), undefined);
});

test('falha de resumo não descarta histórico nem altera o perfil', async () => {
  const profiles = new InMemoryProfiles();
  const assistant = fakeAssistant();
  assistant.summarize = async () => { throw new Error('Modelo indisponível'); };
  const graph = buildChatGraph(createUseCases({ profiles, assistant, maxMessagesToSummary: 3 }), new MemorySaver());
  const config = { configurable: { thread_id: 'failure' } };
  await graph.invoke({ userId: 'ana', messages: [new HumanMessage('Oi')] }, config);
  await assert.rejects(graph.invoke({ userId: 'ana', messages: [new HumanMessage('Mais')] }, config), /Modelo indisponível/);
  const state = await graph.getState(config);
  assert.equal(state.values.messages.length, 4);
  assert.equal(await profiles.findByUserId('ana'), null);
});

test('falha de resposta não salva preferências', async () => {
  const profiles = new InMemoryProfiles();
  const assistant = fakeAssistant();
  assistant.respond = async () => { throw new Error('Sem resposta'); };
  const graph = buildChatGraph(createUseCases({ profiles, assistant, maxMessagesToSummary: 3 }));
  await assert.rejects(graph.invoke({ userId: 'ana', messages: [new HumanMessage('Oi')] }), /Sem resposta/);
  assert.equal(await profiles.findByUserId('ana'), null);
});
