import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { MasterReplayGame } from './master-replay.model';
import type { MasterReplayGameDocument } from './master-replay.types';

const toObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

export const createGame = async (payload: Record<string, unknown>) => {
  return MasterReplayGame.create(payload);
};

export const findGameById = async (gameId: string) => {
  return MasterReplayGame.findById(toObjectId(gameId, 'game id')).exec();
};

export const findGameBySlug = async (slug: string) => {
  return MasterReplayGame.findOne({ slug }).exec();
};

export const saveGame = async (game: MasterReplayGameDocument) => {
  return game.save();
};

export const paginateGames = async (
  query: Record<string, unknown>,
  page: number,
  limit: number,
) => {
  const [items, total] = await Promise.all([
    MasterReplayGame.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    MasterReplayGame.countDocuments(query).exec(),
  ]);

  return {
    items,
    total,
  };
};
