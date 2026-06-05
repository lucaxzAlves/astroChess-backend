import type { Document, Types } from 'mongoose';

export const academyPathLevels = [
  'beginner',
  'beginner_to_intermediate',
  'intermediate',
  'advanced',
] as const;
export const academyPathCategories = [
  'calculation',
  'tactics',
  'strategy',
  'endgame',
  'opening',
  'defense',
  'attack',
] as const;
export const academyEntityStatuses = ['draft', 'published', 'archived'] as const;
export const academyCoverTypes = ['icon', 'image', 'board_preview'] as const;
export const academyUnlockRuleTypes = [
  'always',
  'previous_module_completed',
  'manual',
] as const;
export const academyLessonTypes = ['concept', 'model_game', 'practice', 'mixed'] as const;
export const academyOrientations = ['white', 'black'] as const;
export const academyStudyShelfTypes = [
  'video',
  'book',
  'article',
  'course',
  'chapter',
] as const;
export const academyCustomPuzzleDifficulties = ['easy', 'medium', 'hard'] as const;

export type AcademyPathLevel = (typeof academyPathLevels)[number];
export type AcademyPathCategory = (typeof academyPathCategories)[number];
export type AcademyEntityStatus = (typeof academyEntityStatuses)[number];
export type AcademyCoverType = (typeof academyCoverTypes)[number];
export type AcademyUnlockRuleType = (typeof academyUnlockRuleTypes)[number];
export type AcademyLessonType = (typeof academyLessonTypes)[number];
export type AcademyOrientation = (typeof academyOrientations)[number];
export type AcademyStudyShelfType = (typeof academyStudyShelfTypes)[number];
export type AcademyCustomPuzzleDifficulty = (typeof academyCustomPuzzleDifficulties)[number];

export type AcademyPathRecord = {
  title: string;
  slug: string;
  subtitle?: string;
  description: string;
  level: AcademyPathLevel;
  category: AcademyPathCategory;
  tags: string[];
  durationWeeks?: number;
  moduleCount?: number;
  lessonCount?: number;
  status: AcademyEntityStatus;
  order: number;
  cover?: {
    type: AcademyCoverType;
    imageUrl?: string;
    icon?: string;
  };
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type AcademyPathDocument = Document & AcademyPathRecord;

export type AcademyModuleRecord = {
  pathId: Types.ObjectId;
  title: string;
  slug: string;
  subtitle?: string;
  description: string;
  label?: string;
  order: number;
  estimatedLessons?: number;
  estimatedMinutes?: number;
  status: AcademyEntityStatus;
  unlockRule?: {
    type: AcademyUnlockRuleType;
    requiredModuleId?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type AcademyModuleDocument = Document & AcademyModuleRecord;

export type AcademyLessonRecord = {
  pathId: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  slug: string;
  subtitle?: string;
  description?: string;
  order: number;
  status: AcademyEntityStatus;
  lessonType: AcademyLessonType;
  estimatedMinutes?: number;
  tags: string[];
  keyConcepts: string[];
  coreIdea: {
    title?: string;
    summary: string;
    sections: Array<{
      heading: string;
      body: string;
    }>;
  };
  conceptPosition?: {
    title?: string;
    description?: string;
    fen: string;
    orientation: AcademyOrientation;
    initialPly?: number;
    moves?: Array<{
      san?: string;
      uci?: string;
      fenAfter?: string;
      comment?: string;
      highlightSquares?: string[];
      arrows?: Array<{
        from: string;
        to: string;
        color?: string;
      }>;
    }>;
    variations?: Array<{
      name?: string;
      moves: string[];
      explanation?: string;
    }>;
  };
  studyShelf?: Array<{
    type: AcademyStudyShelfType;
    title: string;
    author?: string;
    url?: string;
    description?: string;
    provider?: string;
    order?: number;
  }>;
  gmModelGame?: {
    title: string;
    white: string;
    black: string;
    event?: string;
    year?: number;
    result?: string;
    pgn?: string;
    startFen?: string;
    criticalFen?: string;
    criticalMoveNumber?: number;
    orientation?: AcademyOrientation;
    explanation?: string;
    moments?: Array<{
      moveNumber?: number;
      ply?: number;
      fen?: string;
      title: string;
      description: string;
      question?: string;
      answer?: string;
      candidateMoves?: string[];
      bestMove?: string;
    }>;
  };
  targetedPractice?: {
    description?: string;
    puzzleRefs?: Types.ObjectId[];
    generatedFilters?: {
      themes?: string[];
      minRating?: number;
      maxRating?: number;
      count?: number;
    };
    customPuzzles?: Array<{
      title?: string;
      fen: string;
      moves: string[];
      themes: string[];
      difficulty?: AcademyCustomPuzzleDifficulty;
      explanation?: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type AcademyLessonDocument = Document & AcademyLessonRecord;

export type AcademyPathListFilters = {
  status?: AcademyEntityStatus;
  category?: AcademyPathCategory;
  level?: AcademyPathLevel;
  search?: string;
};

export type AcademyModuleListFilters = {
  pathId?: string;
  status?: AcademyEntityStatus;
};

export type AcademyLessonListFilters = {
  pathId?: string;
  moduleId?: string;
  status?: AcademyEntityStatus;
  lessonType?: AcademyLessonType;
  tag?: string;
  keyConcept?: string;
};

export type AcademyFullPathResponse = {
  path: AcademyPathDocument;
  modules: Array<AcademyModuleRecord & { _id: Types.ObjectId; lessons: AcademyLessonDocument[] }>;
};
