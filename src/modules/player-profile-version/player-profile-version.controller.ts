import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { AuthRequest } from '../auth/auth.types';
import * as playerProfileVersionService from './player-profile-version.service';

const getAuthenticatedUserId = (request: Request): string => {
  const authRequest = request as AuthRequest;
  const user = authRequest.user;

  if (!user) {
    throw new AppError('Unauthorized', 401);
  }

  return user.userId;
};

const getVersionIdParam = (request: Request): string => {
  const { versionId } = request.params;

  if (typeof versionId !== 'string' || !versionId.trim()) {
    throw new AppError('versionId parameter is required.', 400);
  }

  return versionId;
};

export const listMyPlayerProfileVersions = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await playerProfileVersionService.listProfileVersions(
    getAuthenticatedUserId(request),
  );

  return response.status(200).json(result);
};

export const getMyPlayerProfileVersion = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await playerProfileVersionService.getProfileVersionDetails(
    getAuthenticatedUserId(request),
    getVersionIdParam(request),
  );

  return response.status(200).json(result);
};

export const restoreMyPlayerProfileVersion = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await playerProfileVersionService.restoreProfileVersion(
    getAuthenticatedUserId(request),
    getVersionIdParam(request),
  );

  return response.status(200).json({
    success: true,
    message: 'Profile version restored successfully.',
    restoredVersionId: result.restoredVersionId,
    newVersionId: result.newVersionId,
    profile: result.profile,
  });
};

export const getMyPlayerProfileVersionProfileView = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const result = await playerProfileVersionService.getProfileVersionProfileView(
    getAuthenticatedUserId(request),
    getVersionIdParam(request),
  );

  return response.status(200).json(result);
};
