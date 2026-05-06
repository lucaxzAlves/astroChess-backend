# Aura Chess Backend

Backend Node.js com TypeScript e Express para um SaaS de analise de partidas de xadrez.

## Requisitos

- Node.js 20+
- npm

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

3. Configure o caminho do Stockfish no `.env`.

O projeto usa o binario local/oficial do Stockfish via `child_process`, sem pacote npm de Stockfish.

No Linux/Ubuntu, instale com:

```bash
sudo apt update
sudo apt install stockfish
```

Depois verifique o caminho do binario:

```bash
which stockfish
```

Coloque o valor retornado no `.env`:

```env
STOCKFISH_PATH=/caminho/retornado/pelo/which
```

Exemplo comum:

```env
STOCKFISH_PATH=/usr/games/stockfish
```

Se `STOCKFISH_PATH` nao estiver definido, o cliente do Stockfish retorna um erro claro informando que o caminho precisa ser configurado.

4. Rode em desenvolvimento:

```bash
npm run dev
```

5. Acesse o health check:

```bash
curl http://localhost:3333/health
```

6. Envie uma partida para analise:

```bash
curl -X POST http://localhost:3333/analysis/pgn \
  -H "Content-Type: application/json" \
  -d '{
    "games": [
      {
        "id": "game-1",
        "pgn": "1. e4 e5 2. Nf3 Nc6 *",
        "metadata": {
          "white": "PlayerWhite",
          "black": "PlayerBlack",
          "result": "*",
          "site": "Lichess",
          "date": "2026.04.29"
        }
      }
    ]
  }'
```

## Scripts

- `npm run dev`: inicia o servidor em desenvolvimento com reload via `tsx`.
- `npm run build`: compila TypeScript para JavaScript em `dist/`.
- `npm start`: executa a versao compilada em `dist/server.js`.
- `npm run lint`: executa ESLint nos arquivos TypeScript.
- `npm run format`: formata o projeto com Prettier.
- `npm run format:check`: verifica formatacao com Prettier.

## Estrutura

```text
src/
  app.ts
  server.ts
  chess/
    game-analyzer.ts
    move-classifier.ts
    pgn-annotator.ts
    pgn.parser.ts
  config/
  controllers/
  engine/
    evaluation.parser.ts
    stockfish.client.ts
    stockfish.types.ts
  middlewares/
  modules/
    analysis/
      analysis.controller.ts
      analysis-depth.strategy.ts
      analysis.routes.ts
      analysis.service.ts
      analysis.types.ts
  routes/
  services/
  utils/
  types/
```

No momento, o projeto nao configura banco de dados nem autenticacao.

## Stockfish

O `StockfishClient` fica em `src/engine/stockfish.client.ts` e recebe o caminho do binario por configuracao, sem caminho hardcoded. A configuracao e lida em `src/config/env.ts`.

Essa separacao deixa o backend preparado para substituir o binario local por outra implementacao no futuro, como Docker, fila ou worker externo, mantendo o restante da aplicacao dependente de uma interface de engine.

Variaveis usadas:

```env
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
STOCKFISH_PATH=/usr/games/stockfish
STOCKFISH_TIMEOUT_MS=15000
STOCKFISH_FAST_MOVETIME_MS=60
STOCKFISH_DEEP_MOVETIME_MS=300
STOCKFISH_DEEP_DEPTH=16
STOCKFISH_THREADS=1
STOCKFISH_HASH_MB=128
MAX_DEEP_ANALYSIS_PER_GAME=6
MAX_PV_MOVES=8
IGNORE_ERRORS_BEFORE_MOVE=7
ANALYSIS_MODE=standard
CBX_TOURNAMENTS_URL=https://www.cbx.org.br/torneios
CHESS_RESULTS_BRAZIL_URL=https://chess-results.com/fed.aspx?lan=1&fed=BRA
SCRAPER_TIMEOUT_MS=15000
SCRAPER_USER_AGENT=AuraChessBot/0.1 (+contact later)
TOURNAMENTS_DATE_DEBUG=false
TOURNAMENTS_ENRICH_ENABLED=true
TOURNAMENTS_ENRICH_CONCURRENCY=2
TOURNAMENTS_ENRICH_DELAY_MS=500
TOURNAMENTS_ENRICH_TIMEOUT_MS=15000
TOURNAMENTS_ENRICH_MAX_PER_SYNC=100
TOURNAMENTS_ENRICH_ONLY_MISSING_DATE=true
AI_REVIEW_WEBHOOK_URL=http://localhost:5678/webhook-test/d4448e99-62e1-4d0d-9b09-2f0e15af330c
AI_REVIEW_TIMEOUT_MS=60000
AI_REVIEW_ENABLED=true
AI_REVIEW_MAX_GAMES_PER_REQUEST=3
```

## MongoDB

A conexao com MongoDB usa Mongoose e fica em `src/config/database.ts`.

Configure a connection string real no arquivo `.env`:

```env
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
```

Ao iniciar a aplicacao, o backend chama `connectDatabase()` antes de abrir o servidor HTTP. Se `MONGO_URI` nao estiver configurada, a aplicacao encerra com:

```text
MongoDB connection string (MONGO_URI) is not defined
```

Para testar a conexao:

```bash
npm run dev
```

Se a conexao funcionar, o terminal exibira:

```text
MongoDB connected successfully
```

Models futuros podem ser criados em uma pasta como `src/models/` e importados pelos services ou modules que precisarem persistir dados.

## Torneios

O modulo `src/modules/tournaments` importa torneios publicos da CBX e do Chess-Results para uma base local no MongoDB. Os endpoints de consulta leem apenas o banco local; eles nao fazem scraping em tempo real.

Rodar sync manual:

```bash
curl -X POST http://localhost:3333/tournaments/sync
```

Listar torneios:

```bash
curl "http://localhost:3333/tournaments?state=SP&timeControl=rapid&upcomingOnly=true"
```

Filtros aceitos:

- `search`
- `city`
- `state`
- `timeControl`: `classical`, `rapid`, `blitz`, `mixed`, `unknown`
- `source`: `CBX`, `CHESS_RESULTS`
- `status`: `upcoming`, `ongoing`, `finished`, `unknown`
- `startDateFrom`
- `startDateTo`
- `upcomingOnly=true`
- `page`
- `limit`, maximo `100`

Buscar detalhes:

```bash
curl http://localhost:3333/tournaments/<id>
```

Buscar opcoes de filtros:

```bash
curl http://localhost:3333/tournaments/meta/filters
```

Onde ajustar:

- Seletores/parser da CBX: `src/modules/tournaments/importers/cbx.importer.ts`
- Seletores/parser do Chess-Results: `src/modules/tournaments/importers/chess-results.importer.ts`
- Cidade/UF: `src/modules/tournaments/utils/location-parser.ts`
- Datas: `src/modules/tournaments/utils/date-parser.ts`
- Ritmo: `src/modules/tournaments/utils/time-control-parser.ts`
- Normalizacao geral: `src/modules/tournaments/tournament.normalizer.ts`

Debug de datas:

```bash
curl -X POST http://localhost:3333/tournaments/debug/extract-date \
  -H "Content-Type: application/json" \
  -d '{"text":"Festival de Xadrez Sao Paulo 10 a 12 de maio de 2026"}'
```

Rodar exemplos manuais do parser:

```bash
npm run build
node dist/modules/tournaments/utils/date-parser.examples.js
```

O sync retorna metricas em `dateExtraction`, incluindo quantos torneios vieram com `startDate`, `endDate`, confidence e contagem por fonte. Para logs por torneio, use:

```env
TOURNAMENTS_DATE_DEBUG=true
```

Enrichment de paginas individuais:

- `TOURNAMENTS_ENRICH_ENABLED=false`: desativa acesso a paginas individuais.
- `TOURNAMENTS_ENRICH_CONCURRENCY=2`: controla quantas paginas sao acessadas em paralelo.
- `TOURNAMENTS_ENRICH_DELAY_MS=500`: pausa entre lotes.
- `TOURNAMENTS_ENRICH_TIMEOUT_MS=15000`: timeout por pagina.
- `TOURNAMENTS_ENRICH_MAX_PER_SYNC=100`: limite por execucao.
- `TOURNAMENTS_ENRICH_ONLY_MISSING_DATE=true`: enriquece apenas torneios sem `startDate` apos a listagem.

No retorno de `POST /tournaments/sync`, compare:

- `dateExtraction.beforeEnrichment.withStartDate`
- `enrichment.attempted`
- `enrichment.success`
- `dateExtraction.afterEnrichment.withStartDate`

Se `afterEnrichment.withStartDate` subir, as paginas individuais melhoraram a extracao de datas.

## Autenticacao

Configure o JWT no `.env`:

```env
JWT_SECRET=uma_chave_grande_e_secreta
JWT_EXPIRES_IN=7d
```

Registrar usuario:

```bash
curl -X POST http://localhost:3333/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lucas",
    "email": "lucas@email.com",
    "password": "123456"
  }'
```

Login:

```bash
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lucas@email.com",
    "password": "123456"
  }'
```

As respostas retornam `token` e `user`, sem `passwordHash`.

Para proteger uma rota futuramente, importe `authenticate` de `src/modules/auth/auth.middleware.ts`:

```ts
router.get('/me', authenticate, asyncHandler(controller.me));
```

## Endpoint de analise

`POST /analysis/pgn`

Body esperado:

```json
{
  "games": [
    {
      "id": "optional-game-id",
      "pgn": "1. d4 Nf6 2. c4 g6 ...",
      "metadata": {
        "white": "PlayerWhite",
        "black": "PlayerBlack",
        "result": "1-0",
        "site": "Chess.com or Lichess",
        "date": "2026.04.29"
      }
    }
  ],
  "options": {
    "includeAiReview": true
  }
}
```

Regras iniciais:

- `games` e obrigatorio.
- A request aceita de 1 ate 30 partidas.
- Cada partida precisa conter `pgn`.
- PGNs invalidas retornam erro 400 indicando o indice da partida.
- O payload JSON esta limitado a 2 MB.
- `options.includeAiReview=true` chama o webhook de IA depois da analise tecnica.
- Se `includeAiReview` for omitido ou `false`, o endpoint mantem o comportamento tecnico antigo.

Resposta:

```json
{
  "analysisDepth": 16,
  "fastMovetimeMs": 60,
  "deepMovetimeMs": 300,
  "totalGames": 2,
  "metrics": {
    "totalTimeMs": 18250,
    "fastPhaseTimeMs": 11200,
    "deepPhaseTimeMs": 6200,
    "positionsAnalyzed": 74,
    "deepAnalysesRun": 6,
    "skippedDeepAnalyses": 3,
    "cacheHits": 3,
    "criticalMoments": 5
  },
  "results": [
    {
      "gameId": "game-1",
      "annotatedPgn": "...",
      "criticalMoments": [],
      "aiReview": {
        "success": true,
        "reviewText": "Analise humana da partida..."
      }
    }
  ]
}
```

### Review com IA

O review humano fica em `src/modules/ai-review`. Quando habilitado, o backend envia para
`AI_REVIEW_WEBHOOK_URL` apenas dados da partida: PGN original, PGN anotada, metadados e
`criticalMoments`. Tokens, senhas e dados privados de usuario nao sao enviados.

Payload enviado ao webhook:

```json
{
  "type": "GAME_REVIEW_REQUEST",
  "game": {
    "id": "optional-game-id",
    "metadata": {},
    "originalPgn": "...",
    "annotatedPgn": "...",
    "criticalMoments": []
  },
  "instructions": {
    "language": "pt-BR",
    "style": "human_chess_coach",
    "goal": "Transformar a analise tecnica em uma explicacao humana, didatica e util para o jogador."
  }
}
```

O texto do review pode voltar como `reviewText`, `text`, `message`, `output` ou como string
direta. Se o webhook falhar, a analise Stockfish continua sendo retornada e o campo
`aiReview` vem com `success=false`.

Para desligar a chamada externa:

```env
AI_REVIEW_ENABLED=false
```

`AI_REVIEW_MAX_GAMES_PER_REQUEST` limita quantas partidas recebem review por request. As demais
continuam com analise tecnica e recebem um `aiReview` indicando que o review foi pulado.

A PGN anotada inclui `[%eval]` em todos os lances. Comentarios, simbolos `?!`, `?`, `??`,
melhor lance e variacao principal aparecem apenas em momentos criticos, como `Inaccuracy`,
`Mistake`, `Blunder` e casos de mate forcado. Lances normais como `Best move`, `Excellent`
e `Good` ficam limpos, por exemplo:

```text
1. d4 { [%eval 0.24] } 1... d5 { [%eval 0.34] } 2. c4 { [%eval 0.31] }
```

Um lance problematico recebe comentario e PV:

```text
8. O-O?! { (0.50 -> -0.46) Inaccuracy. e5 was best. } { [%eval -0.46] }
(8. e5 Nd5 9. O-O Qb6 10. e6)
```

O pipeline atual tem duas fases:

- Fase rapida: analisa somente a posicao resultante apos cada lance com `go movetime`.
- Fase profunda: reanalisa apenas os piores candidatos para buscar PV curta.

O client tambem usa cache em memoria por FEN + modo + profundidade/movetime durante a request.

## Ajustes de analise

- Tempo da fase rapida: `STOCKFISH_FAST_MOVETIME_MS`.
- Tempo/profundidade da fase profunda: `STOCKFISH_DEEP_MOVETIME_MS` e `STOCKFISH_DEEP_DEPTH`.
- Threads e hash da engine: `STOCKFISH_THREADS` e `STOCKFISH_HASH_MB`.
- Limite de PVs por partida: `MAX_DEEP_ANALYSIS_PER_GAME`.
- Tamanho maximo da PV: `MAX_PV_MOVES`.
- Lances iniciais ignorados para erro comum: `IGNORE_ERRORS_BEFORE_MOVE`.
- Modo agressivo: `ANALYSIS_MODE=turbo`.
- Thresholds de classificacao: `src/chess/move-classifier.ts`.
- Quais classificacoes geram comentario: `isCritical` em `src/chess/move-classifier.ts`.
- Pipeline rapido/profundo e geracao de PV: `src/chess/game-analyzer.ts`.
- Cache e comandos `go movetime`/`go depth`: `src/engine/stockfish.client.ts`.
- Comunicacao UCI com Stockfish: `src/engine/stockfish.client.ts`.
- Parse de saida da engine: `src/engine/evaluation.parser.ts`.
- Geracao da PGN anotada: `src/chess/pgn-annotator.ts`.
