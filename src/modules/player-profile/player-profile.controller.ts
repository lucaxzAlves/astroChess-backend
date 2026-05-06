import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { AuthRequest } from '../auth/auth.types';
import * as playerProfileService from './player-profile.service';

const getAuthenticatedUserId = (request: Request): string => {
  const authRequest = request as AuthRequest;
  const user = authRequest.user;

  if (!user) {
    throw new AppError('Unauthorized', 401);
  }

  return user.userId;
};

export const getMyPlayerProfile = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const profile = await playerProfileService.getOrCreatePlayerProfile(
    getAuthenticatedUserId(request),
  );

  return response.status(200).json(profile);
};

export const updateMyPlayerProfilePreferences = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const profile = await playerProfileService.updatePlayerProfileBasicInfo(
    getAuthenticatedUserId(request),
    request.body,
  );

  return response.status(200).json(profile);
};
