import { Request, Response } from 'express';

import { analyzePgnGames } from './analysis.service';

export const analyzePgn = async (request: Request, response: Response): Promise<Response> => {
  const analysis = await analyzePgnGames(request.body);

  return response.status(200).json(analysis);
};
