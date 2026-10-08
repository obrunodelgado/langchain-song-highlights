import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

test('dependências do núcleo apontam somente para camadas internas', async () => {
  const root = resolve('src');
  for (const layer of ['domain', 'application', 'presentation']) {
    const files = await readdir(resolve(root, layer), { recursive: true });
    for (const file of files.filter(f => f.endsWith('.ts'))) {
      const path = resolve(root, layer, file);
      const content = await readFile(path, 'utf8');
      for (const match of content.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)) {
        const specifier = match[2];
        if (layer === 'presentation' && specifier.startsWith('node:')) continue;
        assert.ok(specifier.startsWith('.'), `${path}: dependência externa ${specifier}`);
        const target = relative(root, resolve(dirname(path), specifier)).split('/')[0];
        const allowed = layer === 'domain' ? ['domain'] : layer === 'application' ? ['domain', 'application'] : ['domain', 'application', 'presentation'];
        assert.ok(allowed.includes(target), `${layer} não pode importar ${target}`);
      }
    }
  }
});
