import { Types } from 'mongoose';

import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { AuthRequest } from '../auth/auth.types';
import { validateAnalysisGames } from '../analysis/analysis.service';
import * as analysisBatchRepository from './analysis-batch.repository';
import { processAnalysisBatch } from './analysis-batch.processor';
import { executeBatchProfileUpdate } from './analysis-batch-profile-update.service';
import {
  getPreviousProfileVersionIdForBatch,
  restoreProfileVersion,
} from '../player-profile-version/player-profile-version.service';
import type {
  AnalysisBatchDocument,
  AnalysisBatchGameInput,
  AnalysisBatchOptions,
  AnalysisBatchTargetPlatform,
} from './analysis-batch.types';
import * as gameAnalysisService from '../game-analysis/game-analysis.service';

const TARGET_PLATFORMS = new Set(['chess.com', 'lichess', 'manual', 'unknown']);
const SOURCES = new Set(['chess.com', 'lichess', 'upload', 'manual', 'unknown']);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const ensureUserId = (request: AuthRequest): string => {
  if (!request.user?.userId) {
    throw new AppError('Unauthorized', 401);
  }

  return request.user.userId;
};

const normalizeGameId = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const findDuplicateGameIds = (games: AnalysisBatchGameInput[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const game of games) {
    const gameId = normalizeGameId(game.id);

    if (!gameId) {
      continue;
    }

    if (seen.has(gameId)) {
      duplicates.add(gameId);
      continue;
    }

    seen.add(gameId);
  }

  return [...duplicates];
};

const assertBatchHasNoDuplicateGames = async (
  userId: string,
  games: AnalysisBatchGameInput[],
  options: AnalysisBatchOptions,
): Promise<void> => {
  const duplicateInputGameIds = findDuplicateGameIds(games);

  if (duplicateInputGameIds.length > 0) {
    throw new AppError('The batch contains duplicate games.', 409, {
      duplicateGameIds: duplicateInputGameIds,
    });
  }

  const requestedGameIds = games.map((game) => normalizeGameId(game.id)).filter(Boolean);

  if (!requestedGameIds.length) {
    return;
  }

  const analyzedGameIds = await gameAnalysisService.listAnalyzedGameIds(
    userId,
    options.source,
    { batchOnly: true, activeProfileOnly: true },
  );
  const analyzedGameIdSet = new Set(analyzedGameIds.map((item) => item.gameId));
  const alreadyAnalyzedGameIds = requestedGameIds.filter((gameId) =>
    analyzedGameIdSet.has(gameId),
  );

  if (alreadyAnalyzedGameIds.length > 0) {
    throw new AppError('Some games in this batch were already analyzed.', 409, {
      alreadyAnalyzedGameIds,
    });
  }
};

const normalizeBatchOptions = (rawOptions: unknown): AnalysisBatchOptions => {
  if (rawOptions === undefined) {
    return {
      includeAiReview: false,
      updateProfileAfterBatch: false,
      source: 'unknown',
      targetPlayer: {
        platform: 'unknown',
      },
    };
  }

  if (!isRecord(rawOptions)) {
    throw new AppError('options must be an object when provided.', 400);
  }

  const includeAiReview = rawOptions.includeAiReview === true;
  const updateProfileAfterBatch = rawOptions.updateProfileAfterBatch === true;

  if (
    rawOptions.source !== undefined &&
    (typeof rawOptions.source !== 'string' || !SOURCES.has(rawOptions.source))
  ) {
    throw new AppError('options.source must be a valid source.', 400);
  }

  if (rawOptions.timeControl !== undefined && typeof rawOptions.timeControl !== 'string') {
    throw new AppError('options.timeControl must be a string when provided.', 400);
  }

  let targetPlayer: AnalysisBatchOptions['targetPlayer'] | undefined;

  if (rawOptions.targetPlayer !== undefined) {
    if (!isRecord(rawOptions.targetPlayer)) {
      throw new AppError('options.targetPlayer must be an object when provided.', 400);
    }

    if (
      rawOptions.targetPlayer.username !== undefined &&
      typeof rawOptions.targetPlayer.username !== 'string'
    ) {
      throw new AppError('options.targetPlayer.username must be a string when provided.', 400);
    }

    if (
      rawOptions.targetPlayer.platform !== undefined &&
      (typeof rawOptions.targetPlayer.platform !== 'string' ||
        !TARGET_PLATFORMS.has(rawOptions.targetPlayer.platform))
    ) {
      throw new AppError('options.targetPlayer.platform must be valid when provided.', 400);
    }

    targetPlayer = {
      username:
        typeof rawOptions.targetPlayer.username === 'string'
          ? rawOptions.targetPlayer.username.trim()
          : undefined,
      platform:
        (rawOptions.targetPlayer.platform as AnalysisBatchTargetPlatform | undefined) ?? 'unknown',
    };
  }

  return {
    includeAiReview,
    updateProfileAfterBatch,
    source: (rawOptions.source as AnalysisBatchOptions['source']) ?? 'unknown',
    timeControl: typeof rawOptions.timeControl === 'string' ? rawOptions.timeControl.trim() : undefined,
    targetPlayer: targetPlayer ?? {
      platform: 'unknown',
    },
  };
};

const validateCreateBatchBody = (body: unknown): {
  games: AnalysisBatchGameInput[];
  options: AnalysisBatchOptions;
} => {
  const games = validateAnalysisGames(
    body,
    env.analysisBatchMaxGames,
  ) as AnalysisBatchGameInput[];

  const options = isRecord(body) ? normalizeBatchOptions(body.options) : normalizeBatchOptions(undefined);

  return {
    games,
    options,
  };
};

const toResponse = (batch: AnalysisBatchDocument) => {
  return {
    id: batch._id.toString(),
    status: batch.status,
    totalGames: batch.totalGames,
    processedGames: batch.processedGames,
    successfulGames: batch.successfulGames,
    failedGames: batch.failedGames,
    profileUpdate: {
      status: batch.profileUpdate?.status,
      processedAt: batch.profileUpdate?.processedAt ?? null,
      error: batch.profileUpdate?.error,
      hasProfileDelta: Boolean(batch.profileUpdate?.profileDelta),
      playerProfileUpdated: batch.profileUpdate?.playerProfileUpdated === true,
      profileVersionBeforeId: batch.profileUpdate?.profileVersionBeforeId?.toString(),
      profileVersionAfterId: batch.profileUpdate?.profileVersionAfterId?.toString(),
      profileImpactReverted: batch.profileUpdate?.profileImpactReverted === true,
      revertedAt: batch.profileUpdate?.revertedAt ?? null,
      revertedToVersionId: batch.profileUpdate?.revertedToVersionId?.toString(),
    },
    createdAt: batch.createdAt,
    startedAt: batch.startedAt ?? null,
    finishedAt: batch.finishedAt ?? null,
    errors: batch.errors,
  };
};

export const createAnalysisBatchForUser = async (userId: string, body: unknown) => {
  const { games, options } = validateCreateBatchBody(body);
  await assertBatchHasNoDuplicateGames(userId, games, options);

  const batch = await analysisBatchRepository.createAnalysisBatch({
    userId: new Types.ObjectId(userId),
    status: 'pending',
    totalGames: games.length,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    analysisOptions: options,
    gameAnalysisIds: [],
    errors: [],
    profileUpdate: {
      status: 'not_started',
    },
  });

  setImmediate(() => {
    void processAnalysisBatch({
      batchId: batch._id.toString(),
      userId,
      games,
      options,
    });
  });

  return {
    success: true,
    batchId: batch._id.toString(),
    status: batch.status,
    totalGames: batch.totalGames,
  };
};

export const getAnalysisBatchForUser = async (userId: string, batchId: string) => {
  const batch = await analysisBatchRepository.findAnalysisBatchByIdForUser(userId, batchId);

  if (!batch) {
    throw new AppError('Analysis batch not found.', 404);
  }

  return toResponse(batch);
};

export const getAnalysisBatchGamesForUser = async (
  userId: string,
  batchId: string,
  includePgn: boolean,
) => {
  const batch = await analysisBatchRepository.findAnalysisBatchByIdForUser(userId, batchId);

  if (!batch) {
    throw new AppError('Analysis batch not found.', 404);
  }

  const items = await gameAnalysisService.listBatchGameAnalyses(userId, batchId, includePgn);

  return {
    batchId: batch._id.toString(),
    items,
  };
};

export const getAnalyzedGameIdsForUser = async (
  userId: string,
  source?: unknown,
  scope?: unknown,
) => {
  if (source !== undefined && (typeof source !== 'string' || !SOURCES.has(source))) {
    throw new AppError('source must be a valid source when provided.', 400);
  }

  if (scope !== undefined && scope !== 'batch' && scope !== 'all') {
    throw new AppError('scope must be "batch" or "all" when provided.', 400);
  }

  const items = await gameAnalysisService.listAnalyzedGameIds(
    userId,
    source as AnalysisBatchOptions['source'] | undefined,
    { batchOnly: scope !== 'all', activeProfileOnly: scope !== 'all' },
  );

  return {
    items,
    gameIds: items.map((item) => item.gameId),
  };
};

export const triggerProfileUpdateForBatch = async (userId: string, batchId: string) => {
  const batch = await analysisBatchRepository.findAnalysisBatchByIdForUser(userId, batchId);

  if (!batch) {
    throw new AppError('Analysis batch not found.', 404);
  }

  const result = await executeBatchProfileUpdate(batch, userId);

  if (!result.enabled) {
    return {
      success: true,
      enabled: false,
      message: 'Profile update agent disabled. Returning generated payload preview.',
      payload: result.payload,
    };
  }

  return result;
};

export const revertBatchProfileImpact = async (userId: string, batchId: string) => {
  const batch = await analysisBatchRepository.findAnalysisBatchByIdForUser(userId, batchId);

  if (!batch) {
    throw new AppError('Analysis batch not found.', 404);
  }

  const beforeVersionId =
    batch.profileUpdate?.profileVersionBeforeId?.toString() ??
    await getPreviousProfileVersionIdForBatch(userId, batchId);

  if (!beforeVersionId) {
    throw new AppError('This batch does not have a restorable profile snapshot.', 400);
  }

  const restored = await restoreProfileVersion(userId, beforeVersionId);
  batch.profileUpdate = {
    ...batch.profileUpdate,
    revertedAt: new Date(),
    revertedToVersionId: new Types.ObjectId(beforeVersionId),
    profileImpactReverted: true,
    playerProfileUpdated: true,
  };
  await analysisBatchRepository.saveAnalysisBatch(batch);

  return {
    success: true,
    message: 'Batch profile impact reverted.',
    batchId: batch._id.toString(),
    restoredVersionId: beforeVersionId,
    newVersionId: restored.newVersionId,
  };
};

export const getAuthenticatedUserId = ensureUserId;
