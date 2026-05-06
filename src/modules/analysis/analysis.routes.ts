import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { analyzePgn, getStockfishHealth, pingAnalysisRoute } from './analysis.controller';

export const analysisRoutes = Router();

analysisRoutes.get('/analysis/ping', pingAnalysisRoute);
analysisRoutes.get('/analysis/stockfish-health', getStockfishHealth);
analysisRoutes.post('/analysis/pgn', asyncHandler(analyzePgn));
