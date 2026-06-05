import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { PlayerProfile } from '../../models/PlayerProfile';
import { GameAnalysis } from '../game-analysis/game-analysis.model';
import { OpeningExplorerCache } from './opening-explorer.model';
import type {
  OpeningExplorerCacheRecord,
  OpeningExplorerGameRecord,
} from './opening-explorer.types';

const toObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

export const findOpeningExplorerGamesByUser = async (
  userId: string,
): Promise<OpeningExplorerGameRecord[]> => {
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
    .lean<OpeningExplorerGameRecord[]>()
    .exec();
};

export const findOpeningExplorerCacheByUser = async (userId: string) => {
  return OpeningExplorerCache.findOne({
    playerId: toObjectId(userId, 'user id'),
  })
    .lean<OpeningExplorerCacheRecord | null>()
    .exec();
};

export const upsertOpeningExplorerCache = async (
  userId: string,
  payload: Pick<OpeningExplorerCacheRecord, 'root' | 'stats'>,
) => {
  return OpeningExplorerCache.findOneAndUpdate(
    {
      playerId: toObjectId(userId, 'user id'),
    },
    {
      $set: {
        root: payload.root,
        stats: payload.stats,
        dirty: false,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  )
    .lean<OpeningExplorerCacheRecord>()
    .exec();
};

export const markOpeningExplorerDirtyByUser = async (userId: string): Promise<void> => {
  await OpeningExplorerCache.updateOne(
    {
      playerId: toObjectId(userId, 'user id'),
    },
    {
      $set: {
        dirty: true,
      },
    },
  ).exec();
};

export const findPlayerProfileIdentitiesByUser = async (userId: string) => {
  return PlayerProfile.findOne({
    userId: toObjectId(userId, 'user id'),
  })
    .select({ identities: 1 })
    .lean<
      | {
          identities?: {
            chessCom?: { username?: string };
            lichess?: { username?: string };
            fide?: { name?: string };
          };
        }
      | null
    >()
    .exec();
};
