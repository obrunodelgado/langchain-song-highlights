import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomUUID } from 'node:crypto';
import type { Conversation } from '../application/ports.ts';

export async function runCli(conversation: Conversation, args: string[] = process.argv.slice(2)): Promise<void> {
  const userIndex = args.indexOf('--user');
  const user = userIndex === -1 ? undefined : args[userIndex + 1];
  if (userIndex !== -1 && (!user || user.startsWith('--'))) throw new Error('Informe um nome após --user');
  const userId = user ? `user-${user}` : `user-${randomUUID()}`;
  const session = { userId, threadId: userId };
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    console.log('🎵 Recomendador de Músicas com Memória');
    console.log('Digite suas mensagens abaixo. Digite "exit" para sair.');
    console.log(`📝 ID da Sessão: ${session.threadId}\n`);
    try {
      console.log(`AI: ${await conversation.greet(session)}\n`);
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error instanceof Error ? error.message : 'Erro desconhecido');
    }
    while (true) {
      let input: string;
      try {
        input = (await readline.question('Você: ')).trim();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') break;
        throw error;
      }
      if (!input) continue;
      if (input.toLowerCase() === 'exit') break;
      try {
        console.log(`\nAI: ${await conversation.send(session, input)}\n`);
      } catch (error) {
        console.error('Erro ao gerar resposta:', error instanceof Error ? error.message : 'Erro desconhecido');
      }
    }
  } finally {
    readline.close();
  }
}
