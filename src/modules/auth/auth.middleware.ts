import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { JwtPayload } from './auth.types';

const ensureJwtSecret = (): string => {
  if (!env.jwtSecret) {
    throw new AppError('JWT_SECRET is not defined', 500);
  }

  return env.jwtSecret;
};

export const authenticate = (request: Request, _response: Response, next: NextFunction): void => {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new AppError('Unauthorized', 401);
  }

  const token = authorizationHeader.replace('Bearer ', '').trim();

  if (!token) {
    throw new AppError('Unauthorized', 401);
  }

  try {
    const decoded = jwt.verify(token, ensureJwtSecret()) as JwtPayload;

    request.user = {
      userId: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch {
    throw new AppError('Unauthorized', 401);
  }
};
