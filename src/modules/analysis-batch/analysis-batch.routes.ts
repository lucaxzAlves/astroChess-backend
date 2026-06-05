import { Router } from 'express';

import { authenticate } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import * as analysisBatchController from './analysis-batch.controller';

export const analysisBatchRoutes = Router();

analysisBatchRoutes.use(authenticate);

analysisBatchRoutes.post('/analysis/batch', asyncHandler(analysisBatchController.createAnalysisBatch));
analysisBatchRoutes.get(
  '/analysis/batch/analyzed-game-ids',
  asyncHandler(analysisBatchController.getAnalyzedGameIds),
);
analysisBatchRoutes.get(
  '/analysis/batch/:batchId/games',
  asyncHandler(analysisBatchController.getAnalysisBatchGames),
);
analysisBatchRoutes.post(
  '/analysis/batch/:batchId/profile-update',
  asyncHandler(analysisBatchController.triggerAnalysisBatchProfileUpdate),
);
analysisBatchRoutes.post(
  '/analysis/batch/:batchId/revert-profile-impact',
  asyncHandler(analysisBatchController.revertAnalysisBatchProfileImpact),
);
analysisBatchRoutes.get(
  '/analysis/batch/:batchId',
  asyncHandler(analysisBatchController.getAnalysisBatch),
);
