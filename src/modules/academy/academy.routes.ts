import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import { authenticate, requireAdmin } from '../auth/auth.middleware';
import * as academyController from './academy.controller';

export const academyRoutes = Router();

academyRoutes.post(
  '/academy/paths',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.createPath),
);
academyRoutes.get('/academy/paths', asyncHandler(academyController.listPaths));
academyRoutes.get('/academy/paths/:pathId/full', asyncHandler(academyController.getFullPath));
academyRoutes.get('/academy/paths/:pathId', asyncHandler(academyController.getPathById));
academyRoutes.patch(
  '/academy/paths/:pathId',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.updatePath),
);
academyRoutes.delete(
  '/academy/paths/:pathId',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.deletePath),
);

academyRoutes.post(
  '/academy/modules',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.createModule),
);
academyRoutes.get('/academy/modules', asyncHandler(academyController.listModules));
academyRoutes.get('/academy/modules/:moduleId', asyncHandler(academyController.getModuleById));
academyRoutes.get(
  '/academy/paths/:pathId/modules',
  asyncHandler(academyController.getModulesByPath),
);
academyRoutes.patch(
  '/academy/modules/:moduleId',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.updateModule),
);
academyRoutes.delete(
  '/academy/modules/:moduleId',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.deleteModule),
);

academyRoutes.post(
  '/academy/lessons',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.createLesson),
);
academyRoutes.get('/academy/lessons', asyncHandler(academyController.listLessons));
academyRoutes.get('/academy/lessons/:lessonId', asyncHandler(academyController.getLessonById));
academyRoutes.get(
  '/academy/modules/:moduleId/lessons',
  asyncHandler(academyController.getLessonsByModule),
);
academyRoutes.patch(
  '/academy/lessons/:lessonId',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.updateLesson),
);
academyRoutes.delete(
  '/academy/lessons/:lessonId',
  authenticate,
  requireAdmin,
  asyncHandler(academyController.deleteLesson),
);
