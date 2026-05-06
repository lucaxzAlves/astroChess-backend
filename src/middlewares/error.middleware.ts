import { NextFunction, Request, Response } from 'express';

type HttpError = Error & {
  statusCode?: number;
  status?: number;
  details?: unknown;
  type?: string;
};

export const errorMiddleware = (
  error: HttpError,
  _request: Request,
  response: Response,
  _next: NextFunction,
): Response => {
  const statusCode = error.statusCode ?? error.status ?? 500;
  const message =
    statusCode === 500 && !error.statusCode
      ? 'Internal server error'
      : error.message || 'Internal server error';

  return response.status(statusCode).json({
    message,
    ...(error.details ? { details: error.details } : {}),
  });
};
