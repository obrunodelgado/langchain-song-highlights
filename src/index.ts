import { buildApplication } from './bootstrap/container.ts';
import { runCli } from './presentation/cli.ts';

async function main(): Promise<void> {
  const application = await buildApplication();
  try {
    await runCli(application.conversation);
  } finally {
    await application.close();
  }
}

main().catch(error => {
  console.error('Erro fatal:', error instanceof Error ? error.message : 'Erro desconhecido');
  process.exitCode = 1;
});
