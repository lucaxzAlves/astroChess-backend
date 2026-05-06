import { Request, Response } from 'express';

import * as authService from './auth.service';

export const register = async (request: Request, response: Response): Promise<Response> => {
  const authResponse = await authService.register(request.body);

  return response.status(201).json(authResponse);
};

export const login = async (request: Request, response: Response): Promise<Response> => {
  const authResponse = await authService.login(request.body);

  return response.status(200).json(authResponse);
};
