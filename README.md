# Recomendador de músicas com memória

Projeto de estudo do curso de Engenharia de Software com IA Aplicada da UNIPDS. Usa LangGraph e OpenRouter para recomendar músicas, extrair preferências e resumir conversas.

## Como funciona

O nó `chat` gera uma resposta estruturada e decide se há preferências para salvar ou histórico para resumir. Quando necessário, executa `savePreferences`, `summarize` ou ambos, nessa ordem.

- **PostgreSQL:** persiste o estado da conversa por `thread_id` com `PostgresSaver`; também fornece o `PostgresStore` ao grafo.
- **SQLite (`preferences.db`):** armazena preferências e resumos por usuário, usando Knex e `better-sqlite3`.
- **Resumo:** ao atingir o limite definido em `maxMessagesToSummary`, salva um resumo e mantém as duas mensagens mais recentes no estado.

As preferências são armazenadas em tabelas, sem embeddings ou busca vetorial. A função exportada `graph()` reutiliza a mesma promessa de construção do grafo; a CLI chama `buildGraph()` uma vez ao iniciar.

## Executar

Requisitos: Node.js **>= 24.10.0**, npm, Docker com Compose e uma chave OpenRouter.

```bash
npm install
cp .env.example .env
```

Preencha `OPENROUTER_API_KEY` no `.env`. Para usar rastreamento, configure também a chave LangSmith; caso contrário, defina `LANGCHAIN_TRACING_V2=false`.

Os modelos, o roteamento de provedores, a temperatura, a conexão PostgreSQL e o limite de mensagens ficam em [src/config.ts](src/config.ts). Os campos `httpReferer` e `xTitle` também são definidos nesse arquivo; as variáveis correspondentes do `.env.example` não são lidas atualmente.

```bash
npm run docker:up
npm run chat:ana
```

Aguarde o PostgreSQL ficar disponível antes de iniciar o chat. O Compose usa a porta `5432`, o banco `song_recommender` e persiste os dados em `dbdata/`.

Também é possível usar `npm run chat:erickwendel` ou informar outro usuário:

```bash
node --experimental-strip-types --env-file .env src/index.ts --user bruno
```

Reutilize o mesmo `--user` para continuar a conversa e recuperar preferências. Sem esse argumento, cada execução cria um novo identificador. Digite `exit` para sair.

Para acompanhar ou encerrar o banco:

```bash
npm run docker:logs
npm run docker:down
```

## Estrutura

```text
src/
  config.ts                 # Configuração do modelo e da memória
  index.ts                  # Chat no terminal
  graph/
    factory.ts              # Construção e instância reutilizável
    graph.ts                # Estado, nós e rotas
    nodes/                  # Chat, preferências e resumo
  services/                 # OpenRouter, PostgreSQL e SQLite
  prompts/v1/               # Prompts e schemas de respostas
tests/chat.e2e.test.ts      # Testes com serviços reais
langgraph.json              # Entrada do grafo para o servidor de desenvolvimento
```

## Desenvolvimento e testes

```bash
npm run langgraph:serve
npm test
```

Os testes usam PostgreSQL e chamadas reais ao OpenRouter. Podem consumir créditos e gravar dados nos bancos configurados. Parte das verificações ainda consulta preferências no `PostgresStore`, embora a implementação atual as salve no SQLite; esses testes precisam ser alinhados ao código.

Licença: MIT.
