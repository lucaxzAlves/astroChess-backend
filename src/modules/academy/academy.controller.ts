import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import type { AuthRequest } from '../auth/auth.types';
import * as academyService from './academy.service';

const getAuthenticatedUserId = (request: Request): string => {
  const authRequest = request as AuthRequest;

  if (!authRequest.user?.userId) {
    throw new AppError('Unauthorized', 401);
  }

  return authRequest.user.userId;
};

const getRequiredParam = (request: Request, fieldName: string): string => {
  const value = request.params[fieldName];

  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} parameter is required.`, 400);
  }

  return value.trim();
};

export const createPath = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.createPath(getAuthenticatedUserId(request), request.body);

  return response.status(201).json({
    success: true,
    data,
  });
};

export const listPaths = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.listPaths(request.query);

  return response.status(200).json({
    success: true,
    data,
  });
};

export const getPathById = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.getPathById(getRequiredParam(request, 'pathId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const updatePath = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.updatePath(getRequiredParam(request, 'pathId'), request.body);

  return response.status(200).json({
    success: true,
    data,
  });
};

export const deletePath = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.deletePath(getRequiredParam(request, 'pathId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const createModule = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.createModule(request.body);

  return response.status(201).json({
    success: true,
    data,
  });
};

export const listModules = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.listModules(request.query);

  return response.status(200).json({
    success: true,
    data,
  });
};

export const getModuleById = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.getModuleById(getRequiredParam(request, 'moduleId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const getModulesByPath = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await academyService.getModulesByPath(getRequiredParam(request, 'pathId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const updateModule = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.updateModule(
    getRequiredParam(request, 'moduleId'),
    request.body,
  );

  return response.status(200).json({
    success: true,
    data,
  });
};

export const deleteModule = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.deleteModule(getRequiredParam(request, 'moduleId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const createLesson = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.createLesson(request.body);

  return response.status(201).json({
    success: true,
    data,
  });
};

export const listLessons = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.listLessons(request.query);

  return response.status(200).json({
    success: true,
    data,
  });
};

export const getLessonById = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.getLessonById(getRequiredParam(request, 'lessonId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const getLessonsByModule = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  const data = await academyService.getLessonsByModule(getRequiredParam(request, 'moduleId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const updateLesson = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.updateLesson(
    getRequiredParam(request, 'lessonId'),
    request.body,
  );

  return response.status(200).json({
    success: true,
    data,
  });
};

export const deleteLesson = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.deleteLesson(getRequiredParam(request, 'lessonId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

export const getFullPath = async (request: Request, response: Response): Promise<Response> => {
  const data = await academyService.getFullPath(getRequiredParam(request, 'pathId'));

  return response.status(200).json({
    success: true,
    data,
  });
};

