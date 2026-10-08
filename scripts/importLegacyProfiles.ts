import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { z } from 'zod/v3';
import { PostgresUserProfileRepository } from '../src/infrastructure/persistence/PostgresUserProfileRepository.ts';
import { SummarySchema } from '../src/infrastructure/ai/prompts/v1/summarization.ts';

const backupSchema = z.array(z.object({ userId: z.string().min(1), profile: SummarySchema }));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const path = process.argv[2] ?? '.local-backups/preferences.json';
  // Validate the whole backup before performing any database writes.
  const records = backupSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const repository = new PostgresUserProfileRepository(pool);
    await repository.setup();
    let imported = 0;
    for (const record of records) {
      await repository.update(record.userId, current => {
        if (current) return current;
        imported++;
        return record.profile;
      });
    }
    console.log(`Importados: ${imported}. Perfis já existentes preservados: ${records.length - imported}.`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Falha ao importar perfis:', error instanceof Error ? error.message : 'Erro desconhecido');
  process.exitCode = 1;
});
