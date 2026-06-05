import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import type { AuthRequest } from '../auth/auth.types';
import * as masterReplayService from './master-replay.service';

const getAuthenticatedUserId = (request: Request): string => {
  const authRequest = request as AuthRequest;

  if (!authRequest.user?.userId) {
    throw new AppError('Unauthorized', 401);
  }

  return authRequest.user.userId;
};

const canPreview = (request: Request): boolean => {
  const authRequest = request as AuthRequest;
  return Boolean(authRequest.user?.userId);
};

const getRequiredParam = (request: Request, fieldName: string): string => {
  const value = request.params[fieldName];

  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} parameter is required.`, 400);
  }

  return value.trim();
};

export const createGame = async (request: Request, response: Response): Promise<Response> => {
  const data = await masterReplayService.createGame(getAuthenticatedUserId(request), request.body);
  return response.status(201).json({ success: true, data });
};

export const listGames = async (request: Request, response: Response): Promise<Response> => {
  const data = await masterReplayService.listGames(request.query, canPreview(request));
  return response.status(200).json({ success: true, data });
};

export const getGameById = async (request: Request, response: Response): Promise<Response> => {
  const data = await masterReplayService.getGameById(
    getRequiredParam(request, 'gameId'),
    canPreview(request),
  );
  return response.status(200).json({ success: true, data });
};

export const updateGame = async (request: Request, response: Response): Promise<Response> => {
  const data = await masterReplayService.updateGame(
    getRequiredParam(request, 'gameId'),
    request.body,
  );
  return response.status(200).json({ success: true, data });
};

export const deleteGame = async (request: Request, response: Response): Promise<Response> => {
  const data = await masterReplayService.archiveGame(getRequiredParam(request, 'gameId'));
  return response.status(200).json({ success: true, data });
};

export const addAnnotatedMove = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await masterReplayService.addAnnotatedMove(
    getRequiredParam(request, 'gameId'),
    request.body,
  );
  return response.status(201).json({ success: true, data });
};

export const updateAnnotatedMove = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await masterReplayService.updateAnnotatedMove(
    getRequiredParam(request, 'gameId'),
    getRequiredParam(request, 'ply'),
    request.body,
  );
  return response.status(200).json({ success: true, data });
};

export const deleteAnnotatedMove = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await masterReplayService.deleteAnnotatedMove(
    getRequiredParam(request, 'gameId'),
    getRequiredParam(request, 'ply'),
  );
  return response.status(200).json({ success: true, data });
};

export const addKeyMoment = async (request: Request, response: Response): Promise<Response> => {
  const data = await masterReplayService.addKeyMoment(
    getRequiredParam(request, 'gameId'),
    request.body,
  );
  return response.status(201).json({ success: true, data });
};

export const updateKeyMoment = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await masterReplayService.updateKeyMoment(
    getRequiredParam(request, 'gameId'),
    getRequiredParam(request, 'momentId'),
    request.body,
  );
  return response.status(200).json({ success: true, data });
};

export const deleteKeyMoment = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await masterReplayService.deleteKeyMoment(
    getRequiredParam(request, 'gameId'),
    getRequiredParam(request, 'momentId'),
  );
  return response.status(200).json({ success: true, data });
};

export const playGameById = async (request: Request, response: Response): Promise<Response> => {
  const game = await masterReplayService.getPlayableGameById(
    getRequiredParam(request, 'gameId'),
    canPreview(request),
  );
  return response.status(200).json({ success: true, data: { game } });
};

export const playGameBySlug = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const game = await masterReplayService.getPlayableGameBySlug(
    getRequiredParam(request, 'slug'),
    canPreview(request),
  );
  return response.status(200).json({ success: true, data: { game } });
};

