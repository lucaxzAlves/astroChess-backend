import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import type { UserRole } from '../../models/User';
import { AppError } from '../../utils/AppError';
import { AuthRequest } from './auth.types';

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

const resolveAuthenticatedUser = (request: AuthRequest): void => {
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
  } catch {
    throw new AppError('Unauthorized', 401);
  }
};

export const authenticate: RequestHandler = (
  request,
  _response,
  next,
): void => {
  resolveAuthenticatedUser(request as AuthRequest);
  next();
};

export const authenticateOptional: RequestHandler = (request, _response, next): void => {
  const authRequest = request as AuthRequest;
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  resolveAuthenticatedUser(authRequest);
  next();
};

export const requireAdmin: RequestHandler = (request, _response, next): void => {
  const authRequest = request as AuthRequest;

  if (!authRequest.user) {
    throw new AppError('Unauthorized', 401);
  }

  if (authRequest.user.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }

  next();
};
