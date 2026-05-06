import dotenv from 'dotenv';

dotenv.config();

const parsePort = (value: string | undefined): number => {
  const fallbackPort = 3333;

  if (!value) {
    return fallbackPort;
  }

  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    return fallbackPort;
  }

  return parsedPort;
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
};

const analysisMode = process.env.ANALYSIS_MODE ?? 'standard';
const isTurboMode = analysisMode === 'turbo';
const defaultCorsOrigin = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? defaultCorsOrigin,
  mongoUri: process.env.MONGO_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  stockfishPath: process.env.STOCKFISH_PATH,
  stockfishTimeoutMs: parsePositiveInteger(process.env.STOCKFISH_TIMEOUT_MS, 15_000),
  analysisMode,
  stockfishFastMovetimeMs: parsePositiveInteger(
    process.env.STOCKFISH_FAST_MOVETIME_MS,
    isTurboMode ? 50 : 60,
  ),
  stockfishDeepMovetimeMs: parsePositiveInteger(
    process.env.STOCKFISH_DEEP_MOVETIME_MS,
    isTurboMode ? 250 : 300,
  ),
  stockfishDeepDepth: parsePositiveInteger(process.env.STOCKFISH_DEEP_DEPTH, 16),
  stockfishThreads: parsePositiveInteger(process.env.STOCKFISH_THREADS, 1),
  stockfishHashMb: parsePositiveInteger(process.env.STOCKFISH_HASH_MB, 128),
  maxDeepAnalysisPerGame: parsePositiveInteger(
    process.env.MAX_DEEP_ANALYSIS_PER_GAME,
    isTurboMode ? 5 : 6,
  ),
  maxPvMoves: parsePositiveInteger(process.env.MAX_PV_MOVES, isTurboMode ? 6 : 8),
  ignoreErrorsBeforeMove: parsePositiveInteger(process.env.IGNORE_ERRORS_BEFORE_MOVE, 7),
  maxBookMovesPerSide: parsePositiveInteger(process.env.MAX_BOOK_MOVES_PER_SIDE, 3),
  maxGreatMovesPerSide: parsePositiveInteger(process.env.MAX_GREAT_MOVES_PER_SIDE, 5),
  analysisEnableMoveClassifications: parseBoolean(
    process.env.ANALYSIS_ENABLE_MOVE_CLASSIFICATIONS,
    true,
  ),
  analysisEnableAccuracy: parseBoolean(process.env.ANALYSIS_ENABLE_ACCURACY, true),
  analysisClassificationDebug: parseBoolean(process.env.ANALYSIS_CLASSIFICATION_DEBUG, false),
  cbxTournamentsUrl: process.env.CBX_TOURNAMENTS_URL ?? 'https://www.cbx.org.br/torneios',
  chessResultsBrazilUrl:
    process.env.CHESS_RESULTS_BRAZIL_URL ?? 'https://chess-results.com/fed.aspx?lan=1&fed=BRA',
  scraperTimeoutMs: parsePositiveInteger(process.env.SCRAPER_TIMEOUT_MS, 15_000),
  scraperUserAgent: process.env.SCRAPER_USER_AGENT ?? 'AuraChessBot/0.1 (+contact later)',
  tournamentsDateDebug: process.env.TOURNAMENTS_DATE_DEBUG === 'true',
  tournamentsEnrichEnabled: process.env.TOURNAMENTS_ENRICH_ENABLED !== 'false',
  tournamentsEnrichConcurrency: parsePositiveInteger(process.env.TOURNAMENTS_ENRICH_CONCURRENCY, 2),
  tournamentsEnrichDelayMs: parsePositiveInteger(process.env.TOURNAMENTS_ENRICH_DELAY_MS, 500),
  tournamentsEnrichTimeoutMs: parsePositiveInteger(
    process.env.TOURNAMENTS_ENRICH_TIMEOUT_MS,
    15_000,
  ),
  tournamentsEnrichMaxPerSync: parsePositiveInteger(
    process.env.TOURNAMENTS_ENRICH_MAX_PER_SYNC,
    100,
  ),
  tournamentsEnrichOnlyMissingDate: process.env.TOURNAMENTS_ENRICH_ONLY_MISSING_DATE !== 'false',
  aiReviewWebhookUrl: process.env.AI_REVIEW_WEBHOOK_URL ?? '',
  aiReviewTimeoutMs: parsePositiveInteger(process.env.AI_REVIEW_TIMEOUT_MS, 60_000),
  aiReviewEnabled: process.env.AI_REVIEW_ENABLED === 'true',
  aiReviewMaxGamesPerRequest: parsePositiveInteger(process.env.AI_REVIEW_MAX_GAMES_PER_REQUEST, 3),
};
