import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { AnalysisBatch } from '../analysis-batch/analysis-batch.model';
import { GameAnalysis } from './game-analysis.model';

const toObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

export const createGameAnalysis = async (payload: Record<string, unknown>) => {
  return GameAnalysis.create(payload);
};

const findActiveProfileBatchIds = async (userId: string): Promise<Types.ObjectId[]> => {
  const batches = await AnalysisBatch.find({
    userId: toObjectId(userId, 'user id'),
    'profileUpdate.status': 'completed',
    'profileUpdate.playerProfileUpdated': true,
    'profileUpdate.profileImpactReverted': { $ne: true },
  })
    .select({ _id: 1 })
    .lean()
    .exec();

  return batches.map((batch) => batch._id);
};

export const findAnalyzedGameIdsByUser = async (
  userId: string,
  source?: string,
  options: { batchOnly?: boolean; activeProfileOnly?: boolean } = {},
) => {
  const query: Record<string, unknown> = {
    userId: toObjectId(userId, 'user id'),
    gameId: { $exists: true, $ne: '' },
  };

  if (source) {
    query.source = source;
  }

  if (options.batchOnly) {
    query.batchId = { $exists: true, $ne: null };
  }

  if (options.activeProfileOnly) {
    const activeProfileBatchIds = await findActiveProfileBatchIds(userId);

    if (activeProfileBatchIds.length === 0) {
      return [];
    }

    query.batchId = { $in: activeProfileBatchIds };
  }

  return GameAnalysis.find(query)
    .select({ gameId: 1, source: 1, createdAt: 1, metadata: 1, batchId: 1 })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
};

export const markBatchAnalysesAsProfileProcessed = async (batchId: string) => {
  return GameAnalysis.updateMany(
    { batchId: toObjectId(batchId, 'batch id') },
    { $set: { analysisStatus: 'profile_processed' } },
  ).exec();
};

export const isBatchAppliedToActiveProfile = async (batchId: string): Promise<boolean> => {
  const batch = await AnalysisBatch.exists({
    _id: toObjectId(batchId, 'batch id'),
    'profileUpdate.status': 'completed',
    'profileUpdate.playerProfileUpdated': true,
    'profileUpdate.profileImpactReverted': { $ne: true },
  }).exec();

  return Boolean(batch);
};

export const findGameAnalysisByGameIdForUser = async (
  userId: string,
  gameId: string,
  source?: string,
) => {
  const query: Record<string, unknown> = {
    userId: toObjectId(userId, 'user id'),
    gameId,
  };

  if (source) {
    query.source = source;
  }

  return GameAnalysis.findOne(query).select({ _id: 1, gameId: 1, batchId: 1 }).lean().exec();
};


export const findGameAnalysesForOpeningExplorer = async (userId: string) => {
  return GameAnalysis.find({
    userId: toObjectId(userId, 'user id'),
    originalPgn: { $exists: true, $ne: '' },
  })
    .select({
      _id: 1,
      gameId: 1,
      source: 1,
      createdAt: 1,
      originalPgn: 1,
      metadata: 1,
      targetPlayer: 1,
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
};

export const findGameAnalysesByBatch = async (userId: string, batchId: string) => {
  return GameAnalysis.find({
    userId: toObjectId(userId, 'user id'),
    batchId: toObjectId(batchId, 'batch id'),
  })
    .sort({ createdAt: 1 })
    .exec();
};

export const findGameAnalysesByBatchId = async (batchId: string) => {
  return GameAnalysis.find({
    batchId: toObjectId(batchId, 'batch id'),
  })
    .sort({ createdAt: 1 })
    .exec();
};
