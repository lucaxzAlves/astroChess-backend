import { Request, Response } from 'express';
import { env } from '../config/env';

export const getHealth = (_request: Request, response: Response): Response => {
  return response.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.nodeEnv,
  });
};
