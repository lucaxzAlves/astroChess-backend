import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../auth/auth.middleware';
import * as playerProfileVersionController from './player-profile-version.controller';

export const playerProfileVersionRoutes = Router();

playerProfileVersionRoutes.get(
  '/player-profile/versions',
  authenticate,
  asyncHandler(playerProfileVersionController.listMyPlayerProfileVersions),
);
playerProfileVersionRoutes.get(
  '/player-profile/versions/:versionId',
  authenticate,
  asyncHandler(playerProfileVersionController.getMyPlayerProfileVersion),
);
playerProfileVersionRoutes.get(
  '/player-profile/versions/:versionId/profile-view',
  authenticate,
  asyncHandler(playerProfileVersionController.getMyPlayerProfileVersionProfileView),
);
playerProfileVersionRoutes.post(
  '/player-profile/versions/:versionId/restore',
  authenticate,
  asyncHandler(playerProfileVersionController.restoreMyPlayerProfileVersion),
);
