import type { Document, Types } from 'mongoose';

import type { PlayerProfileDocument } from '../player-profile/player-profile.types';

export const puzzleSources = ['LICHESS'] as const;
export const normalizedPuzzleDifficulties = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;
export const patternForgeStatuses = ['active', 'paused', 'completed', 'cancelled'] as const;
export const patternForgeRoundStatuses = ['pending', 'active', 'completed'] as const;
export const patternForgeSessionStatuses = ['active', 'completed'] as const;
export const patternForgeThemeKeys = [
  'tactics',
  'calculation',
  'king_safety',
  'endgames',
  'conversion',
  'defensive_resources',
  'time_pressure',
  'candidate_moves',
  'pawn_breaks',
  'openings',
] as const;

export type PuzzleSource = (typeof puzzleSources)[number];
export type NormalizedPuzzleDifficulty = (typeof normalizedPuzzleDifficulties)[number];
export type PatternForgeStatus = (typeof patternForgeStatuses)[number];
export type PatternForgeRoundStatus = (typeof patternForgeRoundStatuses)[number];
export type PatternForgeSessionStatus = (typeof patternForgeSessionStatuses)[number];
export type PatternForgeThemeKey = (typeof patternForgeThemeKeys)[number];

export type PuzzleRecord = {
  externalId: string;
  source: PuzzleSource;
  fen: string;
  initialMove: string;
  playableFen: string;
  solutionMoves: string[];
  fullMoveSequence: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
  openingTags: string[];
  gameUrl: string;
  normalizedDifficulty: NormalizedPuzzleDifficulty;
  createdAt: Date;
  updatedAt: Date;
};

export type PuzzleDocument = Document & PuzzleRecord;

export type PatternForgeThemeReason = {
  theme: PatternForgeThemeKey;
  reason: string;
  sourceField: string;
  confidence: number;
};

export type PatternForgeDerivedThemes = {
  themes: PatternForgeThemeKey[];
  reasons: PatternForgeThemeReason[];
};

export type PatternForgeRoundPlan = {
  round: number;
  targetDays: number;
  dailyTarget: number;
  goal?: string;
  status?: PatternForgeRoundStatus;
  completedPuzzles?: number;
  accuracy?: number;
  averageSolveTimeSeconds?: number;
  startedAt?: Date;
  completedAt?: Date;
};

export type PatternForgeRules = {
  repeatMissedPuzzles: boolean;
  repeatSlowSolves: boolean;
  prioritizeWeaknesses: boolean;
  endRoundWithMistakeReview: boolean;
};

export type PatternForgeCyclePatternSet = {
  puzzleCount: number;
  themes: string[];
  automaticThemesEnabled: boolean;
  automaticThemes: PatternForgeThemeKey[];
  manualThemes: string[];
  themeReasons: PatternForgeThemeReason[];
  difficulty: NormalizedPuzzleDifficulty;
  minRating: number;
  maxRating: number;
  includePersonalWeaknesses: boolean;
};

export type PatternForgeCycleRecord = {
  userId: Types.ObjectId;
  username: string;
  source: 'pattern_forge';
  status: PatternForgeStatus;
  patternSet: PatternForgeCyclePatternSet;
  repetitionPlan: {
    compressionPreset?: string;
    rounds: PatternForgeRoundPlan[];
    currentRound: number;
  };
  rules: PatternForgeRules;
  puzzleIds: Types.ObjectId[];
  mistakeQueue: Array<{
    puzzleId: Types.ObjectId;
    reason: 'wrong' | 'slow';
    queuedAt: Date;
    lastServedAt?: Date;
    servedCount: number;
  }>;
  progress: {
    currentRound: number;
    currentDay: number;
    completedPuzzlesInRound: number;
    completedToday: number;
    totalSolvedAcrossCycle: number;
    streakDays: number;
    accuracy: number;
    mistakesQueued: number;
    roundAccuracy: number;
    roundAverageSolveTimeSeconds: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type PatternForgeCycleDocument = Document & PatternForgeCycleRecord;

export type PatternForgeDailySessionRecord = {
  cycleId: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  round: number;
  dailyTarget: number;
  targetPuzzles: number;
  puzzleIds: Types.ObjectId[];
  completedPuzzleIds: Types.ObjectId[];
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  accuracy: number;
  averageSolveTimeSeconds: number;
  status: PatternForgeSessionStatus;
  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
};

export type PatternForgeDailySessionDocument = Document & PatternForgeDailySessionRecord;

export type PatternForgeAttemptRecord = {
  cycleId: Types.ObjectId;
  sessionId: Types.ObjectId;
  puzzleId: Types.ObjectId;
  userId: Types.ObjectId;
  selectedMoves: string[];
  solutionMoves: string[];
  isCorrect: boolean;
  isComplete: boolean;
  failedAtMoveIndex?: number;
  timeSpentSeconds: number;
  usedReveal: boolean;
  theme?: string;
  rating?: number;
  difficulty?: NormalizedPuzzleDifficulty;
  createdAt: Date;
  updatedAt: Date;
};

export type PatternForgeAttemptDocument = Document & PatternForgeAttemptRecord;

export type PatternForgeCycleConfigInput = {
  puzzleCount: number;
  automaticThemesEnabled: boolean;
  manualThemes?: string[];
  difficulty: NormalizedPuzzleDifficulty;
  compressionPreset?: string;
  rounds: Array<{
    round: number;
    targetDays: number;
    dailyTarget: number;
    goal?: string;
  }>;
  rules: PatternForgeRules;
  includePersonalWeaknesses?: boolean;
  minRating?: number;
  maxRating?: number;
};

export type CreatePatternForgeCycleBody = {
  username: string;
  config: PatternForgeCycleConfigInput;
};

export type PatternForgePuzzlePublic = {
  id: string;
  externalId: string;
  source: PuzzleSource;
  playableFen: string;
  solutionMoves: string[];
  rating: number;
  popularity: number;
  themes: string[];
  openingTags: string[];
  normalizedDifficulty: NormalizedPuzzleDifficulty;
  gameUrl: string;
};

export type GeneratedPatternForgePuzzleSet = {
  puzzles: PuzzleDocument[];
  automaticThemes: PatternForgeThemeKey[];
  manualThemes: string[];
  mergedThemes: string[];
  themeReasons: PatternForgeThemeReason[];
  minRating: number;
  maxRating: number;
};

export type GeneratePatternForgePuzzleSetInput = {
  userId: string;
  puzzleCount: number;
  automaticThemesEnabled: boolean;
  manualThemes?: string[];
  difficulty: NormalizedPuzzleDifficulty;
  includePersonalWeaknesses: boolean;
  minRating?: number;
  maxRating?: number;
  playerProfile: PlayerProfileDocument | null;
};

export type PatternForgeAttemptResult = {
  isCorrect: boolean;
  isComplete: boolean;
  failedAtMoveIndex?: number;
  solutionMoves: string[];
  explanation: string;
  puzzle: PatternForgePuzzlePublic;
  sessionProgress: {
    completed: number;
    dailyTarget: number;
    targetPuzzles: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    accuracy: number;
    mistakesQueued: number;
  };
  cycleProgress: {
    currentRound: number;
    currentDay: number;
    totalSolvedAcrossCycle: number;
    accuracy: number;
    mistakesQueued: number;
    roundAccuracy: number;
    roundAverageSolveTimeSeconds: number;
  };
};

export type ImportPuzzleCsvRow = {
  PuzzleId: string;
  FEN: string;
  Moves: string;
  Rating: string;
  RatingDeviation: string;
  Popularity: string;
  NbPlays: string;
  Themes: string;
  GameUrl: string;
  OpeningTags: string;
};
