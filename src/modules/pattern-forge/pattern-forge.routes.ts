import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../auth/auth.middleware';
import {
  completeSession,
  createCycle,
  getActiveCycle,
  getAvailableThemes,
  submitAttempt,
} from './pattern-forge.controller';

export const patternForgeRoutes = Router();

patternForgeRoutes.use(authenticate);
patternForgeRoutes.post('/pattern-forge/cycles', asyncHandler(createCycle));
patternForgeRoutes.get('/pattern-forge/cycles/active', asyncHandler(getActiveCycle));
patternForgeRoutes.get('/pattern-forge/themes', asyncHandler(getAvailableThemes));
patternForgeRoutes.post('/pattern-forge/attempts', asyncHandler(submitAttempt));
patternForgeRoutes.post('/pattern-forge/sessions/:sessionId/complete', asyncHandler(completeSession));
