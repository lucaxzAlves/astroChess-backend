import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import * as analysisBatchService from './analysis-batch.service';

const getBatchIdParam = (request: Request): string => {
  const { batchId } = request.params;

  if (typeof batchId !== 'string' || !batchId) {
    throw new AppError('batchId parameter is required.', 400);
  }

  return batchId;
};

export const createAnalysisBatch = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await analysisBatchService.createAnalysisBatchForUser(
    analysisBatchService.getAuthenticatedUserId(request),
    request.body,
  );

  return response.status(202).json(result);
};

export const getAnalysisBatch = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await analysisBatchService.getAnalysisBatchForUser(
    analysisBatchService.getAuthenticatedUserId(request),
    getBatchIdParam(request),
  );

  return response.status(200).json(result);
};

export const getAnalysisBatchGames = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const includePgn = request.query.includePgn === 'true';
  const result = await analysisBatchService.getAnalysisBatchGamesForUser(
    analysisBatchService.getAuthenticatedUserId(request),
    getBatchIdParam(request),
    includePgn,
  );

  return response.status(200).json(result);
};

export const getAnalyzedGameIds = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await analysisBatchService.getAnalyzedGameIdsForUser(
    analysisBatchService.getAuthenticatedUserId(request),
    request.query.source,
    request.query.scope,
  );

  return response.status(200).json(result);
};

export const triggerAnalysisBatchProfileUpdate = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await analysisBatchService.triggerProfileUpdateForBatch(
    analysisBatchService.getAuthenticatedUserId(request),
    getBatchIdParam(request),
  );

  return response.status(200).json(result);
};

export const revertAnalysisBatchProfileImpact = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await analysisBatchService.revertBatchProfileImpact(
    analysisBatchService.getAuthenticatedUserId(request),
    getBatchIdParam(request),
  );

  return response.status(200).json(result);
};
