import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePreferences, mergeSummary, describeProfile } from '../../src/domain/profile.ts';

test('combina preferências sem duplicar nem apagar informações não mencionadas', () => {
  const original = { name: 'Ana', age: 28, favoriteGenres: ['rock'], favoriteBands: ['Muse'], keyPreferences: 'Músicas animadas' };
  const result = mergePreferences(original, { favoriteGenres: ['rock', 'jazz'], mood: 'feliz' });
  assert.deepEqual(result.favoriteGenres, ['rock', 'jazz']);
  assert.deepEqual(result.favoriteBands, ['Muse']);
  assert.equal(result.name, 'Ana');
  assert.equal(result.age, 28);
  assert.equal(result.keyPreferences, original.keyPreferences);
  assert.equal(result.importantContext, 'Mood: feliz');
  assert.deepEqual(original.favoriteGenres, ['rock']);
});

test('resumo parcial preserva nome e gêneros anteriores', () => {
  const result = mergeSummary({ name: 'Ana', favoriteGenres: ['rock'], keyPreferences: 'Antigo' }, { keyPreferences: 'Novo' });
  assert.equal(result.name, 'Ana');
  assert.deepEqual(result.favoriteGenres, ['rock']);
  assert.equal(result.keyPreferences, 'Novo');
  assert.match(describeProfile(result)!, /Ana/);
  assert.equal(describeProfile(null), undefined);
});
