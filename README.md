# Recomendador de músicas com memória

Projeto de estudo do curso de Engenharia de Software com IA Aplicada da UNIPDS. Recomenda músicas, extrai preferências e resume conversas usando LangGraph e OpenRouter, com **Onion Architecture e persistência exclusivamente no PostgreSQL**.

## Executar

Requisitos: Node.js **>= 24.10.0**, npm, Docker com Compose e uma chave OpenRouter.

```bash
npm install
cp .env.example .env
```

Preencha `OPENROUTER_API_KEY` e `DATABASE_URL` no `.env`. O exemplo de conexão corresponde ao PostgreSQL do Compose. Para rastreamento, configure a chave LangSmith; caso contrário, defina `LANGCHAIN_TRACING_V2=false`.

```bash
npm run docker:up
npm run chat:ana
```

Aguarde o PostgreSQL ficar disponível antes de iniciar o chat. As tabelas de perfis e checkpoints são criadas na inicialização. O Compose usa a porta `5432`, o banco `song_recommender` e o volume local `dbdata/`.

Também é possível usar `npm run chat:erickwendel` ou informar outro usuário:

```bash
node --experimental-strip-types --env-file .env src/index.ts --user bruno
```

Reutilize o mesmo `--user` para continuar a conversa e recuperar preferências. Sem esse argumento, cada execução cria um identificador novo. Digite `exit` para sair. As conexões com o banco são encerradas ao terminar a CLI.

Os modelos, o roteamento e a temperatura ficam em [src/bootstrap/config.ts](src/bootstrap/config.ts). `DATABASE_URL`, `MAX_MESSAGES_TO_SUMMARY`, `OPENROUTER_HTTP_REFERER` e `OPENROUTER_X_TITLE` são lidos do ambiente. Não há configuração de banco no domínio ou na aplicação.

## Arquitetura Onion

As dependências de código apontam para dentro. O domínio não importa bibliotecas; a aplicação depende do domínio e define contratos para os serviços externos. A infraestrutura implementa esses contratos e o bootstrap conecta as implementações.

```text
src/
  domain/
    profile.ts                     # Tipos e regras puras de combinação de preferências
  application/
    ports.ts                       # Contratos de IA, repositório e conversa
    useCases.ts                    # Responder, salvar, resumir e recuperar contexto
  infrastructure/
    ai/
      OpenRouterMusicAssistant.ts  # Chamadas ao modelo e validação das respostas
      prompts/v1/                  # Prompts e schemas do provedor
    persistence/
      PostgresUserProfileRepository.ts
    langgraph/
      graph.ts                     # Estado, nós, rotas e redução do histórico
      conversationAdapter.ts       # Traduz a interface de conversa para o grafo
  presentation/
    cli.ts                         # Entrada e saída do terminal, sem SDKs de IA
  bootstrap/
    config.ts                      # Configuração externa
    container.ts                   # Injeção de dependências e ciclo de vida
  index.ts                         # Entrada da CLI
```

- **Domínio:** `mergePreferences`, `mergeSummary` e `describeProfile` trabalham somente com valores. Preferências novas se combinam às existentes; informações ausentes em um resumo não apagam nome, idade, gêneros ou artistas conhecidos.
- **Aplicação:** os casos de uso dependem de `MusicAssistant` e `UserProfileRepository`. Recebem mensagens próprias, sem `BaseMessage`, SQL ou schemas Zod.
- **Infraestrutura:** o adaptador OpenRouter monta prompts e valida saídas; o repositório PostgreSQL executa SQL parametrizado; o LangGraph converte mensagens, coordena os nós e administra checkpoints.
- **Apresentação:** a CLI depende do contrato `Conversation`, implementado pelo adaptador do grafo.
- **Bootstrap:** cria um pool PostgreSQL compartilhado pelo repositório e pelo checkpointer, injeta dependências e expõe o fechamento das conexões. A função `graph()` entrega o grafo compilado ao servidor de desenvolvimento e permite uma nova tentativa se a inicialização falhar.

## Fluxo e persistência

O nó `chat` chama o caso de uso de resposta e recupera o perfil atualizado do usuário. Se houver preferências novas, passa por `savePreferences`. Se o histórico atingir `MAX_MESSAGES_TO_SUMMARY`, passa por `summarize`. Quando ambas as condições são verdadeiras, salva as preferências antes de resumir.

O limite considera as mensagens recebidas pelo nó de chat, antes de acrescentar sua resposta. Após gerar e persistir um resumo, o grafo mantém as duas mensagens mais recentes. Falhas de IA ou banco propagam para a CLI, que informa o erro; uma falha no resumo não descarta o histórico.

| Dados | Persistência |
|---|---|
| Perfil musical e resumo por `userId` | Tabela `song_user_profiles`, coluna JSONB |
| Histórico e estado do grafo por `thread_id` | Tabelas gerenciadas por `PostgresSaver` |

O repositório usa transação e trava por usuário ao combinar dados, evitando perda de preferências em atualizações simultâneas. A gravação do perfil e o checkpoint do grafo são operações separadas, não uma transação única.

`userId` identifica o perfil; `threadId` identifica a conversa. A CLI mantém a convenção anterior `user-<nome>` para ambos. Outros adaptadores podem abrir threads distintas para um mesmo usuário. Não há embeddings, busca vetorial ou `PostgresStore` neste fluxo.

## Dados anteriores

O SQLite e suas dependências foram removidos. Nesta conversão, os dados do arquivo anterior foram exportados para `.local-backups/preferences.json` e importados no PostgreSQL local. O backup contém dados de usuário e está ignorado pelo Git.

Para importar esse backup em outro banco, configure `DATABASE_URL` e execute:

```bash
npm run import:legacy
# Ou informe outro arquivo no mesmo formato:
npm run import:legacy -- /caminho/preferences.json
```

Formato: uma lista de objetos `{ "userId": "user-ana", "profile": { "name": "Ana", "keyPreferences": "Gosta de rock" } }`. O script valida o arquivo inteiro antes de gravar e preserva perfis já existentes. Pode ser reexecutado após uma interrupção. Não precisa de SQLite nem de chave de IA.

## Desenvolvimento e testes

```bash
npm run typecheck
npm test
npm run langgraph:serve
```

`npm test` executa testes determinísticos de regras, limites entre camadas e fluxo real do LangGraph com IA e persistência em memória. Não precisa de `.env`, banco ou chave de API. `langgraph.json` aponta para `src/bootstrap/container.ts:graph`.

Os testes de integração usam PostgreSQL real e IA simulada. Crie um banco exclusivo para testes e configure `TEST_DATABASE_URL` no `.env`, seguindo o exemplo comentado em `.env.example`:

```bash
docker exec postgres createdb -U postgres song_recommender_test
npm run test:integration
```

O teste cria e remove um schema próprio, verificando concorrência, rollback, isolamento de usuários e recuperação de perfis/checkpoints após reabrir conexões. Se o banco já existir, pule `createdb`.

```bash
npm run test:e2e
```

O E2E usa `TEST_DATABASE_URL` e faz uma chamada **real** ao OpenRouter com a chave do `.env`; pode consumir créditos. Confirma extração e persistência do perfil e remove os dados de teste ao terminar. O resultado depende da disponibilidade e da resposta do modelo.

Para acompanhar ou encerrar o banco:

```bash
npm run docker:logs
npm run docker:down
```

Licença: MIT.
