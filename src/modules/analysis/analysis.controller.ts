import { existsSync } from 'node:fs';

import { Request, Response } from 'express';

import { env } from '../../config/env';
import { analyzePgnGames } from './analysis.service';

const getBodyKeys = (body: unknown): string[] => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.keys(body);
};

export const analyzePgn = async (request: Request, response: Response): Promise<Response> => {
  console.log('[analysis/pgn] request received');
  console.log('[analysis/pgn] body keys:', getBodyKeys(request.body));
  console.log(
    '[analysis/pgn] games count:',
    Array.isArray(request.body?.games) ? request.body.games.length : 0,
  );
  console.log('[analysis/pgn] STOCKFISH_PATH:', process.env.STOCKFISH_PATH || 'not defined');

  const analysis = await analyzePgnGames(request.body);

  return response.status(200).json(analysis);
};

export const pingAnalysisRoute = (_request: Request, response: Response): Response => {
  return response.status(200).json({
    status: 'analysis route alive',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'unknown',
  });
};

export const getStockfishHealth = (_request: Request, response: Response): Response => {
  const stockfishPath = process.env.STOCKFISH_PATH || '';

  return response.status(200).json({
    stockfishPathConfigured: Boolean(stockfishPath),
    stockfishPath: stockfishPath || null,
    stockfishExists: stockfishPath ? existsSync(stockfishPath) : false,
    vercel: process.env.VERCEL === '1',
    nodeEnv: env.nodeEnv,
  });
};
