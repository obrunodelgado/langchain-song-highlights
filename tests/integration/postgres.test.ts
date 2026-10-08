import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage } from '@langchain/core/messages';
import { PostgresUserProfileRepository } from '../../src/infrastructure/persistence/PostgresUserProfileRepository.ts';
import { mergePreferences } from '../../src/domain/profile.ts';
import { createUseCases } from '../../src/application/useCases.ts';
import { buildChatGraph } from '../../src/infrastructure/langgraph/graph.ts';
import { fakeAssistant } from '../helpers/fakes.ts';

test('PostgreSQL: concorrência, rollback, isolamento e recuperação após reabrir conexões', { timeout: 30_000 }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL com um banco exclusivo para testes');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const poolOptions = { connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` };
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool(poolOptions);
    const profiles = new PostgresUserProfileRepository(pool);
    await profiles.setup();
    await Promise.all(['rock', 'jazz', 'pop'].map(genre => profiles.update('ana', current => mergePreferences(current, { name: 'Ana', favoriteGenres: [genre] }))));
    assert.deepEqual((await profiles.findByUserId('ana'))?.favoriteGenres?.sort(), ['jazz', 'pop', 'rock']);
    assert.equal(await profiles.findByUserId('outro'), null);
    await assert.rejects(profiles.update('ana', () => { throw new Error('rollback'); }), /rollback/);
    assert.equal((await profiles.findByUserId('ana'))?.name, 'Ana');
    const saver = new PostgresSaver(pool, undefined, { schema });
    await saver.setup();
    const config = { configurable: { thread_id: 'session' } };
    const assistant = fakeAssistant();
    const graph = buildChatGraph(createUseCases({ profiles, assistant, maxMessagesToSummary: 3 }), saver);
    await graph.invoke({ userId: 'ana', messages: [new HumanMessage('Oi')] }, config);
    await pool.end();
    pool = new Pool(poolOptions);
    const reopened = new PostgresUserProfileRepository(pool);
    assert.equal((await reopened.findByUserId('ana'))?.name, 'Ana');
    const resumed = buildChatGraph(createUseCases({ profiles: reopened, assistant, maxMessagesToSummary: 3 }), new PostgresSaver(pool, undefined, { schema }));
    assert.equal((await resumed.getState(config)).values.messages.length, 2);
    const result = await resumed.invoke({ userId: 'ana', messages: [new HumanMessage('Outra música')] }, config);
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[0].text, 'Outra música');
    assert.equal((await reopened.findByUserId('ana'))?.keyPreferences, 'Gosta de rock');
    assert.equal((await reopened.findByUserId('ana'))?.name, 'Ana');
  } finally {
    await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
