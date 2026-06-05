import { Router } from 'express';

import { analysisBatchRoutes } from '../modules/analysis-batch/analysis-batch.routes';
import { analysisRoutes } from '../modules/analysis/analysis.routes';
import { academyRoutes } from '../modules/academy/academy.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { masterReplayRoutes } from '../modules/master-replay/master-replay.routes';
import { openingExplorerRoutes } from '../modules/openings/opening-explorer.routes';
import { patternForgeRoutes } from '../modules/pattern-forge/pattern-forge.routes';
import { playerProfileRoutes } from '../modules/player-profile/player-profile.routes';
import { playerProfileVersionRoutes } from '../modules/player-profile-version/player-profile-version.routes';
import { tournamentRoutes } from '../modules/tournaments/tournament.routes';
import { healthRoutes } from './health.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(academyRoutes);
routes.use(masterReplayRoutes);
routes.use(openingExplorerRoutes);
routes.use(analysisRoutes);
routes.use(analysisBatchRoutes);
routes.use(patternForgeRoutes);
routes.use(playerProfileRoutes);
routes.use(playerProfileVersionRoutes);
routes.use(tournamentRoutes);
