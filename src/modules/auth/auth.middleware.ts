import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import type { UserRole } from '../../models/User';
import { AppError } from '../../utils/AppError';

type AuthJwtPayload = {
  sub: string;
  role: UserRole;
};

const isAuthJwtPayload = (value: unknown): value is AuthJwtPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.sub === 'string' &&
    (candidate.role === 'user' || candidate.role === 'admin')
  );
};

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
    const decoded = jwt.verify(token, ensureJwtSecret());

    if (!isAuthJwtPayload(decoded)) {
      throw new AppError('Unauthorized', 401);
    }

    request.user = {
      userId: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch {
    throw new AppError('Unauthorized', 401);
  }
};
