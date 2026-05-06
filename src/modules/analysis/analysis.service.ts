import { parsePgnGame } from '../../chess/pgn.parser';
import { env } from '../../config/env';
import { StockfishClient } from '../../engine/stockfish.client';
import { requestAiGameReview } from '../ai-review/ai-review.service';
import { AppError } from '../../utils/AppError';
import { analyzeParsedGame } from '../../chess/game-analyzer';
import { AnalysisGameInput, AnalysisPgnResponse } from './analysis.types';

const MAX_GAMES_PER_REQUEST = 30;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const validateGames = (body: unknown): AnalysisGameInput[] => {
  if (!isRecord(body) || !Array.isArray(body.games)) {
    throw new AppError('The request body must include a games array.', 400);
  }

  if (body.games.length === 0) {
    throw new AppError('The games array must include at least one game.', 400);
  }

  if (body.games.length > MAX_GAMES_PER_REQUEST) {
    throw new AppError(`A request can include at most ${MAX_GAMES_PER_REQUEST} games.`, 400, {
      received: body.games.length,
      max: MAX_GAMES_PER_REQUEST,
    });
  }

  return body.games.map((game, index) => {
    if (!isRecord(game)) {
      throw new AppError(`Game at index ${index} must be an object.`, 400, { index });
    }

    if (typeof game.pgn !== 'string' || game.pgn.trim().length === 0) {
      throw new AppError(`Game at index ${index} must include a non-empty pgn field.`, 400, {
        index,
      });
    }

    if (game.id !== undefined && typeof game.id !== 'string') {
      throw new AppError(`Game id at index ${index} must be a string when provided.`, 400, {
        index,
      });
    }

    if (game.metadata !== undefined && !isRecord(game.metadata)) {
      throw new AppError(`Game metadata at index ${index} must be an object when provided.`, 400, {
        index,
      });
    }

    return {
      id: game.id,
      pgn: game.pgn,
      metadata: game.metadata,
    } as AnalysisGameInput;
  });
};

const shouldIncludeAiReview = (body: unknown): boolean => {
  if (!isRecord(body) || !isRecord(body.options)) {
    return false;
  }

  return body.options.includeAiReview === true;
};

const createEmptyMetrics = () => {
  return {
    totalTimeMs: 0,
    fastPhaseTimeMs: 0,
    deepPhaseTimeMs: 0,
    positionsAnalyzed: 0,
    deepAnalysesRun: 0,
    skippedDeepAnalyses: 0,
    cacheHits: 0,
    criticalMoments: 0,
  };
};

export const analyzePgnGames = async (body: unknown): Promise<AnalysisPgnResponse> => {
  const startedAt = Date.now();
  const games = validateGames(body);
  const includeAiReview = shouldIncludeAiReview(body);
  const parsedGames = games.map((game, index) => parsePgnGame(game, index));
  const stockfish = new StockfishClient({
    binaryPath: env.stockfishPath,
    timeoutMs: env.stockfishTimeoutMs,
    threads: env.stockfishThreads,
    hashMb: env.stockfishHashMb,
  });

  try {
    await stockfish.start();

    const results = [];
    const metrics = createEmptyMetrics();

    for (const [index, game] of parsedGames.entries()) {
      const gameResult = await analyzeParsedGame(game, stockfish, {
        fastMovetimeMs: env.stockfishFastMovetimeMs,
        deepMovetimeMs: env.stockfishDeepMovetimeMs,
        deepDepth: env.stockfishDeepDepth,
        maxDeepAnalysisPerGame: env.maxDeepAnalysisPerGame,
        maxPvMoves: env.maxPvMoves,
        ignoreErrorsBeforeMove: env.ignoreErrorsBeforeMove,
        maxBookMovesPerSide: env.maxBookMovesPerSide,
        maxGreatMovesPerSide: env.maxGreatMovesPerSide,
        enableMoveClassifications: env.analysisEnableMoveClassifications,
        enableAccuracy: env.analysisEnableAccuracy,
        enableClassificationDebug: env.analysisClassificationDebug,
      });
      const analysis = gameResult.analysis;

      if (includeAiReview) {
        if (index >= env.aiReviewMaxGamesPerRequest) {
          analysis.aiReview = {
            success: false,
            error: 'AI review skipped because max games per request was exceeded',
          };
        } else {
          analysis.aiReview = await requestAiGameReview({
            gameId: game.id,
            originalPgn: game.pgn,
            annotatedPgn: analysis.annotatedPgn,
            criticalMoments: analysis.criticalMoments,
            metadata: game.metadata,
          });
        }
      }

      results.push(analysis);
      metrics.fastPhaseTimeMs += gameResult.metrics.fastPhaseTimeMs;
      metrics.deepPhaseTimeMs += gameResult.metrics.deepPhaseTimeMs;
      metrics.positionsAnalyzed += gameResult.metrics.positionsAnalyzed;
      metrics.deepAnalysesRun += gameResult.metrics.deepAnalysesRun;
      metrics.skippedDeepAnalyses += gameResult.metrics.skippedDeepAnalyses;
      metrics.cacheHits += gameResult.metrics.cacheHits;
      metrics.criticalMoments += gameResult.metrics.criticalMoments;
    }

    metrics.totalTimeMs = Date.now() - startedAt;

    return {
      analysisDepth: env.stockfishDeepDepth,
      fastMovetimeMs: env.stockfishFastMovetimeMs,
      deepMovetimeMs: env.stockfishDeepMovetimeMs,
      totalGames: games.length,
      metrics,
      results,
    };
  } finally {
    stockfish.close();
  }
};
