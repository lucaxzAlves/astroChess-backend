import { Request, Response } from 'express';

import * as tournamentService from './tournament.service';

export const syncTournaments = async (_request: Request, response: Response): Promise<Response> => {
  // TODO: protect this endpoint with admin authentication before production use.
  const metrics = await tournamentService.syncTournamentsFromSources();

  return response.status(200).json(metrics);
};

export const listTournaments = async (request: Request, response: Response): Promise<Response> => {
  const result = await tournamentService.listTournaments(request.query);

  return response.status(200).json(result);
};

export const getTournament = async (request: Request, response: Response): Promise<Response> => {
  const tournament = await tournamentService.getTournament(String(request.params.id));

  return response.status(200).json(tournament);
};

export const getTournamentFilters = async (
  _request: Request,
  response: Response,
): Promise<Response> => {
  const filters = await tournamentService.getTournamentFilters();

  return response.status(200).json(filters);
};

export const debugExtractDate = async (request: Request, response: Response): Promise<Response> => {
  const text = typeof request.body?.text === 'string' ? request.body.text : '';
  const result = tournamentService.debugExtractDate(text);

  return response.status(200).json(result);
};
