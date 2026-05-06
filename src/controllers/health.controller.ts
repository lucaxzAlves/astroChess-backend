import { Request, Response } from 'express';

export const getHealth = (_request: Request, response: Response): Response => {
  return response.status(200).json({
    status: 'ok',
    service: 'aura-chess-backend',
    timestamp: new Date().toISOString(),
  });
};
