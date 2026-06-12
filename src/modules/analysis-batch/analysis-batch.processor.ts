import { AppError } from '../../utils/AppError';
import { analyzeSingleGamePgn, createStockfishClient } from '../analysis/analysis.service';
import * as analysisBatchRepository from './analysis-batch.repository';
import type { AnalysisBatchDocument, AnalysisBatchErrorStage, AnalysisBatchGameInput, AnalysisBatchOptions } from './analysis-batch.types';
import { requestSingleGameReview } from '../ai-review/ai-review.service';
import { buildAgentOneProfileSummary } from '../profile-evidence/profile-evidence.service';
import { inferTargetPlayerColor, saveGameAnalysis } from '../game-analysis/game-analysis.service';
import { executeBatchProfileUpdate } from './analysis-batch-profile-update.service';

const MAX_RETRIES_PER_GAME = 2;

type ProcessAnalysisBatchInput = {
  batchId: string;
  userId: string;
  games: AnalysisBatchGameInput[];
  options: AnalysisBatchOptions;
};

type QueuedBatchGame = {
  game: AnalysisBatchGameInput;
  originalIndex: number;
  retryCount: number;
};

class BatchGameAttemptError extends Error {
  stage: AnalysisBatchErrorStage;

  constructor(stage: AnalysisBatchErrorStage, error: unknown, fallback: string) {
    super(resolveErrorMessage(error, fallback));
    this.name = 'BatchGameAttemptError';
    this.stage = stage;
  }
}

const pushBatchError = (
  batch: AnalysisBatchDocument,
  params: {
    gameId?: string;
    message: string;
    stage: AnalysisBatchErrorStage;
  },
): void => {
  batch.errors.push({
    gameId: params.gameId,
    message: params.message,
    stage: params.stage,
    createdAt: new Date(),
  });
};

const resolveErrorStage = (error: unknown): AnalysisBatchErrorStage => {
  if (error instanceof BatchGameAttemptError) {
    return error.stage;
  }

  return error instanceof AppError ? 'technical_analysis' : 'unknown';
};

const resolveErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback;
};

const saveBatch = async (batch: AnalysisBatchDocument): Promise<void> => {
  await batch.save();
};

const resolveCompletedStatus = (batch: AnalysisBatchDocument): AnalysisBatchDocument['status'] => {
  if (batch.successfulGames === 0) {
    return 'failed';
  }

  if (batch.failedGames > 0 || batch.errors.length > 0) {
    return 'completed_with_errors';
  }

  return 'completed';
};

const handleAutomaticProfileUpdate = async (
  batch: AnalysisBatchDocument,
  userId: string,
  options: AnalysisBatchOptions,
): Promise<void> => {
  if (batch.successfulGames === 0) {
    batch.profileUpdate.status = 'not_started';
    batch.status = 'failed';
    return;
  }

  if (!options.updateProfileAfterBatch) {
    batch.profileUpdate.status = 'not_started';
    batch.status = resolveCompletedStatus(batch);
    return;
  }

  try {
    await executeBatchProfileUpdate(batch, userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile evidence preparation failed.';

    batch.status = 'profile_update_failed';
    batch.profileUpdate = {
      ...batch.profileUpdate,
      status: 'failed',
      error: message,
      processedAt: new Date(),
    };
    pushBatchError(batch, {
      message,
      stage: 'profile_update',
    });
  }
};

const processSingleBatchGame = async ({
  batch,
  batchId,
  userId,
  game,
  index,
  options,
  stockfish,
  profileSummary,
}: {
  batch: AnalysisBatchDocument;
  batchId: string;
  userId: string;
  game: AnalysisBatchGameInput;
  index: number;
  options: AnalysisBatchOptions;
  stockfish: ReturnType<typeof createStockfishClient>;
  profileSummary: Awaited<ReturnType<typeof buildAgentOneProfileSummary>>;
}): Promise<void> => {
  const technicalResult = await analyzeSingleGamePgn(game, stockfish, index);
  const analysis = technicalResult.analysis;
  const targetPlayer = {
    username: options.targetPlayer?.username,
    platform: options.targetPlayer?.platform ?? 'unknown',
    color: inferTargetPlayerColor(options.targetPlayer?.username, game.metadata),
  } as const;

  let aiReview;

  if (options.includeAiReview) {
    try {
      aiReview = await requestSingleGameReview({
        analysisType: 'profile_game_evidence',
        gameId: game.id,
        originalPgn: game.pgn,
        annotatedPgn: analysis.annotatedPgn,
        criticalMoments: analysis.criticalMoments,
        moveClassifications: analysis.moveClassifications,
        moveClassificationSummary: analysis.moveClassificationSummary,
        accuracy: analysis.accuracy,
        targetPlayer,
        metadata: game.metadata,
        profileSummary,
      });
    } catch (error) {
      throw new BatchGameAttemptError(
        'ai_review',
        error,
        'AI review failed during batch processing.',
      );
    }

    if (!aiReview.success && aiReview.error) {
      pushBatchError(batch, {
        gameId: game.id,
        message: aiReview.error,
        stage: 'ai_review',
      });
    }
  }

  let savedAnalysis;

  try {
    savedAnalysis = await saveGameAnalysis({
      userId,
      batchId,
      allowExistingNonBatch: true,
      gameId: game.id,
      source: options.source,
      targetPlayer,
      metadata: {
        ...game.metadata,
        timeControl: game.metadata?.timeControl ?? options.timeControl,
      },
      originalPgn: game.pgn,
      technicalAnalysis: {
        gameId: analysis.gameId,
        annotatedPgn: analysis.annotatedPgn,
        accuracy: analysis.accuracy,
        moveClassificationSummary: analysis.moveClassificationSummary,
        moveClassifications: analysis.moveClassifications,
        criticalMoments: analysis.criticalMoments,
      },
      aiReview,
      gameEvidenceSummary: aiReview?.gameEvidenceSummary,
      structuredSummary: aiReview?.structuredSummary,
    });
  } catch (error) {
    throw new BatchGameAttemptError(
      'database_save',
      error,
      'Failed to save GameAnalysis document.',
    );
  }

  batch.gameAnalysisIds.push(savedAnalysis._id);
};

export const processAnalysisBatch = async ({
  batchId,
  userId,
  games,
  options,
}: ProcessAnalysisBatchInput): Promise<void> => {
  const batch = await analysisBatchRepository.findAnalysisBatchById(batchId);

  if (!batch) {
    return;
  }

  batch.status = 'processing';
  batch.startedAt = batch.startedAt ?? new Date();
  await saveBatch(batch);

  const stockfish = createStockfishClient();

  try {
    await stockfish.start();
    const profileSummary = await buildAgentOneProfileSummary(userId);
    const queue: QueuedBatchGame[] = games.map((game, originalIndex) => ({
      game,
      originalIndex,
      retryCount: 0,
    }));

    while (queue.length > 0) {
      const queuedGame = queue.shift();

      if (!queuedGame) {
        continue;
      }

      try {
        await processSingleBatchGame({
          batch,
          batchId,
          userId,
          game: queuedGame.game,
          index: queuedGame.originalIndex,
          options,
          stockfish,
          profileSummary,
        });

        batch.processedGames += 1;
        batch.successfulGames += 1;
      } catch (error) {
        if (queuedGame.retryCount < MAX_RETRIES_PER_GAME) {
          queue.push({
            ...queuedGame,
            retryCount: queuedGame.retryCount + 1,
          });

          console.warn('[analysis-batch] game failed; queued retry', {
            batchId,
            gameId: queuedGame.game.id,
            retryCount: queuedGame.retryCount + 1,
            maxRetries: MAX_RETRIES_PER_GAME,
            error: resolveErrorMessage(error, 'Game analysis failed.'),
          });

          await saveBatch(batch);
          continue;
        }

        batch.processedGames += 1;
        batch.failedGames += 1;

        pushBatchError(batch, {
          gameId: queuedGame.game.id,
          message: `${resolveErrorMessage(error, 'Game analysis failed.')} Failed after ${
            MAX_RETRIES_PER_GAME + 1
          } attempts.`,
          stage: resolveErrorStage(error),
        });
      }

      await saveBatch(batch);
    }

    await handleAutomaticProfileUpdate(batch, userId, options);
  } catch (error) {
    batch.status = 'failed';
    pushBatchError(batch, {
      message: error instanceof Error ? error.message : 'Analysis batch setup failed.',
      stage: 'unknown',
    });
  } finally {
    batch.finishedAt = new Date();
    stockfish.close();
    await saveBatch(batch);
  }
};
