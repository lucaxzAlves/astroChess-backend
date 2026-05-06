import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import * as authController from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/auth/register', asyncHandler(authController.register));
authRoutes.post('/auth/login', asyncHandler(authController.login));
