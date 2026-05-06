import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import * as playerProfileService from './player-profile.service';

const getAuthenticatedUserId = (request: Request): string => {
  if (!request.user?.id) {
    throw new AppError('Unauthorized', 401);
  }

  return request.user.id;
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
