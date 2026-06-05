import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { AcademyLesson } from './academy-lesson.model';
import { AcademyModule } from './academy-module.model';
import { AcademyPath } from './academy-path.model';
import type {
  AcademyEntityStatus,
  AcademyLessonDocument,
  AcademyLessonListFilters,
  AcademyModuleDocument,
  AcademyModuleListFilters,
  AcademyPathDocument,
  AcademyPathListFilters,
} from './academy.types';

const toObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const withDefaultStatusFilter = (status?: AcademyEntityStatus): AcademyEntityStatus | { $ne: 'archived' } => {
  if (status) {
    return status;
  }

  return { $ne: 'archived' };
};

export const createPath = async (payload: Record<string, unknown>) => {
  return AcademyPath.create(payload);
};

export const findPathById = async (pathId: string) => {
  return AcademyPath.findById(toObjectId(pathId, 'path id')).exec();
};

export const findPathBySlug = async (slug: string) => {
  return AcademyPath.findOne({ slug }).exec();
};

export const listPaths = async (filters: AcademyPathListFilters) => {
  const query: Record<string, unknown> = {
    status: withDefaultStatusFilter(filters.status),
  };

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.level) {
    query.level = filters.level;
  }

  if (filters.search) {
    const pattern = new RegExp(escapeRegex(filters.search), 'i');
    query.$or = [
      { title: pattern },
      { subtitle: pattern },
      { description: pattern },
      { tags: pattern },
    ];
  }

  return AcademyPath.find(query).sort({ order: 1, createdAt: 1 }).exec();
};

export const savePath = async (path: AcademyPathDocument) => {
  return path.save();
};

export const countModulesByPath = async (pathId: Types.ObjectId) => {
  return AcademyModule.countDocuments({
    pathId,
    status: { $ne: 'archived' },
  }).exec();
};

export const countLessonsByPath = async (pathId: Types.ObjectId) => {
  return AcademyLesson.countDocuments({
    pathId,
    status: { $ne: 'archived' },
  }).exec();
};

export const createModule = async (payload: Record<string, unknown>) => {
  return AcademyModule.create(payload);
};

export const findModuleById = async (moduleId: string) => {
  return AcademyModule.findById(toObjectId(moduleId, 'module id')).exec();
};

export const findModuleByPathAndSlug = async (pathId: string | Types.ObjectId, slug: string) => {
  return AcademyModule.findOne({
    pathId: typeof pathId === 'string' ? toObjectId(pathId, 'path id') : pathId,
    slug,
  }).exec();
};

export const listModules = async (filters: AcademyModuleListFilters) => {
  const query: Record<string, unknown> = {
    status: withDefaultStatusFilter(filters.status),
  };

  if (filters.pathId) {
    query.pathId = toObjectId(filters.pathId, 'path id');
  }

  return AcademyModule.find(query).sort({ order: 1, createdAt: 1 }).exec();
};

export const saveModule = async (module: AcademyModuleDocument) => {
  return module.save();
};

export const createLesson = async (payload: Record<string, unknown>) => {
  return AcademyLesson.create(payload);
};

export const findLessonById = async (lessonId: string) => {
  return AcademyLesson.findById(toObjectId(lessonId, 'lesson id')).exec();
};

export const findLessonByModuleAndSlug = async (
  moduleId: string | Types.ObjectId,
  slug: string,
) => {
  return AcademyLesson.findOne({
    moduleId: typeof moduleId === 'string' ? toObjectId(moduleId, 'module id') : moduleId,
    slug,
  }).exec();
};

export const listLessons = async (filters: AcademyLessonListFilters) => {
  const query: Record<string, unknown> = {
    status: withDefaultStatusFilter(filters.status),
  };

  if (filters.pathId) {
    query.pathId = toObjectId(filters.pathId, 'path id');
  }

  if (filters.moduleId) {
    query.moduleId = toObjectId(filters.moduleId, 'module id');
  }

  if (filters.lessonType) {
    query.lessonType = filters.lessonType;
  }

  if (filters.tag) {
    query.tags = filters.tag;
  }

  if (filters.keyConcept) {
    query.keyConcepts = filters.keyConcept;
  }

  return AcademyLesson.find(query).sort({ order: 1, createdAt: 1 }).exec();
};

export const saveLesson = async (lesson: AcademyLessonDocument) => {
  return lesson.save();
};

export const listLessonsByModule = async (
  moduleId: string | Types.ObjectId,
  status?: AcademyEntityStatus,
) => {
  return AcademyLesson.find({
    moduleId: typeof moduleId === 'string' ? toObjectId(moduleId, 'module id') : moduleId,
    status: withDefaultStatusFilter(status),
  })
    .sort({ order: 1, createdAt: 1 })
    .exec();
};

export const listModulesByPath = async (
  pathId: string | Types.ObjectId,
  status?: AcademyEntityStatus,
) => {
  return AcademyModule.find({
    pathId: typeof pathId === 'string' ? toObjectId(pathId, 'path id') : pathId,
    status: withDefaultStatusFilter(status),
  })
    .sort({ order: 1, createdAt: 1 })
    .exec();
};
