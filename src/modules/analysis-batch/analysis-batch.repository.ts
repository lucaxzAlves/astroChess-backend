import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { AnalysisBatch } from './analysis-batch.model';
import type { AnalysisBatchDocument } from './analysis-batch.types';

const toObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

export const createAnalysisBatch = async (payload: Record<string, unknown>) => {
  return AnalysisBatch.create(payload);
};

export const findAnalysisBatchById = async (batchId: string) => {
  return AnalysisBatch.findById(toObjectId(batchId, 'batch id')).exec();
};

export const findAnalysisBatchByIdForUser = async (userId: string, batchId: string) => {
  return AnalysisBatch.findOne({
    _id: toObjectId(batchId, 'batch id'),
    userId: toObjectId(userId, 'user id'),
  }).exec();
};

export const saveAnalysisBatch = async (batch: AnalysisBatchDocument) => {
  return batch.save();
};
