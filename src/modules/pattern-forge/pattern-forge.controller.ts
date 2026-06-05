import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import type { AuthRequest } from '../auth/auth.types';
import {
  completePatternForgeSession,
  createPatternForgeCycle,
  getActivePatternForgeCycle,
  getAvailablePatternForgeThemes,
  submitPatternForgeAttempt,
} from './pattern-forge.service';

const getAuthenticatedUserId = (request: Request): string => {
  const authRequest = request as AuthRequest;

  if (!authRequest.user?.userId) {
    throw new AppError('Unauthorized', 401);
  }

  return authRequest.user.userId;
};

export const createCycle = async (request: Request, response: Response): Promise<Response> => {
  const result = await createPatternForgeCycle(getAuthenticatedUserId(request), request.body);
  return response.status(201).json(result);
};

export const getActiveCycle = async (request: Request, response: Response): Promise<Response> => {
  const username =
    typeof request.query.username === 'string' ? request.query.username.trim() : undefined;
  const result = await getActivePatternForgeCycle(getAuthenticatedUserId(request), username);
  return response.status(200).json(result);
};

export const getAvailableThemes = async (
  _request: Request,
  response: Response,
): Promise<Response> => {
  const result = await getAvailablePatternForgeThemes();
  return response.status(200).json(result);
};

export const submitAttempt = async (request: Request, response: Response): Promise<Response> => {
  const result = await submitPatternForgeAttempt(getAuthenticatedUserId(request), request.body);
  return response.status(200).json(result);
};

export const completeSession = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const { sessionId } = request.params;

  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new AppError('sessionId parameter is required.', 400);
  }

  const result = await completePatternForgeSession(getAuthenticatedUserId(request), sessionId);
  return response.status(200).json(result);
};
