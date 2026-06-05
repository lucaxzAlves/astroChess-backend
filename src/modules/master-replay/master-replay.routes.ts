import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate, authenticateOptional, requireAdmin } from '../auth/auth.middleware';
import * as masterReplayController from './master-replay.controller';

export const masterReplayRoutes = Router();

masterReplayRoutes.post(
  '/master-replay/games',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.createGame),
);
masterReplayRoutes.get(
  '/master-replay/games',
  authenticateOptional,
  asyncHandler(masterReplayController.listGames),
);
masterReplayRoutes.get(
  '/master-replay/games/:gameId',
  authenticateOptional,
  asyncHandler(masterReplayController.getGameById),
);
masterReplayRoutes.patch(
  '/master-replay/games/:gameId',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.updateGame),
);
masterReplayRoutes.delete(
  '/master-replay/games/:gameId',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.deleteGame),
);

masterReplayRoutes.post(
  '/master-replay/games/:gameId/annotated-moves',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.addAnnotatedMove),
);
masterReplayRoutes.patch(
  '/master-replay/games/:gameId/annotated-moves/:ply',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.updateAnnotatedMove),
);
masterReplayRoutes.delete(
  '/master-replay/games/:gameId/annotated-moves/:ply',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.deleteAnnotatedMove),
);

masterReplayRoutes.post(
  '/master-replay/games/:gameId/key-moments',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.addKeyMoment),
);
masterReplayRoutes.patch(
  '/master-replay/games/:gameId/key-moments/:momentId',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.updateKeyMoment),
);
masterReplayRoutes.delete(
  '/master-replay/games/:gameId/key-moments/:momentId',
  authenticate,
  requireAdmin,
  asyncHandler(masterReplayController.deleteKeyMoment),
);

masterReplayRoutes.get(
  '/master-replay/games/:gameId/play',
  authenticateOptional,
  asyncHandler(masterReplayController.playGameById),
);
masterReplayRoutes.get(
  '/master-replay/games/slug/:slug/play',
  authenticateOptional,
  asyncHandler(masterReplayController.playGameBySlug),
);

