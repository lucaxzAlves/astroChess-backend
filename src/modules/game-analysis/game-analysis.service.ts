import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { markOpeningExplorerDirty } from '../openings/opening-explorer.service';
import * as gameAnalysisRepository from './game-analysis.repository';
import {
  type GameAnalysisSourceInput,
  type GameAnalysisStoredSource,
  type PersistedGameAnalysisPreview,
  type SaveGameAnalysisInput,
  type TargetPlayerSnapshot,
} from './game-analysis.types';

const REVIEW_TEXT_PREVIEW_LENGTH = 220;

const normalizeString = (value: string): string => value.trim().toLowerCase();

const toObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

export const mapAnalysisSource = (source?: GameAnalysisSourceInput): GameAnalysisStoredSource => {
  switch (source) {
    case 'chess.com':
      return 'chess_com';
    case 'lichess':
      return 'lichess';
    case 'upload':
      return 'upload';
    case 'manual':
      return 'manual';
    default:
      return 'unknown';
  }
};

export const inferTargetPlayerColor = (
  username: string | undefined,
  metadata: SaveGameAnalysisInput['metadata'],
): TargetPlayerSnapshot['color'] => {
  if (!username) {
    return 'unknown';
  }

  const normalizedUsername = normalizeString(username);
  const white = metadata?.white ? normalizeString(metadata.white) : undefined;
  const black = metadata?.black ? normalizeString(metadata.black) : undefined;

  if (white && normalizedUsername === white) {
    return 'white';
  }

  if (black && normalizedUsername === black) {
    return 'black';
  }

  return 'unknown';
};

const buildAiReviewPayload = (input: SaveGameAnalysisInput) => {
  if (!input.aiReview) {
    return {
      success: false,
    };
  }

  return {
    success: input.aiReview.success,
    reviewText: input.aiReview.reviewText,
    rawResponse: input.aiReview.rawResponse,
    error: input.aiReview.error,
  };
};

export const saveGameAnalysis = async (input: SaveGameAnalysisInput) => {
  const mappedSource = mapAnalysisSource(input.source);

  if (input.gameId) {
    const existingAnalysis = await gameAnalysisRepository.findGameAnalysisByGameIdForUser(
      input.userId,
      input.gameId,
      mappedSource,
    );

    const existingBatchId = existingAnalysis?.batchId?.toString();
    const canReplaceInactiveProfileAnalysis =
      input.allowExistingNonBatch === true &&
      Boolean(input.batchId) &&
      (!existingBatchId ||
        !(await gameAnalysisRepository.isBatchAppliedToActiveProfile(existingBatchId)));

    if (existingAnalysis && !canReplaceInactiveProfileAnalysis) {
      throw new AppError('This game has already been analyzed for this user.', 409, {
        gameId: input.gameId,
      });
    }
  }

  const resolvedGameEvidenceSummary =
    input.gameEvidenceSummary ?? input.aiReview?.gameEvidenceSummary ?? undefined;
  const resolvedStructuredSummary =
    input.structuredSummary ??
    (resolvedGameEvidenceSummary
      ? {
          type: 'profile_game_evidence',
          gameEvidenceSummary: resolvedGameEvidenceSummary,
        }
      : undefined);

  const payload = {
    userId: toObjectId(input.userId, 'user id'),
    ...(input.batchId ? { batchId: toObjectId(input.batchId, 'batch id') } : {}),
    gameId: input.gameId,
    source: mappedSource,
    targetPlayer: input.targetPlayer,
    metadata: input.metadata,
    originalPgn: input.originalPgn,
    annotatedPgn: input.technicalAnalysis.annotatedPgn,
    accuracy: input.technicalAnalysis.accuracy,
    moveClassificationSummary: input.technicalAnalysis.moveClassificationSummary,
    classificationDebugSummary: input.technicalAnalysis.classificationDebugSummary,
    moveClassifications: input.technicalAnalysis.moveClassifications,
    criticalMoments: input.technicalAnalysis.criticalMoments,
    aiReview: buildAiReviewPayload(input),
    gameEvidenceSummary: resolvedGameEvidenceSummary,
    structuredSummary: resolvedStructuredSummary,
    analysisStatus: input.aiReview?.success ? 'ai_review_completed' : 'technical_completed',
  };

  const savedAnalysis = await gameAnalysisRepository.createGameAnalysis(payload);

  try {
    await markOpeningExplorerDirty(input.userId);
  } catch (error) {
    console.error('[OPENINGS] Failed to mark opening explorer cache as dirty.', error);
  }

  return savedAnalysis;
};

export const listAnalyzedGameIds = async (
  userId: string,
  source?: GameAnalysisSourceInput,
  options: { batchOnly?: boolean; activeProfileOnly?: boolean } = {},
): Promise<
  Array<{ gameId: string; source?: string; createdAt?: Date; metadata?: unknown; batchId?: string }>
> => {
  const mappedSource = source ? mapAnalysisSource(source) : undefined;
  const analyses = await gameAnalysisRepository.findAnalyzedGameIdsByUser(
    userId,
    mappedSource,
    options,
  );

  return analyses
    .map((analysis) => ({
      gameId: typeof analysis.gameId === 'string' ? analysis.gameId : '',
      source: typeof analysis.source === 'string' ? analysis.source : undefined,
      createdAt: analysis.createdAt,
      metadata: analysis.metadata,
      batchId: analysis.batchId?.toString(),
    }))
    .filter((item) => item.gameId);
};

export const markBatchAnalysesAsProfileProcessed = async (batchId: string) => {
  await gameAnalysisRepository.markBatchAnalysesAsProfileProcessed(batchId);
};

export const listBatchGameAnalyses = async (
  userId: string,
  batchId: string,
  includePgn: boolean,
): Promise<PersistedGameAnalysisPreview[]> => {
  const analyses = await gameAnalysisRepository.findGameAnalysesByBatch(userId, batchId);

  return analyses.map((analysis) => ({
    id: analysis._id.toString(),
    gameId: analysis.gameId,
    metadata: analysis.metadata,
    targetPlayer: analysis.targetPlayer,
    accuracy: analysis.accuracy,
    moveClassificationSummary: analysis.moveClassificationSummary,
    aiReview: {
      success: analysis.aiReview?.success ?? false,
      reviewTextPreview: analysis.aiReview?.reviewText?.slice(0, REVIEW_TEXT_PREVIEW_LENGTH),
      error: analysis.aiReview?.error,
    },
    hasGameEvidenceSummary: Boolean(analysis.gameEvidenceSummary),
    analysisStatus: analysis.analysisStatus,
    createdAt: analysis.createdAt,
    ...(includePgn ? { annotatedPgn: analysis.annotatedPgn } : {}),
  }));
};
