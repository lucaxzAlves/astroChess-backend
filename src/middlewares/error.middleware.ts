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
  console.error('[ERROR]', error);

  const statusCode = error.statusCode ?? error.status ?? 500;
  const message =
    statusCode === 500 && !error.statusCode
      ? 'Internal server error'
      : error.message || 'Internal server error';

  return response.status(statusCode).json({
    success: false,
    error: message,
    details:
      error.details ??
      (error instanceof Error ? error.message : typeof error === 'string' ? error : undefined),
  });
};
