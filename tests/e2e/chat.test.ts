import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { buildApplication } from '../../src/bootstrap/container.ts';
import { loadConfig } from '../../src/bootstrap/config.ts';

test('OpenRouter real extrai preferências e persiste no PostgreSQL', { timeout: 120_000 }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL com um banco exclusivo para testes');
  const userId = `e2e-${randomUUID()}`;
  const config = loadConfig({ ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, MAX_MESSAGES_TO_SUMMARY: '100' });
  const app = await buildApplication(config);
  try {
    const reply = await app.conversation.send({ userId, threadId: userId }, 'Meu nome é Alex, tenho 28 anos e gosto de rock e jazz. Recomende uma música.');
    assert.ok(reply.trim());
    const profile = await app.profiles.findByUserId(userId);
    assert.ok(profile, 'O modelo deve extrair preferências');
    assert.match(profile.name ?? '', /alex/i);
    assert.equal(profile.age, 28);
    assert.ok(profile.favoriteGenres?.some(genre => /rock|jazz/i.test(genre)));
  } finally {
    await app.close();
    const pool = new Pool({ connectionString: config.databaseUrl });
    try {
      await pool.query('DELETE FROM song_user_profiles WHERE user_id = $1', [userId]);
      await new PostgresSaver(pool).deleteThread(userId);
    } finally {
      await pool.end();
    }
  }
});
