import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import * as academyRepository from './academy.repository';
import type {
  AcademyEntityStatus,
  AcademyFullPathResponse,
  AcademyLessonDocument,
  AcademyLessonListFilters,
  AcademyLessonType,
  AcademyModuleDocument,
  AcademyModuleListFilters,
  AcademyPathCategory,
  AcademyPathDocument,
  AcademyPathLevel,
  AcademyPathListFilters,
} from './academy.types';

// TODO: add user progress per lesson.
// TODO: add real per-user unlock resolution.
// TODO: add lesson puzzle attempt tracking and analytics.
// TODO: split Master Replay into a richer dedicated domain if needed.
// TODO: integrate more deeply with Lichess puzzle metadata for generated practice.
// TODO: support uploaded images/assets for covers and study shelf items.

const PATH_LEVELS = new Set<AcademyPathLevel>([
  'beginner',
  'beginner_to_intermediate',
  'intermediate',
  'advanced',
]);
const PATH_CATEGORIES = new Set<AcademyPathCategory>([
  'calculation',
  'tactics',
  'strategy',
  'endgame',
  'opening',
  'defense',
  'attack',
]);
const ENTITY_STATUSES = new Set<AcademyEntityStatus>(['draft', 'published', 'archived']);
const LESSON_TYPES = new Set<AcademyLessonType>(['concept', 'model_game', 'practice', 'mixed']);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRequiredString = (value: unknown, fieldName: string): string => {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new AppError(`${fieldName} is required.`, 400);
  }

  return normalized;
};

const normalizeSlug = (value: unknown, fieldName: string): string => {
  return normalizeRequiredString(value, fieldName).toLowerCase();
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
};

const ensureObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

const ensurePath = async (pathId: string): Promise<AcademyPathDocument> => {
  const path = await academyRepository.findPathById(pathId);

  if (!path) {
    throw new AppError('Academy path not found.', 404);
  }

  return path;
};

const ensureModule = async (moduleId: string): Promise<AcademyModuleDocument> => {
  const module = await academyRepository.findModuleById(moduleId);

  if (!module) {
    throw new AppError('Academy module not found.', 404);
  }

  return module;
};

const ensureLesson = async (lessonId: string): Promise<AcademyLessonDocument> => {
  const lesson = await academyRepository.findLessonById(lessonId);

  if (!lesson) {
    throw new AppError('Academy lesson not found.', 404);
  }

  return lesson;
};

const ensurePathSlugAvailable = async (slug: string, currentPathId?: string): Promise<void> => {
  const existing = await academyRepository.findPathBySlug(slug);

  if (existing && existing._id.toString() !== currentPathId) {
    throw new AppError('Academy path slug already exists.', 409);
  }
};

const ensureModuleSlugAvailable = async (
  pathId: string | Types.ObjectId,
  slug: string,
  currentModuleId?: string,
): Promise<void> => {
  const existing = await academyRepository.findModuleByPathAndSlug(pathId, slug);

  if (existing && existing._id.toString() !== currentModuleId) {
    throw new AppError('Academy module slug already exists in this path.', 409);
  }
};

const ensureLessonSlugAvailable = async (
  moduleId: string | Types.ObjectId,
  slug: string,
  currentLessonId?: string,
): Promise<void> => {
  const existing = await academyRepository.findLessonByModuleAndSlug(moduleId, slug);

  if (existing && existing._id.toString() !== currentLessonId) {
    throw new AppError('Academy lesson slug already exists in this module.', 409);
  }
};

const validateEnum = <TValue extends string>(
  value: unknown,
  allowed: Set<TValue>,
  fieldName: string,
): TValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !allowed.has(value as TValue)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return value as TValue;
};

const refreshPathCounts = async (pathId: Types.ObjectId): Promise<void> => {
  const path = await academyRepository.findPathById(pathId.toString());

  if (!path) {
    return;
  }

  path.moduleCount = await academyRepository.countModulesByPath(pathId);
  path.lessonCount = await academyRepository.countLessonsByPath(pathId);
  await academyRepository.savePath(path);
};

const buildPathPayload = (body: unknown, createdBy?: string): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  const level = validateEnum(body.level, PATH_LEVELS, 'level');
  const category = validateEnum(body.category, PATH_CATEGORIES, 'category');

  if (!level || !category) {
    throw new AppError('level and category are required.', 400);
  }

  return {
    title: normalizeRequiredString(body.title, 'title'),
    slug: normalizeSlug(body.slug, 'slug'),
    subtitle: normalizeOptionalString(body.subtitle),
    description: normalizeRequiredString(body.description, 'description'),
    level,
    category,
    tags: normalizeStringArray(body.tags),
    durationWeeks: typeof body.durationWeeks === 'number' ? body.durationWeeks : undefined,
    moduleCount: typeof body.moduleCount === 'number' ? body.moduleCount : undefined,
    lessonCount: typeof body.lessonCount === 'number' ? body.lessonCount : undefined,
    status: validateEnum(body.status, ENTITY_STATUSES, 'status') ?? 'draft',
    order: typeof body.order === 'number' ? body.order : 0,
    cover: isRecord(body.cover) ? body.cover : undefined,
    createdBy: createdBy ? ensureObjectId(createdBy, 'user id') : undefined,
  };
};

const buildModulePayload = (body: unknown): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  const unlockRule =
    body.unlockRule !== undefined
      ? (() => {
          if (!isRecord(body.unlockRule)) {
            throw new AppError('unlockRule must be an object.', 400);
          }

          const unlockType = validateEnum(
            body.unlockRule.type,
            new Set(['always', 'previous_module_completed', 'manual']),
            'unlockRule.type',
          );

          if (!unlockType) {
            throw new AppError('unlockRule.type is required.', 400);
          }

          return {
            type: unlockType,
            requiredModuleId: normalizeOptionalString(body.unlockRule.requiredModuleId)
              ? ensureObjectId(
                  normalizeRequiredString(
                    body.unlockRule.requiredModuleId,
                    'unlockRule.requiredModuleId',
                  ),
                  'unlock rule module id',
                )
              : undefined,
          };
        })()
      : undefined;

  return {
    pathId: ensureObjectId(normalizeRequiredString(body.pathId, 'pathId'), 'path id'),
    title: normalizeRequiredString(body.title, 'title'),
    slug: normalizeSlug(body.slug, 'slug'),
    subtitle: normalizeOptionalString(body.subtitle),
    description: normalizeRequiredString(body.description, 'description'),
    label: normalizeOptionalString(body.label),
    order: typeof body.order === 'number' ? body.order : 0,
    estimatedLessons:
      typeof body.estimatedLessons === 'number' ? body.estimatedLessons : undefined,
    estimatedMinutes:
      typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : undefined,
    status: validateEnum(body.status, ENTITY_STATUSES, 'status') ?? 'draft',
    unlockRule,
  };
};

const buildLessonPayload = (body: unknown): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  const lessonType = validateEnum(body.lessonType, LESSON_TYPES, 'lessonType');

  if (!lessonType) {
    throw new AppError('lessonType is required.', 400);
  }

  if (!isRecord(body.coreIdea) || !normalizeOptionalString(body.coreIdea.summary)) {
    throw new AppError('coreIdea.summary is required.', 400);
  }

  return {
    pathId: ensureObjectId(normalizeRequiredString(body.pathId, 'pathId'), 'path id'),
    moduleId: ensureObjectId(normalizeRequiredString(body.moduleId, 'moduleId'), 'module id'),
    title: normalizeRequiredString(body.title, 'title'),
    slug: normalizeSlug(body.slug, 'slug'),
    subtitle: normalizeOptionalString(body.subtitle),
    description: normalizeOptionalString(body.description),
    order: typeof body.order === 'number' ? body.order : 0,
    status: validateEnum(body.status, ENTITY_STATUSES, 'status') ?? 'draft',
    lessonType,
    estimatedMinutes:
      typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : undefined,
    tags: normalizeStringArray(body.tags),
    keyConcepts: normalizeStringArray(body.keyConcepts),
    coreIdea: body.coreIdea,
    conceptPosition: isRecord(body.conceptPosition) ? body.conceptPosition : undefined,
    studyShelf: Array.isArray(body.studyShelf) ? body.studyShelf : undefined,
    gmModelGame: isRecord(body.gmModelGame) ? body.gmModelGame : undefined,
    targetedPractice: isRecord(body.targetedPractice) ? body.targetedPractice : undefined,
  };
};

export const createPath = async (userId: string, body: unknown) => {
  const payload = buildPathPayload(body, userId);
  await ensurePathSlugAvailable(String(payload.slug));

  const path = await academyRepository.createPath(payload);

  return path;
};

export const listPaths = async (query: Record<string, unknown>) => {
  const filters: AcademyPathListFilters = {
    status: validateEnum(query.status, ENTITY_STATUSES, 'status'),
    category: validateEnum(query.category, PATH_CATEGORIES, 'category'),
    level: validateEnum(query.level, PATH_LEVELS, 'level'),
    search: normalizeOptionalString(query.search),
  };

  return academyRepository.listPaths(filters);
};

export const getPathById = async (pathId: string) => {
  return ensurePath(pathId);
};

export const updatePath = async (pathId: string, body: unknown) => {
  const path = await ensurePath(pathId);

  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  if (body.slug !== undefined) {
    path.slug = normalizeSlug(body.slug, 'slug');
    await ensurePathSlugAvailable(path.slug, path._id.toString());
  }

  if (body.title !== undefined) {
    path.title = normalizeRequiredString(body.title, 'title');
  }

  if (body.subtitle !== undefined) {
    path.subtitle = normalizeOptionalString(body.subtitle);
  }

  if (body.description !== undefined) {
    path.description = normalizeRequiredString(body.description, 'description');
  }

  const level = validateEnum(body.level, PATH_LEVELS, 'level');
  if (level) {
    path.level = level;
  }

  const category = validateEnum(body.category, PATH_CATEGORIES, 'category');
  if (category) {
    path.category = category;
  }

  if (body.tags !== undefined) {
    path.tags = normalizeStringArray(body.tags);
  }

  if (body.durationWeeks !== undefined) {
    path.durationWeeks = typeof body.durationWeeks === 'number' ? body.durationWeeks : undefined;
  }

  if (body.status !== undefined) {
    path.status = validateEnum(body.status, ENTITY_STATUSES, 'status') ?? path.status;
  }

  if (body.order !== undefined && typeof body.order === 'number') {
    path.order = body.order;
  }

  if (body.cover !== undefined) {
    path.cover = isRecord(body.cover) ? (body.cover as AcademyPathDocument['cover']) : undefined;
  }

  return academyRepository.savePath(path);
};

export const deletePath = async (pathId: string) => {
  const path = await ensurePath(pathId);
  path.status = 'archived';
  return academyRepository.savePath(path);
};

export const createModule = async (body: unknown) => {
  const payload = buildModulePayload(body);
  const pathId = payload.pathId as Types.ObjectId;
  const slug = String(payload.slug);
  await ensurePath(pathId.toString());
  await ensureModuleSlugAvailable(pathId, slug);

  if (isRecord(payload.unlockRule) && payload.unlockRule.requiredModuleId) {
    const requiredModule = await ensureModule(String(payload.unlockRule.requiredModuleId));

    if (requiredModule.pathId.toString() !== pathId.toString()) {
      throw new AppError('unlockRule.requiredModuleId must belong to the same path.', 400);
    }
  }

  const module = await academyRepository.createModule(payload);
  await refreshPathCounts(pathId);
  return module;
};

export const listModules = async (query: Record<string, unknown>) => {
  const filters: AcademyModuleListFilters = {
    pathId: normalizeOptionalString(query.pathId),
    status: validateEnum(query.status, ENTITY_STATUSES, 'status'),
  };

  return academyRepository.listModules(filters);
};

export const getModuleById = async (moduleId: string) => {
  return ensureModule(moduleId);
};

export const getModulesByPath = async (pathId: string) => {
  await ensurePath(pathId);
  return academyRepository.listModulesByPath(pathId);
};

export const updateModule = async (moduleId: string, body: unknown) => {
  const module = await ensureModule(moduleId);
  const previousPathId = module.pathId.toString();

  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  let nextPathId = module.pathId;

  if (body.pathId !== undefined) {
    nextPathId = ensureObjectId(normalizeRequiredString(body.pathId, 'pathId'), 'path id');
    await ensurePath(nextPathId.toString());
    module.pathId = nextPathId;
  }

  if (body.slug !== undefined) {
    module.slug = normalizeSlug(body.slug, 'slug');
  }

  if (body.slug !== undefined || body.pathId !== undefined) {
    await ensureModuleSlugAvailable(nextPathId, module.slug, module._id.toString());
  }

  if (body.title !== undefined) {
    module.title = normalizeRequiredString(body.title, 'title');
  }

  if (body.subtitle !== undefined) {
    module.subtitle = normalizeOptionalString(body.subtitle);
  }

  if (body.description !== undefined) {
    module.description = normalizeRequiredString(body.description, 'description');
  }

  if (body.label !== undefined) {
    module.label = normalizeOptionalString(body.label);
  }

  if (body.order !== undefined && typeof body.order === 'number') {
    module.order = body.order;
  }

  if (body.estimatedLessons !== undefined) {
    module.estimatedLessons =
      typeof body.estimatedLessons === 'number' ? body.estimatedLessons : undefined;
  }

  if (body.estimatedMinutes !== undefined) {
    module.estimatedMinutes =
      typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : undefined;
  }

  if (body.status !== undefined) {
    module.status = validateEnum(body.status, ENTITY_STATUSES, 'status') ?? module.status;
  }

  if (body.unlockRule !== undefined) {
    module.unlockRule = isRecord(body.unlockRule)
      ? ({
          type:
            validateEnum(
              body.unlockRule.type,
              new Set(['always', 'previous_module_completed', 'manual']),
              'unlockRule.type',
            ) ?? 'always',
          requiredModuleId: normalizeOptionalString(body.unlockRule.requiredModuleId)
            ? ensureObjectId(
                normalizeRequiredString(body.unlockRule.requiredModuleId, 'unlockRule.requiredModuleId'),
                'unlock rule module id',
              )
            : undefined,
        } as AcademyModuleDocument['unlockRule'])
      : undefined;

    if (module.unlockRule?.requiredModuleId) {
      const requiredModule = await ensureModule(module.unlockRule.requiredModuleId.toString());

      if (requiredModule.pathId.toString() !== nextPathId.toString()) {
        throw new AppError('unlockRule.requiredModuleId must belong to the same path.', 400);
      }
    }
  }

  const updatedModule = await academyRepository.saveModule(module);
  if (previousPathId !== updatedModule.pathId.toString()) {
    await refreshPathCounts(ensureObjectId(previousPathId, 'path id'));
  }
  await refreshPathCounts(updatedModule.pathId);
  return updatedModule;
};

export const deleteModule = async (moduleId: string) => {
  const module = await ensureModule(moduleId);
  module.status = 'archived';
  const archivedModule = await academyRepository.saveModule(module);
  await refreshPathCounts(archivedModule.pathId);
  return archivedModule;
};

export const createLesson = async (body: unknown) => {
  const payload = buildLessonPayload(body);
  const pathId = payload.pathId as Types.ObjectId;
  const moduleId = payload.moduleId as Types.ObjectId;
  const slug = String(payload.slug);
  await ensurePath(pathId.toString());
  const module = await ensureModule(moduleId.toString());

  if (module.pathId.toString() !== pathId.toString()) {
    throw new AppError('moduleId does not belong to the informed pathId.', 400);
  }

  await ensureLessonSlugAvailable(moduleId, slug);

  const lesson = await academyRepository.createLesson(payload);
  await refreshPathCounts(pathId);
  return lesson;
};

export const listLessons = async (query: Record<string, unknown>) => {
  const filters: AcademyLessonListFilters = {
    pathId: normalizeOptionalString(query.pathId),
    moduleId: normalizeOptionalString(query.moduleId),
    status: validateEnum(query.status, ENTITY_STATUSES, 'status'),
    lessonType: validateEnum(query.lessonType, LESSON_TYPES, 'lessonType'),
    tag: normalizeOptionalString(query.tag),
    keyConcept: normalizeOptionalString(query.keyConcept),
  };

  return academyRepository.listLessons(filters);
};

export const getLessonById = async (lessonId: string) => {
  return ensureLesson(lessonId);
};

export const getLessonsByModule = async (moduleId: string) => {
  await ensureModule(moduleId);
  return academyRepository.listLessonsByModule(moduleId);
};

export const updateLesson = async (lessonId: string, body: unknown) => {
  const lesson = await ensureLesson(lessonId);
  const previousPathId = lesson.pathId.toString();

  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  let nextPathId = lesson.pathId;
  let nextModuleId = lesson.moduleId;

  if (body.pathId !== undefined) {
    nextPathId = ensureObjectId(normalizeRequiredString(body.pathId, 'pathId'), 'path id');
    await ensurePath(nextPathId.toString());
  }

  if (body.moduleId !== undefined) {
    nextModuleId = ensureObjectId(normalizeRequiredString(body.moduleId, 'moduleId'), 'module id');
  }

  if (body.pathId !== undefined || body.moduleId !== undefined) {
    const module = await ensureModule(nextModuleId.toString());

    if (module.pathId.toString() !== nextPathId.toString()) {
      throw new AppError('moduleId does not belong to the informed pathId.', 400);
    }

    lesson.pathId = nextPathId;
    lesson.moduleId = nextModuleId;
  }

  if (body.slug !== undefined) {
    lesson.slug = normalizeSlug(body.slug, 'slug');
  }

  if (body.slug !== undefined || body.moduleId !== undefined) {
    await ensureLessonSlugAvailable(nextModuleId, lesson.slug, lesson._id.toString());
  }

  if (body.title !== undefined) {
    lesson.title = normalizeRequiredString(body.title, 'title');
  }

  if (body.subtitle !== undefined) {
    lesson.subtitle = normalizeOptionalString(body.subtitle);
  }

  if (body.description !== undefined) {
    lesson.description = normalizeOptionalString(body.description);
  }

  if (body.order !== undefined && typeof body.order === 'number') {
    lesson.order = body.order;
  }

  if (body.status !== undefined) {
    lesson.status = validateEnum(body.status, ENTITY_STATUSES, 'status') ?? lesson.status;
  }

  const lessonType = validateEnum(body.lessonType, LESSON_TYPES, 'lessonType');
  if (lessonType) {
    lesson.lessonType = lessonType;
  }

  if (body.estimatedMinutes !== undefined) {
    lesson.estimatedMinutes =
      typeof body.estimatedMinutes === 'number' ? body.estimatedMinutes : undefined;
  }

  if (body.tags !== undefined) {
    lesson.tags = normalizeStringArray(body.tags);
  }

  if (body.keyConcepts !== undefined) {
    lesson.keyConcepts = normalizeStringArray(body.keyConcepts);
  }

  if (body.coreIdea !== undefined) {
    if (!isRecord(body.coreIdea) || !normalizeOptionalString(body.coreIdea.summary)) {
      throw new AppError('coreIdea.summary is required.', 400);
    }

    lesson.coreIdea = body.coreIdea as AcademyLessonDocument['coreIdea'];
  }

  if (body.conceptPosition !== undefined) {
    lesson.conceptPosition = isRecord(body.conceptPosition)
      ? (body.conceptPosition as AcademyLessonDocument['conceptPosition'])
      : undefined;
  }

  if (body.studyShelf !== undefined) {
    lesson.studyShelf = Array.isArray(body.studyShelf)
      ? (body.studyShelf as AcademyLessonDocument['studyShelf'])
      : [];
  }

  if (body.gmModelGame !== undefined) {
    lesson.gmModelGame = isRecord(body.gmModelGame)
      ? (body.gmModelGame as AcademyLessonDocument['gmModelGame'])
      : undefined;
  }

  if (body.targetedPractice !== undefined) {
    lesson.targetedPractice = isRecord(body.targetedPractice)
      ? (body.targetedPractice as AcademyLessonDocument['targetedPractice'])
      : undefined;
  }

  const updatedLesson = await academyRepository.saveLesson(lesson);
  if (previousPathId !== updatedLesson.pathId.toString()) {
    await refreshPathCounts(ensureObjectId(previousPathId, 'path id'));
  }
  await refreshPathCounts(updatedLesson.pathId);
  return updatedLesson;
};

export const deleteLesson = async (lessonId: string) => {
  const lesson = await ensureLesson(lessonId);
  lesson.status = 'archived';
  const archivedLesson = await academyRepository.saveLesson(lesson);
  await refreshPathCounts(archivedLesson.pathId);
  return archivedLesson;
};

export const getFullPath = async (pathId: string): Promise<AcademyFullPathResponse> => {
  const path = await ensurePath(pathId);
  const modules = await academyRepository.listModulesByPath(path._id);
  const lessons = await academyRepository.listLessons({ pathId, status: undefined });
  const visibleLessons = lessons.filter((lesson) => lesson.status !== 'archived');
  const lessonsByModule = new Map<string, AcademyLessonDocument[]>();

  for (const lesson of visibleLessons) {
    const key = lesson.moduleId.toString();
    const existing = lessonsByModule.get(key) ?? [];
    existing.push(lesson);
    lessonsByModule.set(key, existing);
  }

  return {
    path,
    modules: modules.map((module) => {
      const moduleObject = module.toObject();

      return {
        ...moduleObject,
        lessons:
          lessonsByModule.get(module._id.toString())?.sort((left, right) =>
            left.order === right.order
              ? left.createdAt.getTime() - right.createdAt.getTime()
              : left.order - right.order,
          ) ?? [],
      };
    }),
  };
};
