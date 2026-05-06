import { Router } from 'express';

import { analysisRoutes } from '../modules/analysis/analysis.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { playerProfileRoutes } from '../modules/player-profile/player-profile.routes';
import { tournamentRoutes } from '../modules/tournaments/tournament.routes';
import { healthRoutes } from './health.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(analysisRoutes);
routes.use(playerProfileRoutes);
routes.use(tournamentRoutes);
