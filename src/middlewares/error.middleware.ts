import { NextFunction, Request, Response } from 'express';

type HttpError = Error & {
  statusCode?: number;
  status?: number;
  details?: unknown;
  type?: string;
  code?: number | string;
  errors?: unknown;
};

const isProduction = process.env.NODE_ENV === 'production';
const exposeDetails = process.env.EXPOSE_ERROR_DETAILS === 'true';

const getStatusCode = (error: HttpError): number => {
  if (error.statusCode || error.status) {
    return error.statusCode ?? error.status ?? 500;
  }

  if (error.name === 'ValidationError' || error.name === 'CastError' || error.code === 11000) {
    return 400;
  }

  return 500;
};

const isTechnicalMessage = (message = ''): boolean =>
  /(^|\b)(config|options|body|payload|Field|players|replayMode|annotatedMoves|keyMoments|profileDelta)\b/i.test(message) ||
  /must be|is required|not found for this cycle|Cast|ObjectId|Validation failed/i.test(message);

const getPublicMessage = (error: HttpError, statusCode: number): string => {
  if (statusCode === 401) return 'Entre novamente para continuar.';
  if (statusCode === 403) return 'Você não tem permissão para fazer essa ação.';
  if (statusCode === 404) return 'Não encontramos o conteúdo solicitado.';
  if (statusCode === 409) return error.message || 'Este item já existe ou já foi processado.';

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return 'Algumas informações estão incompletas ou inválidas. Revise o formulário e tente novamente.';
  }

  if (error.code === 11000) {
    return 'Já existe um registro com essas informações.';
  }

  if (isTechnicalMessage(error.message)) {
    return 'Algumas informações estão incompletas ou inválidas. Revise os dados e tente novamente.';
  }

  if (statusCode >= 500) {
    return 'Algo deu errado no servidor. Tente novamente em instantes.';
  }

  return error.message || 'Não foi possível concluir esta solicitação.';
};

export const errorMiddleware = (
  error: HttpError,
  _request: Request,
  response: Response,
  _next: NextFunction,
): Response => {
  console.error('[ERROR]', error);

  const statusCode = getStatusCode(error);
  const message = getPublicMessage(error, statusCode);
  const shouldExposeDetails = exposeDetails && !isProduction;

  const payload: Record<string, unknown> = {
    success: false,
    error: message,
  };

  if (shouldExposeDetails) {
    payload.details =
      error.details ??
      error.errors ??
      (error instanceof Error ? error.message : typeof error === 'string' ? error : undefined);
  }

  return response.status(statusCode).json(payload);
};
