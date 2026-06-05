import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { AuthRequest } from '../auth/auth.types';
import * as openingExplorerService from './opening-explorer.service';

const getAuthenticatedUserId = (request: Request): string => {
  const authRequest = request as AuthRequest;

  if (!authRequest.user?.userId) {
    throw new AppError('Unauthorized', 401);
  }

  return authRequest.user.userId;
};

const getFenQuery = (request: Request): string | undefined => {
  const { fen } = request.query;

  if (fen === undefined) {
    return undefined;
  }

  if (typeof fen !== 'string') {
    throw new AppError('fen must be a string when provided.', 400);
  }

  return fen;
};

export const getOpeningExplorerRoot = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await openingExplorerService.getOpeningExplorerRoot(getAuthenticatedUserId(request));

  return response.status(200).json(data);
};

export const getOpeningExplorerNode = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await openingExplorerService.getOpeningExplorerNode(
    getAuthenticatedUserId(request),
    getFenQuery(request),
  );

  return response.status(200).json(data);
};

export const getOpeningExplorerPath = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await openingExplorerService.getOpeningExplorerPath(
    getAuthenticatedUserId(request),
    request.body,
  );

  return response.status(200).json(data);
};

export const getOpeningExplorerSummary = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await openingExplorerService.getOpeningExplorerSummary(
    getAuthenticatedUserId(request),
  );

  return response.status(200).json(data);
};

export const getOpeningExplorerInsights = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await openingExplorerService.getOpeningExplorerInsights(
    getAuthenticatedUserId(request),
    getFenQuery(request),
  );

  return response.status(200).json(data);
};
