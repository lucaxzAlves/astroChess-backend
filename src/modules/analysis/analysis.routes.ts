import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { analyzePgn } from './analysis.controller';

export const analysisRoutes = Router();

analysisRoutes.post('/analysis/pgn', asyncHandler(analyzePgn));
