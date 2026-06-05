import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate, requireAdmin } from '../auth/auth.middleware';
import * as tournamentController from './tournament.controller';

export const tournamentRoutes = Router();

tournamentRoutes.post('/tournaments/sync', asyncHandler(tournamentController.syncTournaments));
tournamentRoutes.get('/tournaments/search', asyncHandler(tournamentController.searchTournaments));
tournamentRoutes.post(
  '/tournaments/refresh',
  authenticate,
  requireAdmin,
  asyncHandler(tournamentController.refreshTournaments),
);
tournamentRoutes.post(
  '/tournaments/debug/extract-date',
  asyncHandler(tournamentController.debugExtractDate),
);
tournamentRoutes.get(
  '/tournaments/meta/filters',
  asyncHandler(tournamentController.getTournamentFilters),
);
tournamentRoutes.get('/tournaments', asyncHandler(tournamentController.listTournaments));
tournamentRoutes.get('/tournaments/:id', asyncHandler(tournamentController.getTournament));
