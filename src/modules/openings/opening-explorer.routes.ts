import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../auth/auth.middleware';
import * as openingExplorerController from './opening-explorer.controller';

export const openingExplorerRoutes = Router();

openingExplorerRoutes.get(
  '/openings',
  authenticate,
  asyncHandler(openingExplorerController.getOpeningExplorerRoot),
);
openingExplorerRoutes.get(
  '/openings/node',
  authenticate,
  asyncHandler(openingExplorerController.getOpeningExplorerNode),
);
openingExplorerRoutes.post(
  '/openings/path',
  authenticate,
  asyncHandler(openingExplorerController.getOpeningExplorerPath),
);
openingExplorerRoutes.get(
  '/openings/summary',
  authenticate,
  asyncHandler(openingExplorerController.getOpeningExplorerSummary),
);
openingExplorerRoutes.get(
  '/openings/insights',
  authenticate,
  asyncHandler(openingExplorerController.getOpeningExplorerInsights),
);
