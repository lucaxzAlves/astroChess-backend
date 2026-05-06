import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../auth/auth.middleware';
import * as playerProfileController from './player-profile.controller';

export const playerProfileRoutes = Router();

playerProfileRoutes.get(
  '/player-profile/me',
  authenticate,
  asyncHandler(playerProfileController.getMyPlayerProfile),
);
playerProfileRoutes.patch(
  '/player-profile/me/preferences',
  authenticate,
  asyncHandler(playerProfileController.updateMyPlayerProfilePreferences),
);
